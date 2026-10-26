"""Apply PR3708 to pinned Maestro 2.10.0, isolated unless --install is used.

Remove exactly the background marker from AndroidDriver's command constant.
Source: Maestro cli-2.10.0 AndroidDriver.startInstrumentationSession.
https://github.com/mobile-dev-inc/Maestro/pull/3708
"""
import pathlib
import argparse
import hashlib
import json
import os
import struct
import tempfile
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("jar", type=pathlib.Path)
parser.add_argument("destination", type=pathlib.Path)
parser.add_argument("--install", action="store_true")
options = parser.parse_args()
jar = options.jar
destination = options.destination
entry = "maestro/drivers/AndroidDriver.class"
old = b"dev.mobile.maestro.test/androidx.test.runner.AndroidJUnitRunner &\n"
new = b"dev.mobile.maestro.test/androidx.test.runner.AndroidJUnitRunner\n"
with zipfile.ZipFile(jar) as archive:
    if archive.namelist().count(entry) != 1:
        raise ValueError("Expected exactly one AndroidDriver class")
    if any(name.startswith("META-INF/") and name.endswith((".SF", ".RSA", ".DSA"))
           for name in archive.namelist()):
        raise ValueError("Refusing to modify a signed JAR")
    data = archive.read(entry)
stock_sha = hashlib.sha256(data).hexdigest()
expected_sha = "fe81b4683464003262e83ddb9a9ab13b3fb8218662dedebc051f6d851fbb1b6e"
if stock_sha != expected_sha:
    raise ValueError(f"Expected pinned Maestro 2.10.0 AndroidDriver, got SHA256 {stock_sha}")
original_jar_sha = hashlib.sha256(jar.read_bytes()).hexdigest()
if data[:4] != b"\xca\xfe\xba\xbe":
    raise ValueError("Expected a Java class")
count = struct.unpack_from(">H", data, 8)[0]
output = bytearray(data[:10])
position = 10
index = 1
replacements = 0
sizes = {
    3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4,
    12: 4, 15: 3, 16: 2, 17: 4, 18: 4, 19: 2, 20: 2,
}
while index < count:
    tag = data[position]
    output.append(tag)
    position += 1
    if tag == 1:
        length = struct.unpack_from(">H", data, position)[0]
        value = data[position + 2:position + 2 + length]
        position += 2 + length
        if value == old:
            value = new
            replacements += 1
        output += struct.pack(">H", len(value)) + value
    else:
        length = sizes[tag]
        output += data[position:position + length]
        position += length
        if tag in (5, 6):
            index += 1
    index += 1
if replacements != 1:
    raise ValueError(f"Expected exactly one stock command constant, found {replacements}")
output += data[position:]
target = destination / entry
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(output)
if options.install:
    with tempfile.NamedTemporaryFile(dir=jar.parent, suffix=".jar", delete=False) as stream:
        temporary = pathlib.Path(stream.name)
    try:
        with zipfile.ZipFile(jar) as source, zipfile.ZipFile(temporary, "w") as patched:
            patched.comment = source.comment
            for info in source.infolist():
                patched.writestr(info, output if info.filename == entry else source.read(info))
        with zipfile.ZipFile(temporary) as check:
            if check.read(entry) != output or check.testzip() is not None:
                raise ValueError("Patched archive did not verify")
        temporary.chmod(jar.stat().st_mode & 0o777)
        os.replace(temporary, jar)
    finally:
        temporary.unlink(missing_ok=True)
report = {
    "maestro_version": "2.10.0",
    "source": "https://github.com/mobile-dev-inc/Maestro/pull/3708",
    "changed_constants": replacements,
    "input_class_sha256": stock_sha,
    "output_class_sha256": hashlib.sha256(output).hexdigest(),
    "input_jar_sha256": original_jar_sha,
    "output_jar_sha256": hashlib.sha256(jar.read_bytes()).hexdigest(),
    "installation_modified": options.install,
}
(destination / "maestro-patch.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
