"""Optimize one pinned image-comparison method; isolated unless --install is used."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import zipfile

ENTRY = "com/github/romankh3/image/comparison/ImageComparison.class"
EXPECTED = "36791c9458102c37ad998ba6eb3756902582400bc6e9ce59cdad4ef842cd287e"
EXPECTED_JAR = "b3331881bafd1d539e728e4670301931d019a23a2eabf257370a06075cb16c83"
TARGET = ("populateRectangles", "()Ljava/util/List;")


def members(data):
    """Return raw field/method records, preserving bytecode and metadata bytes."""
    if data[:4] != b"\xca\xfe\xba\xbe":
        raise ValueError("Expected a Java class")
    count = struct.unpack_from(">H", data, 8)[0]
    strings = {}
    cursor = 10
    index = 1
    sizes = {3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4,
             12: 4, 15: 3, 16: 2, 17: 4, 18: 4, 19: 2, 20: 2}
    while index < count:
        tag = data[cursor]
        cursor += 1
        if tag == 1:
            length = struct.unpack_from(">H", data, cursor)[0]
            strings[index] = data[cursor + 2:cursor + 2 + length].decode()
            cursor += 2 + length
        else:
            cursor += sizes[tag]
            if tag in (5, 6):
                index += 1
        index += 1
    interface_count = struct.unpack_from(">H", data, cursor + 6)[0]
    cursor += 8 + interface_count * 2
    result = []
    for _ in range(2):
        length = struct.unpack_from(">H", data, cursor)[0]
        cursor += 2
        records = {}
        for _ in range(length):
            start = cursor
            access, name, descriptor, attributes = struct.unpack_from(">HHHH", data, cursor)
            cursor += 8
            for _ in range(attributes):
                size = struct.unpack_from(">I", data, cursor + 2)[0]
                cursor += 6 + size
            key = (strings[name], strings[descriptor])
            if key in records:
                raise ValueError("Duplicate class member")
            records[key] = (access, data[start:cursor])
        result.append(records)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jar", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--install", action="store_true")
    options = parser.parse_args()
    jar = options.jar.resolve()
    destination = options.destination.resolve()
    scripts = Path(__file__).resolve().parent
    input_jar_sha = hashlib.sha256(jar.read_bytes()).hexdigest()
    if input_jar_sha != EXPECTED_JAR:
        raise ValueError(f"Expected pinned image-comparison 4.4.0 JAR, got {input_jar_sha}")
    with zipfile.ZipFile(jar) as archive:
        if archive.namelist().count(ENTRY) != 1:
            raise ValueError("Expected exactly one ImageComparison class")
        if any(n.startswith("META-INF/") and n.endswith((".SF", ".RSA", ".DSA"))
               for n in archive.namelist()):
            raise ValueError("Refusing to modify a signed JAR")
        original = archive.read(ENTRY)
    sha = hashlib.sha256(original).hexdigest()
    if sha != EXPECTED:
        raise ValueError(f"Expected pinned image-comparison 4.4.0, got {sha}")
    destination.mkdir(parents=True, exist_ok=True)
    compiler = destination / "compiler"
    replacement = destination / "replacement"
    output = destination / "classes"
    export = "java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED"
    subprocess.run(["javac", "--release", "8", "-encoding", "UTF-8", "-g:none",
                    "-cp", str(jar), "-d", str(replacement),
                    str(scripts / "image-comparison-fixture/ImageComparison.java")], check=True)
    subprocess.run(["javac", "--add-exports", export, "-d", str(compiler),
                    str(scripts / "PatchImageComparison.java")], check=True)
    subprocess.run(["java", "--add-exports", export, "-cp", str(compiler),
                    "PatchImageComparison", str(jar), str(replacement), str(output)], check=True)
    patched = (output / ENTRY).read_bytes()
    old_fields, old_methods = members(original)
    new_fields, new_methods = members(patched)
    if old_fields != new_fields or old_methods.keys() != new_methods.keys():
        raise ValueError("Class members changed unexpectedly")
    changed = [key for key in old_methods if old_methods[key] != new_methods[key]]
    if changed != [TARGET] or old_methods[TARGET][0] != new_methods[TARGET][0]:
        raise ValueError(f"Expected exactly one private method change, got {changed}")
    original_path = destination / "original" / ENTRY
    original_path.parent.mkdir(parents=True, exist_ok=True)
    original_path.write_bytes(original)
    if options.install:
        with tempfile.NamedTemporaryFile(dir=jar.parent, suffix=".jar", delete=False) as stream:
            temporary = Path(stream.name)
        try:
            with zipfile.ZipFile(jar) as source, zipfile.ZipFile(temporary, "w") as target:
                target.comment = source.comment
                for info in source.infolist():
                    target.writestr(copy.copy(info), patched if info.filename == ENTRY else source.read(info))
            with zipfile.ZipFile(jar) as source, zipfile.ZipFile(temporary) as check:
                if check.namelist() != source.namelist() or check.testzip() is not None:
                    raise ValueError("Patched JAR did not verify")
                for name in source.namelist():
                    if check.read(name) != (patched if name == ENTRY else source.read(name)):
                        raise ValueError(f"Unexpected JAR change: {name}")
            temporary.chmod(jar.stat().st_mode & 0o777)
            os.replace(temporary, jar)
        finally:
            temporary.unlink(missing_ok=True)
    report = {
        "maestro_version": "2.10.0", "dependency_version": "4.4.0",
        "source": "https://github.com/romankh3/image-comparison/blob/v4.4.0/src/main/java/com/github/romankh3/image/comparison/ImageComparison.java",
        "class": ENTRY, "changed_methods": [list(TARGET)],
        "other_members_byte_identical": True,
        "input_class_sha256": sha, "output_class_sha256": hashlib.sha256(patched).hexdigest(),
        "replacement_source_sha256": hashlib.sha256((scripts / "image-comparison-fixture/ImageComparison.java").read_bytes()).hexdigest(),
        "input_jar_sha256": input_jar_sha, "output_jar_sha256": hashlib.sha256(jar.read_bytes()).hexdigest(),
        "installation_modified": options.install,
    }
    (destination / "maestro-image-comparison-patch.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
