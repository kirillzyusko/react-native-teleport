"""Build the pinned XCTest dependency incrementally; replace simulator resources only."""
import argparse
import concurrent.futures
import hashlib
import importlib.util
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
RUNNER_FILE = "maestro-driver-iosUITests/Routes/XCTest/RunnerDaemonProxy.swift"
RUNNER_BLOB = "599d53cf33c3bdd136ea79623e2b883d47d3a17a"
SWIPE_V2_FILE = "maestro-driver-iosUITests/Routes/Handlers/SwipeRouteHandlerV2.swift"
SWIPE_V2_BLOB = "57a32b8d7b7f8c39a943efe91cb0dd35c231db3e"
ORIGINAL_JAR = "1a4e4582e7b415167782711c04b914df878899d04757a2de82c3bf7a5b4c99f1"
APP_NAMES = ("maestro-driver-iosUITests-Runner.app", "maestro-driver-ios.app")
RESOURCE_PREFIX = "driver-iPhoneSimulator/Debug-iphonesimulator/"
HID_SOURCE = Path(__file__).resolve().parent / "ios-hid"


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


def patch_indigo_source(original, runner):
    if blob_hash(original) != EVENT_BLOB or blob_hash(runner) != RUNNER_BLOB:
        raise RuntimeError("Unsupported pinned XCTest source for Indigo")
    source = original.decode()
    declaration = "    static let defaultTapDuration = 0.1\n"
    source = source.replace(declaration, declaration + """#if targetEnvironment(simulator)
    var teleportGesture: [String: Any]?
#endif
""", 1)
    touch = "    func addPointerTouchEvent(at point: CGPoint, touchUpAfter: TimeInterval?) -> Self {\n"
    swipe = "    func addSwipeEvent(start: CGPoint, end: CGPoint, duration: TimeInterval) -> Self {\n"
    for signature in (touch, swipe):
        if source.count(signature) != 1:
            raise RuntimeError("Unexpected pinned gesture method")
    source = source.replace(touch, touch + """#if targetEnvironment(simulator)
        teleportGesture = ["kind": "touch", "point": ["x": point.x, "y": point.y],
                           "duration": touchUpAfter ?? Self.defaultTapDuration]
        return self
#else
""", 1)
    source = source.replace("        return add(path)\n    }", "        return add(path)\n#endif\n    }", 1)
    source = source.replace(swipe, swipe + """#if targetEnvironment(simulator)
        teleportGesture = ["kind": "swipe", "start": ["x": start.x, "y": start.y],
                           "end": ["x": end.x, "y": end.y], "duration": duration]
        return self
#else
""", 1)
    # Only the remaining swipe return has no conditional terminator yet.
    source = source.replace("        return add(path)\n    }", "        return add(path)\n#endif\n    }", 1)
    source += "\n" + (HID_SOURCE / "MaestroBridge.swift").read_text()
    proxy = runner.decode()
    method = "    func synthesize(eventRecord: EventRecord) async throws {\n"
    if proxy.count(method) != 1:
        raise RuntimeError("Unexpected pinned synthesis entry point")
    proxy = proxy.replace(method, method + """#if targetEnvironment(simulator)
        if let gesture = eventRecord.teleportGesture {
            try await TeleportSimulatorHID.send(gesture)
            return
        }
#endif
""", 1)
    return source.encode(), proxy.encode()


def patch_indigo_swipe_v2(original):
    if blob_hash(original) != SWIPE_V2_BLOB:
        raise RuntimeError("Unsupported pinned Swipe v2 source for Indigo")
    # v2 dispatches through EventTarget, which unwraps .eventRecord directly
    # and bypasses RunnerDaemonProxy. Forward this route explicitly; otherwise
    # it synthesizes the empty native record and loses teleportGesture.
    source = original.decode()
    start = "        let eventTarget = EventTarget()\n"
    end = "        }\n    }\n}"
    if source.count(start) != 1 or source.count(end) != 1:
        raise RuntimeError("Unexpected pinned Swipe v2 dispatch")
    source = source.replace(start, """#if targetEnvironment(simulator)
        let eventRecord = EventRecord(orientation: ScreenSizeHelper.currentInterfaceOrientation())
            .addSwipeEvent(start: startPoint, end: endPoint, duration: request.duration)
        try await RunnerDaemonProxy().synthesize(eventRecord: eventRecord)
#else
""" + start, 1)
    source = source.replace(end, "        }\n#endif\n    }\n}", 1)
    return source.encode()


