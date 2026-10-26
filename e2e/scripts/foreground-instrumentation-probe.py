"""Isolated equivalent of Maestro PR3708; never modify the installed distribution.

Remove exactly the background marker from AndroidDriver's command constant.
Source: Maestro cli-2.10.0 AndroidDriver.startInstrumentationSession.
https://github.com/mobile-dev-inc/Maestro/pull/3708
"""
import pathlib
import struct
import sys
import zipfile

jar = pathlib.Path(sys.argv[1])
destination = pathlib.Path(sys.argv[2])
entry = "maestro/drivers/AndroidDriver.class"
old = b"dev.mobile.maestro.test/androidx.test.runner.AndroidJUnitRunner &\n"
new = b"dev.mobile.maestro.test/androidx.test.runner.AndroidJUnitRunner\n"
with zipfile.ZipFile(jar) as archive:
    data = archive.read(entry)
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
print("Prepared isolated foreground AndroidDriver:", target)
