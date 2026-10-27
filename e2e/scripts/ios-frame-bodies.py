"""Positive source/raw/file contracts for an explicit archive of existing PNGs."""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import struct
import zlib

SPEC = importlib.util.spec_from_file_location('frame_body_patch', Path(__file__).with_name('maestro-ios-frame-bodies.py'))
PATCH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PATCH)
MARKER = '[teleport-frame-bodies] '
PNG = b'\x89PNG\r\n\x1a\n'
UUID = r'[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def source_audit(artifact):
    artifact = Path(artifact)
    built = json.loads((artifact / 'maestro-ios-input.json').read_text())
    if (built.get('backend') != 'indigo' or not built.get('frame_trace') or
            built.get('idle_observation') or built.get('idle_static_observation')):
        raise ValueError('Body archive requires Indigo/frame without private idle RPCs')
    original = (artifact / 'ScreenDiffHandler.original.swift').read_bytes()
    intermediate = (artifact / 'ScreenDiffHandler.patched.swift').read_bytes()
    compiled = (artifact / 'frame-body-ScreenDiffHandler.patched.swift').read_bytes()
    expected = PATCH.patch(original, intermediate)
    if (compiled != expected or json.dumps(built.get('frame_body_archive'), sort_keys=True) !=
            json.dumps(PATCH.metadata(intermediate, expected), sort_keys=True)):
        raise ValueError('Actual composed frame-body source/metadata differs')
    if (artifact / 'FrameBodyArchive.swift').read_bytes() != PATCH.HELPER.read_bytes():
        raise ValueError('Archived body helper differs')
    if PATCH.physical_source(compiled) != PATCH.physical_source(intermediate):
        raise ValueError('Body archive changes the physical handler')
    return built['frame_body_archive']


def parse(text):
    records = []
    for line in text.splitlines():
        if MARKER not in line:
            continue
        record = json.loads(line.split(MARKER, 1)[1])
        prefix = line.split(MARKER, 1)[0]
        match = re.search(r'maestro-driver-iosUITests-Runner\[(\d+):\d+\]', prefix)
        if not match or int(match[1]) != record.get('pid'):
            raise ValueError('Body marker is not from its claimed actual XCTest runner PID')
        records.append(record)
    return records


def png_info(raw):
    if not raw.startswith(PNG):
        raise ValueError('Archived body is not PNG')
    offset = len(PNG)
    chunks = []
    dimensions = None
    while offset < len(raw):
        if offset + 12 > len(raw):
            raise ValueError('Truncated PNG chunk')
        count = struct.unpack('>I', raw[offset:offset + 4])[0]
        kind = raw[offset + 4:offset + 8]
        end = offset + 12 + count
        if end > len(raw):
            raise ValueError('Truncated PNG payload')
        data = raw[offset + 8:end - 4]
        crc = struct.unpack('>I', raw[end - 4:end])[0]
        if zlib.crc32(kind + data) != crc:
            raise ValueError('PNG chunk CRC differs')
        if not chunks:
            if kind != b'IHDR' or count != 13:
                raise ValueError('Missing PNG header')
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', data)
            if (not 0 < width <= 16384 or not 0 < height <= 16384 or
                    depth not in (1, 2, 4, 8, 16) or color not in (0, 2, 3, 4, 6) or
                    compression != 0 or filtering != 0 or interlace not in (0, 1)):
                raise ValueError('Unsupported PNG header')
            dimensions = {'width': width, 'height': height, 'bitDepth': depth, 'colorType': color}
        chunks.append(kind)
        offset = end
        if kind == b'IEND':
            if count or offset != len(raw):
                raise ValueError('Trailing PNG bytes')
            break
    if not chunks or chunks[-1] != b'IEND' or b'IDAT' not in chunks:
        raise ValueError('Incomplete PNG')
    return dimensions


