"""Compare pinned Maestro's simulator-native stop with its XCTest stop route.

Only LocalIOSDevice.stop changes. The existing SimctlIOSDevice controller
handles simulators; other controller types retain the original XCTest path.
Isolated unless --install is explicitly supplied by the CI experiment.
"""
import argparse
import copy
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("jar", type=pathlib.Path)
parser.add_argument("destination", type=pathlib.Path)
parser.add_argument("--install", action="store_true")
options = parser.parse_args()
jar = options.jar.resolve()
destination = options.destination.resolve()
entry = "ios/LocalIOSDevice.class"
with zipfile.ZipFile(jar) as archive:
    if archive.namelist().count(entry) != 1:
        raise ValueError("Expected exactly one LocalIOSDevice class")
    if any(name.startswith("META-INF/") and name.endswith((".SF", ".RSA", ".DSA"))
           for name in archive.namelist()):
        raise ValueError("Refusing to modify a signed JAR")
    original = archive.read(entry)
input_jar_sha = hashlib.sha256(jar.read_bytes()).hexdigest()
compiler = destination / "compiler"
classes = destination / "classes"
compiler.mkdir(parents=True, exist_ok=True)
export = "java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED"
subprocess.run([
    "javac", "--add-exports", export, "-d", str(compiler),
    str(pathlib.Path(__file__).with_name("PatchIOSStop.java")),
], check=True)
# The transformer rejects every class except the exact official2.10.0 input
# before emitting anything. No installed distribution is touched here.
result = subprocess.run([
    "java", "--add-exports", export, "-cp", str(compiler),
    "PatchIOSStop", str(jar), str(classes),
], capture_output=True, text=True)
(destination / "patch-helper.log").write_text(result.stdout + result.stderr)
if result.returncode:
    print(result.stdout, end="")
    print(result.stderr, file=sys.stderr, end="")
    raise SystemExit(result.returncode)
output = (classes / entry).read_bytes()
original_class = destination / "original" / entry
original_class.parent.mkdir(parents=True, exist_ok=True)
original_class.write_bytes(original)
if options.install:
    with tempfile.NamedTemporaryFile(dir=jar.parent, suffix=".jar", delete=False) as stream:
        temporary = pathlib.Path(stream.name)
    try:
        with zipfile.ZipFile(jar) as source, zipfile.ZipFile(temporary, "w") as patched:
            patched.comment = source.comment
            for info in source.infolist():
                patched.writestr(copy.copy(info), output if info.filename == entry else source.read(info))
        with zipfile.ZipFile(jar) as source, zipfile.ZipFile(temporary) as check:
            if check.namelist() != source.namelist() or check.testzip() is not None:
                raise ValueError("Patched archive did not verify")
            for name in source.namelist():
                expected = output if name == entry else source.read(name)
                if check.read(name) != expected:
                    raise ValueError(f"Unexpected change to {name}")
        temporary.chmod(jar.stat().st_mode & 0o777)
        os.replace(temporary, jar)
    finally:
        temporary.unlink(missing_ok=True)
report = {
    "maestro_version": "2.10.0",
    "class": entry,
    "changed_methods": 1,
    "simulator_native_stop": True,
    "other_controllers_unchanged": True,
    "historical_route_change": "https://github.com/mobile-dev-inc/Maestro/pull/2374",
    "input_class_sha256": hashlib.sha256(original).hexdigest(),
    "output_class_sha256": hashlib.sha256(output).hexdigest(),
    "input_jar_sha256": input_jar_sha,
    "output_jar_sha256": hashlib.sha256(jar.read_bytes()).hexdigest(),
    "installation_modified": options.install,
}
(destination / "maestro-ios-stop-patch.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
