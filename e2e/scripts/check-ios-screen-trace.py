"""Audit opt-in native screen responses and the exact returned screenshot bytes."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re

SPEC = importlib.util.spec_from_file_location('screen_trace', Path(__file__).with_name('maestro-ios-screen-trace.py'))
SOURCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SOURCE)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_audit(artifact):
    artifact = Path(artifact)
    metadata = json.loads((artifact / 'maestro-ios-input.json').read_text())
    observed = metadata.get('frame_trace', {})
    errors = []
    if observed.get('version') != 1 or observed.get('helper_sha256') != sha(SOURCE.HELPER.read_bytes()):
        errors.append('Frame-observation version/helper identity differs')
    if (artifact / 'ScreenTrace.swift').read_bytes() != SOURCE.HELPER.read_bytes():
        errors.append('Archived frame helper differs')
    for name in SOURCE.PINNED:
        label = Path(name).stem
        original = (artifact / f'{label}.original.swift').read_bytes()
        patched = (artifact / f'{label}.patched.swift').read_bytes()
        expected = SOURCE.patch(name, original)
        if patched != expected or observed.get(label) != {'original_sha256': sha(original), 'patched_sha256': sha(expected)}:
            errors.append(f'Pinned frame source differs: {label}')
    return errors


def parse(text):
    records = []
    for line in text.splitlines():
        if '[teleport-screen-trace] ' in line:
            record = json.loads(line.split('[teleport-screen-trace] ', 1)[1])
            record['logTime'] = line.split(' maestro-driver-', 1)[0]
            records.append(record)
    return records


def check(records, xctest_log, images, minimum_static=100):
    errors = []
    def expect(condition, message):
        if not condition:
            errors.append(message)
    routes = re.findall(r'\[FlyingFox\].*request: GET /(isScreenStatic|screenshot)\s*$', xctest_log, re.M)
    observed = [r.get('route') for r in records]
    expect(routes == observed, 'Every actual native static/screenshot request must have one ordered trace response')
    counts = Counter(observed)
    expect(counts['isScreenStatic'] >= minimum_static and counts['screenshot'] >= 20,
           'Insufficient original-suite screen response coverage')
    expect([r.get('sequence') for r in records] == list(range(1, len(records) + 1)), 'Missing/duplicate trace sequence')
    digest = lambda s: isinstance(s, str) and bool(re.fullmatch(r'[a-f0-9]{64}', s))
    for r in records:
        expect(r.get('version') == 1, 'Unknown frame trace version')
        fields = ['begin', 'firstCaptured', 'secondCaptured', 'ready'] if r.get('route') == 'isScreenStatic' else ['begin', 'captured', 'ready']
        times = [r.get(k) for k in fields]
        valid = all(type(v) in (float, int) and math.isfinite(v) and v >= 0 for v in times)
        expect(valid and times == sorted(times), 'Invalid capture/response monotonic timings')
        if r.get('route') == 'isScreenStatic':
            expect(type(r.get('isScreenStatic')) is bool and digest(r.get('firstHash')) and digest(r.get('secondHash')) and
                   r['isScreenStatic'] == (r['firstHash'] == r['secondHash']), 'Native static Boolean/hash equality differs')
        else:
            expect(r.get('route') == 'screenshot' and type(r.get('compressed')) is bool and
                   type(r.get('byteCount')) is int and r['byteCount'] > 0 and digest(r.get('bodyHash')),
                   'Missing exact screenshot response-body identity')
    body_hashes = {r.get('bodyHash') for r in records if r.get('route') == 'screenshot' and r.get('compressed') is False}
    expect(len(images) >= 20, 'Original takeScreenshot PNG evidence missing')
    matched = []
    for name, content in images:
        value = sha(content)
        expect(value in body_hashes, f'TakeScreenshot bytes lack a matching native response: {name}')
        matched.append({'file': name, 'sha256': value, 'native_response_match': value in body_hashes})
    return {'version': 1, 'routes': dict(Counter(routes)), 'responses': dict(counts), 'screenshots': matched,
            'native_static_true': sum(r.get('isScreenStatic') is True for r in records),
            'native_static_false': sum(r.get('isScreenStatic') is False for r in records),
            'records': records, 'errors': errors, 'final_stability_credit': False,
            'limit': 'Hashes identify captured response bytes. They are not display transaction IDs or JS commit timestamps.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('debug', type=Path)
    parser.add_argument('artifact', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    logs = list(args.debug.glob('xctest_runner*.log'))
    if len(logs) != 1:
        raise ValueError('Expected one actual XCTest log')
    text = logs[0].read_text()
    files = sorted(args.debug.glob('*/takeScreenshot/**/*.png'))
    result = check(parse(text), text, [(str(f.relative_to(args.debug)), f.read_bytes()) for f in files])
    result['errors'].extend(source_audit(args.artifact))
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ('records', 'screenshots')}))
    raise SystemExit(bool(result['errors']))


if __name__ == '__main__':
    main()
