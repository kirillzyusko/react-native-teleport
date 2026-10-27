"""Audit native idle observation separately from actual screen-static responses.

A nil callback is recorded evidence of the API reply, not proof that a frame was
presented. This observer does not change or wait on the existing static result.
"""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re

SCRIPTS = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('idle_source', SCRIPTS / 'maestro-ios-idle-observe.py')
SOURCE = importlib.util.module_from_spec(spec)
spec.loader.exec_module(SOURCE)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_audit(artifact):
    artifact = Path(artifact)
    metadata = json.loads((artifact / 'maestro-ios-input.json').read_text())
    observed = metadata.get('idle_observation', {})
    errors = []
    if observed.get('version') != 1 or observed.get('helper_sha256') != SOURCE.helper_hash():
        errors.append('Native idle observation source identity differs')
    if not metadata.get('frame_trace') or metadata.get('backend') != 'indigo':
        errors.append('Idle observation lacks explicit frame/Indigo profile')
    for name in ['IdleObserve.h', 'IdleObserve.m', 'IdleObserve.swift']:
        if (artifact / name).read_bytes() != (SOURCE.HELPERS / name).read_bytes():
            errors.append(f'Archived idle helper differs: {name}')
    for name in SOURCE.PINNED:
        label = Path(name).name
        original = (artifact / f'idle-{label}.original').read_bytes()
        patched = (artifact / f'idle-{label}.patched').read_bytes()
        expected = SOURCE.patch(name, original)
        if patched != expected or observed.get('sources', {}).get(name) != {
            'original_sha256': sha(original), 'patched_sha256': sha(expected)
        }:
            errors.append(f'Pinned native idle source differs: {label}')
    return errors


def parse(text):
    return [json.loads(line.split('[teleport-idle-observe] ', 1)[1])
            for line in text.splitlines() if '[teleport-idle-observe] ' in line]


