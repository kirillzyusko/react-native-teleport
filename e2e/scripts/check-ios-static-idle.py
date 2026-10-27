"""Independently audit fresh idle notifications after original static responses."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import re

SCRIPTS = Path(__file__).resolve().parent


def load(label, file):
    spec = importlib.util.spec_from_file_location(label, SCRIPTS / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BASE = load('static_idle_core_checker', 'check-ios-idle-observe.py')
SOURCE = load('static_idle_source', 'maestro-ios-static-idle.py')
FRAME = load('static_idle_frame_checker', 'check-ios-screen-trace.py')


def check(text, device, minimum_inputs=100, minimum_static=100):
    records = BASE.parse(text)
    frames = FRAME.parse(text)
    result = BASE.check(records, text, device, frames, minimum_inputs=minimum_inputs, observe_static=True,
                        minimum_static=minimum_static)
    errors = result['errors']
    markers = [json.loads(line.split('[teleport-static-idle] ', 1)[1])
               for line in text.splitlines() if '[teleport-static-idle] ' in line]
    http = re.findall(r'\[FlyingFox\].*request: (GET|POST) /(touch|swipe|swipeV2|isScreenStatic)\s*$', text, re.M)
    expected = []
    started = False
    for method, route in http:
        if method == 'POST' and route in ['touch', 'swipe', 'swipeV2']:
            started = True
        elif method == 'GET' and route == 'isScreenStatic':
            expected.append(started)
    if [m.get('observed') for m in markers] != expected or any(type(m.get('observed')) is not bool for m in markers):
        errors.append('Every static HTTP response must have one typed post-response phase marker')
    if [m.get('staticOrdinal') for m in markers] != list(range(1, len(expected) + 1)):
        errors.append('Missing/duplicate static response ordinal')
    if any(type(m.get('staticOrdinal')) is not int or m.get('version') != 1 or
           m.get('sourceSHA') != SOURCE.helper_hash() for m in markers):
        errors.append('Post-static wrapper identity or ordinal type differs')
    times = [m.get('uptime') for m in markers]
    if not all(type(t) in (int, float) and math.isfinite(t) for t in times) or times != sorted(times):
        errors.append('Post-static marker timestamps invalid')
    statics = [f for f in frames if f['route'] == 'isScreenStatic']
    observations = [r for r in records if r['event'] == 'input_complete' and r.get('route') == 'isScreenStatic']
    if len(statics) != len(markers) or len(observations) != sum(expected):
        errors.append('Fresh idle observations do not cover the original static responses')
    pairs = []
    index = 0
    for marker, frame in zip(markers, statics):
        if type(marker.get('uptime')) in (int, float) and marker['uptime'] < frame['ready']:
            errors.append('Fresh idle registration preceded the original static response body')
        if marker.get('observed') is True and index < len(observations):
            observed = observations[index]
            index += 1
            if marker['uptime'] > observed['uptime']:
                errors.append('Fresh native observation precedes its phase marker')
            pairs.append((frame, observed))
    pending_screenshots = []
    for shot in [f for f in frames if f['route'] == 'screenshot']:
        prior = [(frame, observation) for frame, observation in pairs if frame['ready'] <= shot['begin']]
        if not prior:
            continue
        frame, observation = prior[-1]
        pending = [c['kind'] for c in result['callbacks'] if c['generation'] == observation['generation'] and c['replyUptime'] > shot['captured']]
        if pending:
            pending_screenshots.append({'screenshotSequence': shot['sequence'], 'bodyHash': shot['bodyHash'],
                'captureReturnedUptime': shot['captured'], 'precedingStaticSequence': frame['sequence'],
                'precedingStaticResult': frame['isScreenStatic'], 'generation': observation['generation'],
                'pendingKinds': pending})
    result['staticTrueWhilePreviousObservationPending'] = result.pop('staticTrueWhileNotificationPending')
    result.update(version=2, staticWrapperSHA=SOURCE.helper_hash(), observations=result.pop('inputs'),
                  gestureInputs=sum(1 for r in records if r['event'] == 'input_complete' and r.get('route') != 'isScreenStatic'),
                  staticResponses=len(markers), staticObserved=len(observations),
                  screenshotsWhileFreshStaticIdlePending=pending_screenshots,
                  limit='Fresh notifications follow original static responses without awaiting callbacks or changing response bytes. Capture-return timestamps and nil callbacks are not presentation/JS-commit timestamps. Diagnostic only.')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('debug', type=Path)
    parser.add_argument('artifact', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--device', required=True)
    args = parser.parse_args()
    logs = list(args.debug.glob('xctest_runner*.log'))
    if len(logs) != 1:
        raise ValueError('Expected one actual native HTTP/idle/frame log')
    result = check(logs[0].read_text(), args.device)
    result['errors'].extend(BASE.source_audit(args.artifact))
    result['errors'].extend(SOURCE.source_audit(args.artifact))
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ['callbacks', 'screenshotsWhileFreshStaticIdlePending', 'staticTrueWhilePreviousObservationPending']}))
    raise SystemExit(bool(result['errors']))


if __name__ == '__main__':
    main()