def hid_host_manifest(artifact, metadata):
    spec = importlib.util.spec_from_file_location("inspect_ios_hid", Path(__file__).with_name("inspect-ios-hid.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    developer = Path(subprocess.check_output(["xcode-select", "-p"], text=True).strip())
    folder, _ = module.simulator_kit(developer)
    core = Path("/Library/Developer/PrivateFrameworks/CoreSimulator.framework/CoreSimulator").resolve(strict=True)
    kit = (folder / "SimulatorKit").resolve(strict=True)
    if sha256(core.read_bytes()) != "35d5e6a1ecc3a619f4a9d352dd84f9d49a575d2168767a9b2eddfa67075c51ed" or sha256(kit.read_bytes()) != "3a6df493a904d5472dd17b9664864b10a569a040f3b7bea750bfcdcd200cd055":
        raise RuntimeError("Indigo supports only the captured Xcode16.4/CoreSimulator1051.17.8 binaries")
    helper = artifact / "IndigoHost"
    if sha256(helper.read_bytes()) != metadata["hid_host"]["sha256"]:
        raise RuntimeError("Indigo host helper digest mismatch")
    helper.chmod(0o755)
    manifest = {"developer": str(developer), "candidate_sha": metadata["candidate_sha"]}
    for name, file in [("core", core), ("kit", kit), ("helper", helper)]:
        manifest[name] = {"file": str(file), "sha256": sha256(file.read_bytes())}
    (artifact / "indigo-host-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def build(args):
    if getattr(args, "archive_frame_bodies", False) and (
        args.backend != "indigo" or not args.trace_frames or
        getattr(args, "observe_idle", False) or getattr(args, "observe_static_idle", False)
    ):
        raise RuntimeError("Frame bodies require the explicit Indigo frame diagnostic without idle RPCs")
    source = args.source.resolve()
    output = args.output.resolve()
    derived = args.derived.resolve()
    output.mkdir(parents=True, exist_ok=True)
    source.mkdir(parents=True, exist_ok=True)
    metadata = {"status": "preparing", "source_commit": SOURCE_COMMIT,
                "source_tree": SOURCE_TREE, "lead_in_seconds": float(args.lead_in),
                "backend": args.backend,
                "candidate_sha": os.environ.get("GITHUB_SHA"), "resources": {}}
    manifest = output / "maestro-ios-input.json"

    def save():
        manifest.write_text(json.dumps(metadata, indent=2) + "\n")

    save()
    try:
        files = prepare_source(source)
        (output / "source-manifest.json").write_text(json.dumps(files, indent=2) + "\n")
        if args.trace_frames:
            if args.backend != "indigo":
                raise RuntimeError("Frame observation is restricted to the opt-in Indigo diagnostic")
            spec = importlib.util.spec_from_file_location("screen_trace", Path(__file__).with_name("maestro-ios-screen-trace.py"))
            trace = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(trace)
            observation = {"version": 1, "helper_sha256": sha256(trace.HELPER.read_bytes())}
            for name, label in [(trace.SCREEN, "ScreenDiffHandler"), (trace.SHOT, "ScreenshotHandler")]:
                raw = (source / name).read_bytes()
                changed = trace.patch(name, raw)
                (output / f"{label}.original.swift").write_bytes(raw)
                (output / f"{label}.patched.swift").write_bytes(changed)
                (source / name).write_bytes(changed)
                observation[label] = {"original_sha256": sha256(raw), "patched_sha256": sha256(changed)}
            (output / "ScreenTrace.swift").write_bytes(trace.HELPER.read_bytes())
            metadata["frame_trace"] = observation
        if getattr(args, "archive_frame_bodies", False):
            spec = importlib.util.spec_from_file_location("frame_bodies", Path(__file__).with_name("maestro-ios-frame-bodies.py"))
            bodies = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(bodies)
            original_screen = (output / "ScreenDiffHandler.original.swift").read_bytes()
            intermediate = (source / bodies.FRAME.SCREEN).read_bytes()
            changed = bodies.patch(original_screen, intermediate)
            (source / bodies.FRAME.SCREEN).write_bytes(changed)
            (output / "frame-body-ScreenDiffHandler.patched.swift").write_bytes(changed)
            (output / "FrameBodyArchive.swift").write_bytes(bodies.HELPER.read_bytes())
            metadata["frame_body_archive"] = bodies.metadata(intermediate, changed)
        if getattr(args, "observe_idle", False):
            if args.backend != "indigo" or not args.trace_frames:
                raise RuntimeError("Idle notification observation requires the explicit Indigo frame diagnostic")
            spec = importlib.util.spec_from_file_location("idle_observe", Path(__file__).with_name("maestro-ios-idle-observe.py"))
            idle = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(idle)
            observation = {"version": 1, "helper_sha256": idle.helper_hash(), "sources": {}}
            for name in idle.PINNED:
                raw = (source / name).read_bytes()
                changed = idle.patch(name, raw)
                label = Path(name).name
                (output / f"idle-{label}.original").write_bytes(raw)
                (output / f"idle-{label}.patched").write_bytes(changed)
                (source / name).write_bytes(changed)
                observation["sources"][name] = {"original_sha256": sha256(raw), "patched_sha256": sha256(changed)}
            for name in ["IdleObserve.h", "IdleObserve.m", "IdleObserve.swift"]:
                (output / name).write_bytes((idle.HELPERS / name).read_bytes())
            metadata["idle_observation"] = observation
        if getattr(args, "observe_static_idle", False):
            if not getattr(args, "observe_idle", False):
                raise RuntimeError("Post-static observation requires the explicit native idle diagnostic")
            spec = importlib.util.spec_from_file_location("static_idle", Path(__file__).with_name("maestro-ios-static-idle.py"))
            static_idle = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(static_idle)
            original_server = (output / "idle-XCTestHTTPServer.swift.original").read_bytes()
            intermediate = (source / static_idle.BASE.SERVER).read_bytes()
            changed = static_idle.patch(original_server, intermediate)
            (source / static_idle.BASE.SERVER).write_bytes(changed)
            (output / "idle-static-XCTestHTTPServer.swift.patched").write_bytes(changed)
            (output / "IdleStaticObserve.swift").write_bytes(static_idle.HELPER.read_bytes())
            metadata["idle_static_observation"] = {
                "version": 1, "helper_sha256": static_idle.helper_hash(),
                "intermediate_sha256": sha256(intermediate), "patched_sha256": sha256(changed)}
        original = (source / EVENT_FILE).read_bytes()
        if args.backend == "indigo":
            if args.lead_in != "0":
                raise RuntimeError("Indigo does not use a Recap lead-in")
            runner = (source / RUNNER_FILE).read_bytes()
            patched, patched_runner = patch_indigo_source(original, runner)
            (output / "RunnerDaemonProxy.original.swift").write_bytes(runner)
            (output / "RunnerDaemonProxy.patched.swift").write_bytes(patched_runner)
            (source / RUNNER_FILE).write_bytes(patched_runner)
            swipe_v2 = (source / SWIPE_V2_FILE).read_bytes()
            patched_swipe_v2 = patch_indigo_swipe_v2(swipe_v2)
            (output / "SwipeRouteHandlerV2.original.swift").write_bytes(swipe_v2)
            (output / "SwipeRouteHandlerV2.patched.swift").write_bytes(patched_swipe_v2)
            (source / SWIPE_V2_FILE).write_bytes(patched_swipe_v2)
            metadata.update(swipe_v2_original_sha256=sha256(swipe_v2),
                            swipe_v2_patched_sha256=sha256(patched_swipe_v2))
            metadata.update(runner_original_sha256=sha256(runner), runner_patched_sha256=sha256(patched_runner),
                            hid_host_source_sha256=sha256((HID_SOURCE / "IndigoHost.m").read_bytes()),
                            hid_bridge_source_sha256=sha256((HID_SOURCE / "MaestroBridge.swift").read_bytes()))
            metadata["hid_node_source_sha256"] = sha256(Path(__file__).with_name("ios-hid-bridge.mjs").read_bytes())
        else:
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
        if args.backend == "indigo":
            helper = output / "IndigoHost"
            compile_host = ["xcrun", "clang", "-fobjc-arc", "-fblocks", "-Wall", "-Wextra", "-Werror",
                            "-framework", "Foundation", "-framework", "CoreGraphics",
                            str(HID_SOURCE / "IndigoHost.m"), "-o", str(helper)]
            with (output / "indigo-host-build.log").open("w") as log:
                subprocess.run(compile_host, stdout=log, stderr=subprocess.STDOUT, check=True)
            result = subprocess.check_output([str(helper), "--self-test"], timeout=10)
            (output / "indigo-host-self-test.json").write_bytes(result)
            (output / "IDB-LICENSE").write_bytes((HID_SOURCE / "IDB-LICENSE").read_bytes())
            metadata["hid_host"] = {"file": helper.name, "sha256": sha256(helper.read_bytes())}
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
    if getattr(args, "expected_frame_bodies", False) and (
        args.expected_backend != "indigo" or not args.expected_frame_trace or
        getattr(args, "expected_idle_observation", False) or getattr(args, "expected_static_idle_observation", False)
    ):
        raise RuntimeError("Frame-body archive install requires the explicit Indigo frame diagnostic without idle RPCs")
    jar = args.jar.resolve()
    artifact = args.artifact.resolve()
    metadata = json.loads((artifact / "maestro-ios-input.json").read_text())
    if metadata["status"] != "built" or metadata["source_commit"] != SOURCE_COMMIT:
        raise RuntimeError("Missing successful pinned XCTest dependency build")
    if metadata["lead_in_seconds"] != float(args.expected_lead_in):
        raise RuntimeError("The built input profile does not match this trial")
    if metadata.get("backend", "recap") != args.expected_backend:
        raise RuntimeError("The built input backend does not match this trial")
    if bool(metadata.get("frame_trace")) != args.expected_frame_trace:
        raise RuntimeError("The built frame-observation profile does not match this trial")
    if bool(metadata.get("idle_observation")) != getattr(args, "expected_idle_observation", False):
        raise RuntimeError("The built idle-observation profile does not match this trial")
    if bool(metadata.get("idle_static_observation")) != getattr(args, "expected_static_idle_observation", False):
        raise RuntimeError("The built post-static idle-observation profile does not match this trial")
    if bool(metadata.get("frame_body_archive")) != getattr(args, "expected_frame_bodies", False):
        raise RuntimeError("The built frame-body archive profile does not match this trial")
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
    if args.expected_backend == "indigo":
        hid_host_manifest(artifact, metadata)
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
    prepare.add_argument("--trace-frames", action="store_true")
    prepare.add_argument("--archive-frame-bodies", action="store_true")
    prepare.add_argument("--observe-idle", action="store_true")
    prepare.add_argument("--observe-static-idle", action="store_true")
    prepare.add_argument("--backend", choices=("recap", "indigo"), default="recap")
    use = commands.add_parser("install")
    use.add_argument("--jar", required=True, type=Path)
    use.add_argument("--artifact", required=True, type=Path)
    use.add_argument("--expected-lead-in", required=True, choices=("0", "0.05"))
    use.add_argument("--expected-backend", choices=("recap", "indigo"), default="recap")
    use.add_argument("--expected-frame-trace", action="store_true")
    use.add_argument("--expected-frame-bodies", action="store_true")
    use.add_argument("--expected-idle-observation", action="store_true")
    use.add_argument("--expected-static-idle-observation", action="store_true")
    args = parser.parse_args()
    (build if args.command == "build" else install)(args)


if __name__ == "__main__":
    main()