def runtime_contract(records, screens, metadata, device):
    """No filesystem access: validate typed identities and link exact old timings."""
    if not re.fullmatch(UUID, device):
        raise ValueError('Invalid selected Simulator UDID')
    if not records:
        raise ValueError('Missing positive frame-body runtime markers')
    helper = sha(PATCH.HELPER.read_bytes())
    if metadata.get('helper_sha256') != helper or metadata.get('limits') != PATCH.LIMITS:
        raise ValueError('Body runtime metadata differs')
    grouped = {}
    for r in records:
        if (type(r.get('version')) is not int or r['version'] != 1 or r.get('helperSHA') != helper or
                type(r.get('pid')) is not int or r['pid'] <= 0 or
                r.get('simulatorUDID', '').upper() != device.upper() or
                any(type(r.get(k)) not in (float, int) or not math.isfinite(r[k]) or r[k] < 0
                    for k in ['uptime', 'wallTime'])):
            raise ValueError('Invalid body runtime source/PID/UDID/clock identity')
        if r.get('phase') not in ('initialized', 'queued', 'saved'):
            raise ValueError('Body archive reported rejection, write error or unknown phase')
        grouped.setdefault(r['pid'], []).append(r)
    pairs = []
    roots = {}
    total = 0
    for pid, group in grouped.items():
        initialized = [r for r in group if r['phase'] == 'initialized']
        if (len(initialized) != 1 or initialized[0].get('limits') != PATCH.LIMITS or
                not isinstance(initialized[0].get('root'), str)):
            raise ValueError('Missing/duplicate body root or bounds')
        roots[pid] = initialized[0]['root']
        queued = [r for r in group if r['phase'] == 'queued']
        saved = [r for r in group if r['phase'] == 'saved']
        if (not queued or len(queued) > PATCH.LIMITS['pairs'] or len(queued) != len(saved) or
                any(type(r.get('ordinal')) is not int for r in queued + saved) or
                sorted(r.get('ordinal', -1) for r in queued) != list(range(1, len(queued) + 1)) or
                sorted(r.get('ordinal', -1) for r in saved) != list(range(1, len(queued) + 1))):
            raise ValueError('Missing/duplicate/incomplete body pairs')
        completed = {r['ordinal']: r for r in saved}
        ordered = sorted(queued, key=lambda r: r['ordinal'])
        if any(a.get('secondReturned', float('inf')) >= b.get('firstReturned', -1)
               for a, b in zip(ordered, ordered[1:])):
            raise ValueError('Body ordinals differ from original static request order')
        for q in queued:
            ordinal = q['ordinal']
            s = completed[ordinal]
            if (type(q.get('pendingPairs')) is not int or not 1 <= q['pendingPairs'] <= PATCH.LIMITS['pendingPairs'] or
                    type(q.get('isScreenStatic')) is not bool or
                    any(type(q.get(k)) not in (float, int) or not math.isfinite(q[k]) or q[k] < 0
                        for k in ['firstReturned', 'secondReturned']) or
                    not q['firstReturned'] <= q['secondReturned'] <= q['uptime'] <= s['uptime'] or
                    initialized[0]['uptime'] > s['uptime']):
                raise ValueError('Invalid body pair clocks/bounds/Boolean')
            for side in ('first', 'second'):
                if (not isinstance(q.get(side + 'Hash'), str) or
                        not re.fullmatch(r'[a-f0-9]{64}', q[side + 'Hash']) or
                        type(q.get(side + 'Bytes')) is not int or not 0 < q[side + 'Bytes'] <= PATCH.LIMITS['pngBytes'] or
                        any(s.get(side + key) != q.get(side + key) for key in ['Hash', 'Bytes']) or
                        s.get(side + 'File') != f'pair-{ordinal:06d}-{side}.png'):
                    raise ValueError('Body queued/saved identity or filename differs')
            if q['isScreenStatic'] != (q['firstHash'] == q['secondHash']):
                raise ValueError('Body hash equality differs from original Boolean')
            total += q['firstBytes'] + q['secondBytes']
            pairs.append({'pid': pid, 'ordinal': ordinal, 'queued': q, 'saved': s})
    static = [r for r in screens if r.get('route') == 'isScreenStatic']
    if not static or len(pairs) != len(static) or total > PATCH.LIMITS['totalBytes'] or len(pairs) > PATCH.LIMITS['pairs']:
        raise ValueError('Body coverage or total bounds differ from original static routes')
    # Capture-return monotonic times are unique in this original sequential handler.
    key = lambda r: (r['firstCaptured'], r['secondCaptured'])
    indexed = {key(r): r for r in static}
    if len(indexed) != len(static):
        raise ValueError('Duplicate original static timing pair')
    used = set()
    for pair in pairs:
        q = pair['queued']
        k = (q['firstReturned'], q['secondReturned'])
        original = indexed.get(k)
        if not original or k in used or any(q[n] != original.get(n) for n in ['firstHash', 'secondHash', 'isScreenStatic']):
            raise ValueError('Body pair does not match exactly one original static response')
        used.add(k)
        pair['sequence'] = original['sequence']
    return {'roots': roots, 'pairs': sorted(pairs, key=lambda p: p['sequence']), 'totalBytes': total}


def file_audit(contract, manifest, read_file):
    """Reparse actual copied PNG bytes through a supplied bounded file reader."""
    if (manifest.get('version') != 1 or manifest.get('errors') or
            manifest.get('helperSHA') != sha(PATCH.HELPER.read_bytes())):
        raise ValueError('Missing/failed body collection receipt')
    expected = []
    for pair in contract['pairs']:
        for side in ('first', 'second'):
            name = f"{pair['pid']}/{pair['saved'][side + 'File']}"
            raw = read_file(name)
            q = pair['queued']
            if len(raw) != q[side + 'Bytes'] or sha(raw) != q[side + 'Hash']:
                raise ValueError('Archived original static PNG bytes/hash differ')
            expected.append({'file': name, 'sha256': sha(raw), 'bytes': len(raw), 'png': png_info(raw)})
    if expected != manifest.get('files'):
        raise ValueError('Collection manifest differs from independent PNG audit')
    return expected
