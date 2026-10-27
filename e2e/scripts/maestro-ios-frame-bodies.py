"""Compose a separately opted-in archive of the two existing static PNG bodies."""
import hashlib
import importlib.util
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('old_frame_patch', Path(__file__).with_name('maestro-ios-screen-trace.py'))
FRAME = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(FRAME)
HELPER = Path(__file__).with_name('ios-hid') / 'FrameBodyArchive.swift'
LIMITS = {'pairs': 1024, 'pngBytes': 16 * 1024 * 1024,
          'totalBytes': 256 * 1024 * 1024, 'pendingPairs': 8}


def metadata(intermediate, changed):
    return {'version': 1, 'helper_sha256': hashlib.sha256(HELPER.read_bytes()).hexdigest(),
            'intermediate_sha256': hashlib.sha256(intermediate).hexdigest(),
            'compiled_source_sha256': hashlib.sha256(changed).hexdigest(), 'limits': LIMITS}


def helper_bytes():
    raw = HELPER.read_bytes()
    return raw.replace(b'__TELEPORT_FRAME_BODY_SHA__', hashlib.sha256(raw).hexdigest().encode())


def patch(original, framed):
    expected = FRAME.patch(FRAME.SCREEN, original)
    if framed != expected:
        raise ValueError('Body archive requires the exact pinned original frame observer intermediate')
    source = framed.decode()
    old = '''            let hash1 = SHA256.hash(data: screenshot1.pngRepresentation)
            let hash2 = SHA256.hash(data: screenshot2.pngRepresentation)
'''
    new = '''#if targetEnvironment(simulator)
            let traceFirstPNG = screenshot1.pngRepresentation
            let hash1 = SHA256.hash(data: traceFirstPNG)
            let traceSecondPNG = screenshot2.pngRepresentation
            let hash2 = SHA256.hash(data: traceSecondPNG)
#else
''' + old + '''#endif
'''
    source = FRAME.insert_once(source, old, new)
    anchor = '            return HTTPResponse(statusCode: .ok, body: responseData)\n'
    source = FRAME.insert_once(source, anchor, '''#if targetEnvironment(simulator)
            TeleportFrameBodyArchive.submit(
                first: traceFirstPNG, second: traceSecondPNG,
                firstHash: TeleportScreenTrace.hex(hash1), secondHash: TeleportScreenTrace.hex(hash2),
                firstReturned: traceFirstCaptured, secondReturned: traceSecondCaptured,
                isScreenStatic: isScreenStatic
            )
#endif
''' + anchor)
    return (source + helper_bytes().decode()).encode()


def target_source(raw, simulator):
    """Select the exact pinned Simulator directives without changing their bodies."""
    kept = []
    in_simulator = False
    physical_else = False
    for line in raw.decode().splitlines(keepends=True):
        if line.strip() == '#if targetEnvironment(simulator)':
            if in_simulator:
                raise ValueError('Unexpected nested Simulator block')
            in_simulator = True
            physical_else = False
        elif in_simulator and line.strip() == '#else':
            physical_else = True
        elif in_simulator and line.strip() == '#endif':
            in_simulator = False
            physical_else = False
        elif not in_simulator or physical_else != simulator:
            kept.append(line)
    if in_simulator:
        raise ValueError('Unclosed Simulator-only block')
    return ''.join(kept).encode()


def physical_source(raw):
    return target_source(raw, False)


def simulator_source(raw):
    return target_source(raw, True)
