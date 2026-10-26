"""Build the pinned XCTest dependency incrementally; replace simulator resources only."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import plistlib
import subprocess
import tempfile
import urllib.request
import uuid
import zipfile

SOURCE_COMMIT = "14a408335e17a090df1e26bdbeaf80d8122a8fd8"
SOURCE_TREE = "1f45dd3ba4e3769166e396ede82c5017de7b9716"
EVENT_FILE = "maestro-driver-iosUITests/Routes/XCTest/EventRecord.swift"
EVENT_BLOB = "b7437395ea05c771b2497112fb9816ebc287f6de"
ORIGINAL_JAR = "1a4e4582e7b415167782711c04b914df878899d04757a2de82c3bf7a5b4c99f1"
APP_NAMES = ("maestro-driver-iosUITests-Runner.app", "maestro-driver-ios.app")
RESOURCE_PREFIX = "driver-iPhoneSimulator/Debug-iphonesimulator/"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def blob_hash(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def download(url, api=False):
    headers = {"User-Agent": "teleport-maestro-input-build"}
    token = os.environ.get("GH_TOKEN")
    if api and token:
        headers["Authorization"] = f"Bearer {token}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        return response.read()


def prepare_source(folder):
    tree = json.loads(download(
        f"https://api.github.com/repos/mobile-dev-inc/Maestro/git/trees/{SOURCE_TREE}?recursive=1",
        api=True,
    ))
    if tree.get("truncated") or tree["sha"] != SOURCE_TREE:
        raise RuntimeError("Incomplete or unexpected pinned XCTest source tree")
    files = [entry for entry in tree["tree"] if entry["type"] == "blob"]
    if len(files) != 212:
        raise RuntimeError(f"Unexpected pinned driver file count: {len(files)}")

    def prepare(entry):
        relative = PurePosixPath(entry["path"])
        if relative.is_absolute() or ".." in relative.parts or entry["mode"] not in ("100644", "100755"):
            raise RuntimeError(f"Unsupported dependency source entry: {relative}")
        target = folder.joinpath(*relative.parts)
        if target.exists() and blob_hash(target.read_bytes()) == entry["sha"]:
            return
        data = download(
            f"https://raw.githubusercontent.com/mobile-dev-inc/Maestro/{SOURCE_COMMIT}/"
            f"maestro-ios-xctest-runner/{entry['path']}"
        )
        if blob_hash(data) != entry["sha"]:
            raise RuntimeError(f"Pinned source hash mismatch: {relative}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        target.chmod(0o755 if entry["mode"] == "100755" else 0o644)

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(prepare, files))
    license_data = download(
        f"https://raw.githubusercontent.com/mobile-dev-inc/Maestro/{SOURCE_COMMIT}/LICENSE"
    )
    if blob_hash(license_data) != "261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64":
        raise RuntimeError("Unexpected upstream license")
    (folder / "MAESTRO-LICENSE").write_bytes(license_data)
    return files


def patch_event_record(original, lead_in):
    if blob_hash(original) != EVENT_BLOB:
        raise RuntimeError("Unsupported EventRecord.swift; refusing to patch")
    source = original.decode()
    field = "    static let defaultTapDuration = 0.1\n"
    marker = f'''    // Allow Recap registration before the first DOWN event (Maestro #3686).
    // Relative DOWN/MOVE/UP intervals remain unchanged.
    static let touchLeadIn: TimeInterval = {{
        let value: TimeInterval = {lead_in}
        NSLog("[teleport-maestro-input] touchLeadInSeconds=%.3f", value)
        return value
    }}()
'''
    if source.count(field) != 1:
        raise RuntimeError("Unexpected EventRecord duration declaration")
    source = source.replace(field, field + marker)
    for point in ("point", "start"):
        old = f"PointerEventPath.pathForTouch(at: {point})"
        if source.count(old) != 1:
            raise RuntimeError(f"Unexpected {point} touch-path constructor")
        source = source.replace(old, f"PointerEventPath.pathForTouch(at: {point}, offset: Self.touchLeadIn)")
    return source.encode()


def build(args):
    source = args.source.resolve()
    output = args.output.resolve()
    derived = args.derived.resolve()
    output.mkdir(parents=True, exist_ok=True)
    source.mkdir(parents=True, exist_ok=True)
    metadata = {"status": "preparing", "source_commit": SOURCE_COMMIT,
                "source_tree": SOURCE_TREE, "lead_in_seconds": float(args.lead_in),
                "candidate_sha": os.environ.get("GITHUB_SHA"), "resources": {}}
    manifest = output / "maestro-ios-input.json"

    def save():
        manifest.write_text(json.dumps(metadata, indent=2) + "\n")

    save()
    try:
        files = prepare_source(source)
        (output / "source-manifest.json").write_text(json.dumps(files, indent=2) + "\n")
        original = (source / EVENT_FILE).read_bytes()
        patched = patch_event_record(original, args.lead_in)
        (output / "EventRecord.original.swift").write_bytes(original)
        (output / "EventRecord.patched.swift").write_bytes(patched)
        (output / "MAESTRO-LICENSE").write_bytes((source / "MAESTRO-LICENSE").read_bytes())
        (source / EVENT_FILE).write_bytes(patched)
        metadata.update(status="prepared", source_file_count=len(files),
                        event_original_sha256=sha256(original), event_patched_sha256=sha256(patched))
        save()
        if args.prepare_only:
            print(json.dumps(metadata, indent=2))
            return
        if platform.system() != "Darwin":
            raise RuntimeError("The XCTest dependency must be built on macOS")
        metadata["xcode"] = subprocess.check_output(["xcodebuild", "-version"], text=True).strip()
        metadata["architecture"] = platform.machine()
        command = ["xcodebuild", "build-for-testing", "-project", str(source / "maestro-driver-ios.xcodeproj"),
                   "-scheme", "maestro-driver-ios", "-configuration", "Debug",
                   "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", str(derived),
                   "-onlyUsePackageVersionsFromResolvedFile", f"ARCHS={platform.machine()}"]
        metadata.update(status="building", build_command=command)
        save()
        # Do not run upstream's wrapper: it executes clean and deletes DerivedData.
        environment = {key: value for key, value in os.environ.items() if key not in ("GH_TOKEN", "GITHUB_TOKEN")}
        with (output / "xcodebuild.log").open("w") as log:
            result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, env=environment)
        if result.returncode:
            lines = (output / "xcodebuild.log").read_text(errors="replace").splitlines()
            print("\n".join(lines[-100:]))
            raise RuntimeError(f"XCTest source build failed: exit {result.returncode}")
        products = derived / "Build/Products/Debug-iphonesimulator"
        for name in APP_NAMES:
            app = products / name
            info = plistlib.loads((app / "Info.plist").read_bytes())
            if not (app / info["CFBundleExecutable"]).is_file():
                raise RuntimeError(f"Missing native executable in {name}")
            archive_name = name.removesuffix(".app") + ".zip"
            temporary = output / f"{archive_name}.{uuid.uuid4().hex}.zip"
            subprocess.run(["zip", "-q", "-r", str(temporary), name], cwd=products, check=True)
            target = output / archive_name
            os.replace(temporary, target)
            metadata["resources"][RESOURCE_PREFIX + archive_name] = {
                "file": archive_name, "sha256": sha256(target.read_bytes()),
                "bundle_identifier": info["CFBundleIdentifier"],
            }
        metadata["status"] = "built"
        save()
        print(json.dumps(metadata, indent=2))
    except Exception as error:
        metadata.update(status="failed", error=str(error))
        save()
        raise


def install(args):
    jar = args.jar.resolve()
    artifact = args.artifact.resolve()
    metadata = json.loads((artifact / "maestro-ios-input.json").read_text())
    if metadata["status"] != "built" or metadata["source_commit"] != SOURCE_COMMIT:
        raise RuntimeError("Missing successful pinned XCTest dependency build")
    if metadata["lead_in_seconds"] != float(args.expected_lead_in):
        raise RuntimeError("The built input profile does not match this trial")
    if os.environ.get("GITHUB_SHA") and metadata["candidate_sha"] != os.environ["GITHUB_SHA"]:
        raise RuntimeError("The built driver belongs to a different candidate")
    expected_names = {RESOURCE_PREFIX + name.removesuffix(".app") + ".zip" for name in APP_NAMES}
    if set(metadata["resources"]) != expected_names:
        raise RuntimeError("Unexpected simulator resources")
    original = jar.read_bytes()
    if sha256(original) != ORIGINAL_JAR:
        raise RuntimeError("Unsupported installed Maestro iOS SDK JAR; refusing to modify")
    replacements = {}
    for name, resource in metadata["resources"].items():
        if resource["file"] != PurePosixPath(name).name:
            raise RuntimeError("Unexpected artifact filename")
        data = (artifact / resource["file"]).read_bytes()
        if sha256(data) != resource["sha256"]:
            raise RuntimeError(f"Artifact digest mismatch: {name}")
        with zipfile.ZipFile(artifact / resource["file"]) as archive:
            if archive.testzip() is not None:
                raise RuntimeError(f"Corrupt native artifact: {name}")
        replacements[name] = data
    with tempfile.NamedTemporaryFile(dir=jar.parent, suffix=".jar", delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with zipfile.ZipFile(jar) as before, zipfile.ZipFile(temporary_path, "w") as after:
            for entry in before.infolist():
                after.writestr(entry, replacements.get(entry.filename, before.read(entry.filename)))
        with zipfile.ZipFile(jar) as before, zipfile.ZipFile(temporary_path) as after:
            changed = [name for name in before.namelist() if before.read(name) != after.read(name)]
        if set(changed) != expected_names:
            raise RuntimeError(f"Unexpected JAR mutations: {changed}")
        metadata.update(installed_jar_sha256=sha256(temporary_path.read_bytes()),
                        original_jar_sha256=ORIGINAL_JAR, replaced_entries=changed)
        temporary_path.chmod(jar.stat().st_mode & 0o777)
        os.replace(temporary_path, jar)
        (artifact / "maestro-ios-input-install.json").write_text(json.dumps(metadata, indent=2) + "\n")
        print(json.dumps(metadata, indent=2))
    finally:
        temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    prepare = commands.add_parser("build")
    prepare.add_argument("--source", required=True, type=Path)
    prepare.add_argument("--derived", required=True, type=Path)
    prepare.add_argument("--output", required=True, type=Path)
    prepare.add_argument("--lead-in", required=True, choices=("0", "0.05"))
    prepare.add_argument("--prepare-only", action="store_true")
    use = commands.add_parser("install")
    use.add_argument("--jar", required=True, type=Path)
    use.add_argument("--artifact", required=True, type=Path)
    use.add_argument("--expected-lead-in", required=True, choices=("0", "0.05"))
    args = parser.parse_args()
    (build if args.command == "build" else install)(args)


if __name__ == "__main__":
    main()