def check(records, xctest_log, device_udid, screen_records, minimum_inputs=100):
    errors = []

    def expect(condition, message):
        if not condition:
            errors.append(message)

    routes = re.findall(r'\[FlyingFox\].*request: POST /(touch|swipe|swipeV2)\s*$', xctest_log, re.M)
    inputs = [r for r in records if r.get('event') == 'input_complete']
    expect([r.get('route') for r in inputs] == routes, 'Every actual input route must have one ordered idle observation')
    expect(len(inputs) >= minimum_inputs, 'Insufficient native idle input coverage')
    expect([r.get('generation') for r in inputs] == list(range(1, len(inputs) + 1)), 'Missing/duplicate input generation')
    expect([r.get('sequence') for r in records] == list(range(1, len(records) + 1)), 'Missing/duplicate idle event sequence')
    expect(bool(re.fullmatch(r'[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}', device_udid)), 'Selected Simulator identity missing')
    times = [r.get('uptime') for r in records]
    valid_times = all(type(t) in (int, float) and math.isfinite(t) and t >= 0 for t in times)
    expect(valid_times and times == sorted(times), 'Invalid native idle monotonic timestamps')
    last_context = None
    for r in records:
        expect(r.get('version') == 1 and r.get('sourceSHA') == SOURCE.helper_hash(), 'Actual native idle helper identity differs')
        expect(r.get('simulatorUDID', '').lower() == device_udid.lower(), 'Idle record belongs to another Simulator')
        event = r.get('event')
        expect(event in ['remember', 'input_complete', 'registration_begin', 'registration_return', 'callback'],
               f'Native idle observation error or unknown event: {event}')
        if event != 'remember':
            expect(type(r.get('generation')) is int and r['generation'] > 0, 'Native idle generation must be a positive integer')
        if event in ['registration_begin', 'registration_return', 'callback']:
            expect(r.get('kind') in ['eventLoop', 'animations'], 'Unknown native idle notification kind')
        if event == 'remember':
            last_context = r
        if event == 'input_complete':
            expect(last_context is not None and all(r.get(k) == last_context.get(k) for k in ['pid', 'bundle']),
                   'Input does not match the cached original foreground hierarchy')
            expect(type(r.get('pid')) is int and r['pid'] > 0 and isinstance(r.get('bundle'), str) and bool(r['bundle']),
                   'Input process identity missing')
    callbacks = []
    for item in inputs:
        generation = item['generation']
        related = [r for r in records if r.get('generation') == generation]
        for kind in ['eventLoop', 'animations']:
            by_kind = [r for r in related if r.get('kind') == kind]
            counts = Counter(r.get('event') for r in by_kind)
            expect(counts == {'registration_begin': 1, 'registration_return': 1, 'callback': 1},
                   f'Generation {generation} lacks one actual {kind} registration/reply')
            begins = [r for r in by_kind if r.get('event') == 'registration_begin']
            returns = [r for r in by_kind if r.get('event') == 'registration_return']
            replies = [r for r in by_kind if r.get('event') == 'callback']
            if len(begins) != 1 or len(returns) != 1 or len(replies) != 1:
                continue
            begin, returned, reply = begins[0], returns[0], replies[0]
            expect(begin.get('frameworkUUID') == returned.get('frameworkUUID') == '12D8D288-FE92-327C-A8C9-9B18A863711B',
                   'Native idle registration used an unsupported XCTest image')
            expect(item['uptime'] <= begin['uptime'] <= returned['uptime'] and reply['uptime'] >= begin['uptime'],
                   'Native notification registered/replied before input')
            expect(all(reply.get(k) == item.get(k) for k in ['pid', 'bundle']), 'Idle reply process differs from input')
            expect(reply.get('errorIsNil') is True and reply.get('validErrorType') is True and
                   reply.get('errorDomain') == '' and reply.get('errorCode') == 0,
                   f'Generation {generation} {kind} did not return a typed nil NSError')
            callbacks.append({'generation': generation, 'kind': kind, 'inputUptime': item['uptime'],
                              'registrationSeconds': returned['uptime'] - begin['uptime'],
                              'replyAfterInputSeconds': reply['uptime'] - item['uptime'],
                              'replyUptime': reply['uptime']})
    expect(all(r.get('generation') in [i['generation'] for i in inputs]
               for r in records if r.get('event') != 'remember'), 'Idle event without an actual input generation')
    true_while_pending = []
    for frame in screen_records:
        if frame.get('route') != 'isScreenStatic' or frame.get('isScreenStatic') is not True:
            continue
        preceding = [r for r in inputs if r['uptime'] <= frame['begin']]
        if not preceding:
            continue
        generation = preceding[-1]['generation']
        pending = [r['kind'] for r in callbacks if r['generation'] == generation and r['replyUptime'] > frame['ready']]
        if pending:
            true_while_pending.append({'staticSequence': frame['sequence'], 'generation': generation,
                                       'staticReadyUptime': frame['ready'], 'pendingKinds': pending})
    return {'version': 1, 'sourceSHA': SOURCE.helper_hash(), 'deviceUDID': device_udid,
            'inputs': len(inputs), 'routeCounts': dict(Counter(routes)), 'callbacks': callbacks,
            'staticTrueWhileNotificationPending': true_while_pending, 'errors': errors,
            'final_stability_credit': False,
            'limit': 'Observer adds notification RPCs and can perturb scheduling. Nil replies and PNG equality are not display transaction or JS commit timestamps; no synchronization fix is claimed.'}


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
    text = logs[0].read_text()
    spec = importlib.util.spec_from_file_location('screen_checker', SCRIPTS / 'check-ios-screen-trace.py')
    screen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(screen)
    result = check(parse(text), text, args.device, screen.parse(text))
    result['errors'].extend(source_audit(args.artifact))
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ['callbacks', 'staticTrueWhileNotificationPending']}))
    raise SystemExit(bool(result['errors']))


if __name__ == '__main__':
    main()
