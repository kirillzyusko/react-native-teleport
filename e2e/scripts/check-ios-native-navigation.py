"""Validate passive public UIKit state; no state here certifies visual idleness."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re

SPEC = importlib.util.spec_from_file_location('navigation_visual_raw', Path(__file__).with_name('check-ios-visual-trace.py'))
VISUAL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VISUAL)


def audit(text, metadata, device):
    parsed = VISUAL.parse_log(text)
    errors = list(parsed['errors'])
    native = parsed['native']
    samples = [row for row in native if row.get('phase') == 'presentation.sample' and row.get('role') == 'go_next']
    selected = [row for row in native if row.get('phase') == 'touch.up.dispatched' and 'go_next' in row.get('identifiers', [])]
    finite = lambda value: type(value) in (int, float) and math.isfinite(value) and value >= 0

    def state_of(row):
        value = row.get('nativeNavigation')
        return value if isinstance(value, dict) else {}

    def expect(condition, message):
        if not condition:
            errors.append(message)

    def identity(value, nullable=False):
        if value is None:
            return nullable
        return (isinstance(value, dict) and set(value) == {'id', 'class'} and
                isinstance(value['id'], str) and re.fullmatch(r'[a-f0-9]{1,16}', value['id']) is not None and
                int(value['id'], 16) > 0 and isinstance(value['class'], str) and
                1 <= len(value['class']) <= 256 and not any(ord(c) < 32 for c in value['class']))

    expect(bool(selected) and bool(samples), 'Missing selected native navigation observations')
    selected_keys = [(row.get('pid'), row.get('gesture')) for row in selected]
    expect(len(selected_keys) == len(set(selected_keys)), 'Duplicate native navigation gesture identity')
    grouped = {}
    for row in samples:
        key = (row.get('pid'), row.get('gesture'))
        grouped.setdefault(key, []).append(row)
        expect(key in selected_keys, 'Native navigation sample lacks its original selected UP')
        expect(type(row.get('version')) is int and row['version'] == 1 and row.get('sourceSHA') == metadata['sourceSHA'] and
               row.get('helperSHA') == metadata['helperSourceHashes']['native'] and
               type(row.get('pid')) is int and row['pid'] > 0 and row.get('simulatorUDID') == device and
               finite(row.get('uptime')) and finite(row.get('wallTimeMs')),
               'Native navigation source/process/device/clock identity differs')
        state = row.get('nativeNavigation')
        keys = {'version', 'navigation', 'stack', 'top', 'visible', 'coordinator', 'observedBegin', 'observedEnd'}
        if not isinstance(state, dict) or set(state) != keys or type(state.get('version')) is not int or state['version'] != 1:
            errors.append('Missing, failed or malformed native navigation state')
            continue
        expect(finite(state['observedBegin']) and finite(state['observedEnd']) and finite(row.get('uptime')) and
               state['observedBegin'] <= state['observedEnd'] <= row['uptime'],
               'Native navigation getter interval differs')
        expect(identity(state['navigation']) and identity(state['top'], True) and identity(state['visible'], True),
               'Invalid native navigation/controller identity')
        stack = state['stack']
        valid_stack = (isinstance(stack, list) and len(stack) <= 16 and all(identity(item) for item in stack))
        expect(valid_stack, 'Invalid or excessive native navigation stack')
        if valid_stack:
            expect(len({item['id'] for item in stack}) == len(stack), 'Repeated native navigation stack identity')
            expect(state['top'] == (stack[-1] if stack else None), 'Native navigation top differs from observed stack')
        coordinator = state['coordinator']
        if coordinator is not None:
            keys = {'identity', 'animated', 'interactive', 'initiallyInteractive', 'cancelled', 'duration',
                    'percentComplete', 'from', 'to'}
            if not isinstance(coordinator, dict) or set(coordinator) != keys:
                errors.append('Malformed native transition coordinator state')
                continue
            expect(identity(coordinator['identity']) and identity(coordinator['from'], True) and
                   identity(coordinator['to'], True), 'Invalid native transition coordinator/controller identity')
            expect(all(type(coordinator[key]) is bool for key in ['animated', 'interactive', 'initiallyInteractive', 'cancelled']),
                   'Invalid native transition coordinator flags')
            expect(finite(coordinator['duration']) and finite(coordinator['percentComplete']) and
                   coordinator['percentComplete'] <= 1, 'Invalid native transition coordinator timing')
    expect(set(grouped) == set(selected_keys), 'Selected UP lacks native navigation samples')
    for rows in grouped.values():
        expect([row.get('sample') for row in rows] == list(range(1, len(rows) + 1)) and len(rows) <= 512,
               'Missing, duplicated or excessive native navigation sample sequence')
        expect(all(type(row.get('sample')) is int for row in rows), 'Invalid native navigation sample number type')
        identities = [state_of(row).get('navigation') for row in rows]
        expect(bool(identities) and all(value == identities[0] for value in identities),
               'Selected native navigation context changed during observation')
    expect(not any('nativeNavigation' in row and
                   (row.get('phase') != 'presentation.sample' or row.get('role') != 'go_next') for row in native),
           'Native navigation observation escaped the original selected sampling scope')
    return {'version': 1, 'sourceSHA': metadata['sourceSHA'],
            'checkerSHA256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'selectedGestures': len(selected), 'samples': len(samples),
            'coordinatorPresentSamples': sum(isinstance(state_of(row).get('coordinator'), dict) for row in samples),
            'nativeRecords': samples, 'errors': errors, 'final_stability_credit': False,
            'limit': 'Public UIKit getters on the existing selected display-link pulse only. A nil coordinator is not an idle certificate. Getter intervals are not atomic snapshots, capture times or display transaction IDs. No observer callback, view loading, wait, input or screenshot is added.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--artifact', type=Path, required=True)
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--device', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    metadata = VISUAL.source_audit(args.artifact, args.candidate)
    text = args.log.read_text()
    original = VISUAL.check(text, metadata, args.device)
    result = audit(text, metadata, args.device)
    result['errors'] = [*original['errors'], *result['errors']]
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    if result['errors']:
        raise SystemExit('Invalid passive native navigation observation: ' + '; '.join(result['errors']))
    print(json.dumps({key: value for key, value in result.items() if key != 'nativeRecords'}))


if __name__ == '__main__':
    main()
