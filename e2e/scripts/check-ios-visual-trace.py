"""Reparse opt-in application event measurements; never final stability credit."""
import base64
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import plistlib
import re


def parse_log(text):
    result = {'native': [], 'js': [], 'errors': []}
    groups = {}
    completed = set()
    for number, line in enumerate(text.splitlines(), 1):
        marker = next((tag for tag in ('teleport-visual-native', 'teleport-visual-native-chunk', 'teleport-visual-js')
                       if f'[{tag}] ' in line), None)
        if '[teleport-visual-encoding-error]' in line:
            result['errors'].append(f'Native log encoding failed at line{number}')
        if marker is None:
            continue
        try:
            row = json.loads(line.split(f'[{marker}] ', 1)[1])
            if not isinstance(row, dict):
                raise ValueError('Expected object')
            prefix = re.search(r'\[(\d+):', line.split(f'[{marker}] ', 1)[0])
            if prefix and row.get('pid') != int(prefix[1]):
                raise ValueError('Payload PID differs from original log process')
            if marker == 'teleport-visual-native-chunk':
                if (row.get('version') != 1 or type(row.get('pid')) is not int or row['pid'] <= 0 or
                    type(row.get('parts')) is not int or not 1 <= row['parts'] <= 32 or
                    type(row.get('part')) is not int or not 0 <= row['part'] < row['parts'] or
                    not isinstance(row.get('recordSHA256'), str) or not re.fullmatch(r'[a-f0-9]{64}', row['recordSHA256']) or
                    not isinstance(row.get('payload'), str) or not 1 <= len(row['payload']) <= 512):
                    raise ValueError('Invalid bounded native chunk')
                key = (row['pid'], row['recordSHA256'])
                if key in completed or len(groups) >= 64 and key not in groups:
                    raise ValueError('Duplicate or excessive native chunk group')
                group = groups.setdefault(key, {'parts': row['parts'], 'payloads': {}})
                if row['parts'] != group['parts'] or row['part'] in group['payloads']:
                    raise ValueError('Missing/duplicate/inconsistent chunk index')
                group['payloads'][row['part']] = row['payload']
                if len(group['payloads']) < group['parts']:
                    continue
                data = base64.b64decode(''.join(group['payloads'][i] for i in range(group['parts'])), validate=True)
                if len(data) > 16384 or hashlib.sha256(data).hexdigest() != row['recordSHA256']:
                    raise ValueError('Reconstructed native bytes differ')
                decoded = json.loads(data)
                if not isinstance(decoded, dict) or decoded.get('pid') != row['pid']:
                    raise ValueError('Reconstructed native PID differs')
                row = decoded
                del groups[key]
                completed.add(key)
            result['js' if marker == 'teleport-visual-js' else 'native'].append(row)
        except (ValueError, TypeError, KeyError) as error:
            result['errors'].append(f'Visual trace line{number}: {error}')
    if groups:
        result['errors'].append('Incomplete native log chunks')
    return result


def load_builder():
    spec = importlib.util.spec_from_file_location('visual_app_builder', Path(__file__).with_name('prepare-ios-visual-trace.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def source_audit(folder, candidate):
    builder = load_builder()
    folder = Path(folder)
    metadata = json.loads((folder / 'app-identity.json').read_text())
    scope = json.loads((builder.SOURCE / 'patch-manifest.json').read_text())
    digest = lambda data: hashlib.sha256(data).hexdigest()
    if (metadata.get('version') != 1 or metadata.get('profile') != builder.PROFILE or
        metadata.get('candidateSHA') != candidate or metadata.get('sourceSHA') != builder.source_identity() or
        metadata.get('builderSHA256') != digest(Path(builder.__file__).read_bytes()) or
        metadata.get('helperSourceHashes') != builder.helper_hashes() or metadata.get('final_stability_credit') is not False):
        raise ValueError('Visual app source/profile/candidate/builder identity differs')
    if (folder / 'prepare-ios-visual-trace.py').read_bytes() != Path(builder.__file__).read_bytes():
        raise ValueError('Archived application builder differs')
    originals = {**scope['originals'], scope['info']: scope['info_original_sha256']}
    if metadata.get('originals') != originals:
        raise ValueError('Visual app original source scope differs')
    for name, value in originals.items():
        if digest((folder / 'originals' / name).read_bytes()) != value:
            raise ValueError(f'Archived app original differs: {name}')
    info = plistlib.loads((folder / 'originals' / scope['info']).read_bytes())
    info.update(TeleportVisualTrace=True, TeleportVisualTraceSourceSHA=metadata['sourceSHA'])
    patched = {**scope['patched'], scope['info']: digest(plistlib.dumps(info, sort_keys=False))}
    helpers = {name: digest(builder.helper_bytes(label)) for label, name in scope['helpers'].items()}
    if metadata.get('patched') != patched or metadata.get('helpers') != helpers:
        raise ValueError('Visual app prepared source scope differs')
    for name, value in {**patched, **helpers}.items():
        if digest((folder / 'patched' / name).read_bytes()) != value:
            raise ValueError(f'Archived app patch/helper differs: {name}')
    app = metadata.get('builtApp', {})
    if (app.get('compiledFingerprintsPresent') is not True or app.get('bundleID') != 'teleport.example' or
        any(not isinstance(app.get(k), str) or not re.fullmatch(r'[a-f0-9]{64}', app[k])
            for k in ['executableSHA256', 'jsBundleSHA256'])):
        raise ValueError('Missing built application binary/JS/fingerprint proof')
    return metadata


def check(text, metadata, device):
    parsed = parse_log(text)
    errors = parsed['errors']
    native, javascript = parsed['native'], parsed['js']
    finite = lambda value: type(value) in (int, float) and math.isfinite(value) and value >= 0
    roles = ['go_next', 'persisted_portal_toggle_host']
    allowed = {
        'native': {'installed', 'runtime.identity', 'mount.observer.installed', 'touch.up.dispatched',
                   'presentation.begin', 'presentation.sample', 'presentation.end', 'fabric.willMount', 'fabric.didMount'},
        'js': {'installed', 'onPress.begin', 'onPress.end', 'react.layoutEffect',
               'navigation.transitionStart.received', 'navigation.transitionEnd.received'},
    }
    def expect(condition, message):
        if not condition:
            errors.append(message)
    for label, records in [('native', native), ('js', javascript)]:
        expect(bool(records), f'Missing actual {label} app trace')
        for row in records:
            expect(type(row.get('version')) is int and row['version'] == 1 and row.get('sourceSHA') == metadata['sourceSHA'] and
                   row.get('helperSHA') == metadata['helperSourceHashes'][label] and
                   type(row.get('pid')) is int and row['pid'] > 0 and row.get('simulatorUDID') == device and
                   finite(row.get('wallTimeMs')) and finite(row.get('uptime' if label == 'native' else 'monotonicMs')),
                   f'Invalid actual {label} source/process/device/clock identity')
            expect(row.get('phase') not in ['setup.error', 'buffer.overflow'], f'Actual {label} trace reports {row.get("phase")}')
            expect(row.get('phase') in allowed[label], f'Unknown {label} measurement phase')
        for pid in {r.get('pid') for r in records}:
            ordered = [r for r in records if r.get('pid') == pid and r.get('phase') != 'runtime.identity']
            expect([r.get('sequence') for r in ordered] == list(range(1, len(ordered) + 1)),
                   f'Missing/duplicate/out-of-order {label} process trace sequence')
            times = [r.get('uptime' if label == 'native' else 'monotonicMs') for r in ordered]
            expect(all(finite(t) for t in times) and times == sorted(times), f'Nonmonotonic {label} trace clock')
    for pid in {r.get('pid') for r in native}:
        expect(sum(r.get('phase') == 'installed' and r.get('pid') == pid for r in native) == 1,
               'Missing/duplicate native hook installation')
        expect(sum(r.get('phase') == 'mount.observer.installed' and r.get('pid') == pid for r in native) == 1,
               'Missing/duplicate native mount observer installation')
    for pid in {r.get('pid') for r in javascript}:
        expect(sum(r.get('phase') == 'installed' and r.get('pid') == pid for r in javascript) == 1,
               'Missing/duplicate JS opt-in installation')
    identities = [r for r in native if r.get('phase') == 'runtime.identity']
    identity_pids = []
    for row in identities:
        pid = row.get('pid')
        expect(pid not in identity_pids, 'Duplicate application runtime identity')
        identity_pids.append(pid)
        expect(all(row.get(k) == metadata['builtApp'][k] for k in ['executableSHA256', 'jsBundleSHA256']),
               'Actual running app binary/JS differs from compiled artifact')
    observed_pids = {r.get('pid') for r in native + javascript}
    expect(observed_pids == set(identity_pids), 'Missing actual running-app identity for a traced process')
    ups = [r for r in native if r.get('phase') == 'touch.up.dispatched']
    expect(len(ups) >= 100, 'Insufficient actual app native UP dispatch coverage')
    for row in ups:
        times = [row.get('touchTimestampMs'), row.get('dispatchBegin'), row.get('dispatchReturned'), row.get('uptime')]
        expect(all(finite(t) for t in times) and times[0] / 1000 <= times[1] <= times[2] <= times[3] and
               finite(row.get('x')) and finite(row.get('y')) and isinstance(row.get('identifiers'), list) and
               all(isinstance(v, str) for v in row['identifiers']), 'Invalid actual UP dispatch timing/target')
    expect(len({(r.get('pid'), r.get('gesture')) for r in ups}) == len(ups) and
           all(type(r.get('gesture')) is int and r['gesture'] > 0 for r in ups), 'Duplicate/invalid native UP gesture identity')
    presses = [r for r in javascript if r.get('phase') == 'onPress.begin']
    ends = [r for r in javascript if r.get('phase') == 'onPress.end']
    associations = []
    completed_handlers = {}
    for pid in observed_pids:
        active = None
        for row in [r for r in javascript if r.get('pid') == pid and r.get('phase') in ['onPress.begin', 'onPress.end']]:
            if row['phase'] == 'onPress.begin':
                expect(active is None and row.get('role') in roles, 'Overlapping or unknown selected JS handler')
                active = row
            else:
                expect(active is not None and active.get('role') == row.get('role'), 'Unpaired original JS handler completion')
                if active is not None and active.get('role') == row.get('role'):
                    completed_handlers[(pid, active.get('sequence'))] = row
                active = None
        expect(active is None, 'Original selected JS handler has no completion')
    truncated_windows = []
    exited_pids = {int(m[1]) for m in re.finditer(
        r'\[app<teleport\.example[^]\n]*?:(\d+)\][^\n]*(?:Process exited:|exited with context)', text)}
    for role in roles:
        selected = [r for r in presses if r.get('role') == role]
        expect(len(selected) == {'go_next': 1, 'persisted_portal_toggle_host': 3}[role],
               f'Original flow selected-handler coverage differs for {role}')
        for press in selected:
            stamp = press.get('touchTimestampMs')
            matches = [r for r in ups if r.get('pid') == press.get('pid') and role in r.get('identifiers', []) and
                       finite(stamp) and abs(r['touchTimestampMs'] - stamp) <= 0.001]
            expect(len(matches) == 1, f'JS {role} lacks one exact native-UP timestamp/target')
            end = completed_handlers.get((press.get('pid'), press.get('sequence')))
            expect(end is not None, f'Original {role} handler completion trace missing')
            if len(matches) == 1:
                up = matches[0]
                expect(finite(press.get('x')) and finite(press.get('y')) and
                       abs(up['x'] - press['x']) <= 1.5 and abs(up['y'] - press['y']) <= 1.5,
                       f'JS/native {role} coordinates differ')
                associations.append({'role': role, 'pid': press['pid'], 'gesture': up.get('gesture'),
                    'touchTimestampMs': stamp, 'nativeDispatchReturnedUptime': up['dispatchReturned'],
                    'nativeRecordWallTimeMs': up['wallTimeMs'], 'jsOnPressWallTimeMs': press['wallTimeMs'],
                    'jsOnPressMonotonicMs': press['monotonicMs']})
        begins = [r for r in native if r.get('phase') == 'presentation.begin' and r.get('role') == role]
        expect(bool(begins), f'Missing bounded native presentation observation for {role}')
        for begin in begins:
            same = [r for r in native if r.get('pid') == begin.get('pid') and r.get('gesture') == begin.get('gesture')]
            expect(sum(r.get('pid') == begin.get('pid') and r.get('gesture') == begin.get('gesture') and
                       role in r.get('identifiers', []) for r in ups) == 1, 'Presentation window lacks the selected original UP')
            samples = [r for r in same if r.get('phase') == 'presentation.sample']
            expect([r.get('sample') for r in samples] == list(range(1, len(samples) + 1)) and len(samples) <= 512,
                   'Missing/duplicate/out-of-bound presentation samples')
            terminal = [r for r in same if r.get('phase') == 'presentation.end']
            if not terminal and begin.get('pid') in exited_pids and samples:
                truncated_windows.append({'pid': begin['pid'], 'gesture': begin['gesture'], 'role': role,
                                          'reason': 'Original app process exit observed; sampling window truncated'})
            else:
                expect(bool(samples) and len(terminal) == 1 and terminal[0].get('reason') in ['window.end', 'superseded'] and
                       terminal[0].get('samples') == len(samples),
                       'Native presentation observation incomplete or exceeded its bound')
            for sample in samples:
                expect(finite(sample.get('displayLinkTimestamp')) and finite(sample.get('targetTimestamp')) and
                       sample['displayLinkTimestamp'] <= sample['targetTimestamp'] and isinstance(sample.get('layers'), list),
                       'Invalid native presentation sampling clock/layers')
                for layer in sample.get('layers', []):
                    values = layer.get('frame') if isinstance(layer, dict) else None
                    expect(isinstance(values, list) and len(values) == 4 and
                           all(type(v) in (float, int) and math.isfinite(v) for v in values) and
                           type(layer.get('presentationLayer')) is bool,
                           'Invalid native presentation-layer frame evidence')
    expect(len(presses) == len(ends), 'Missing/duplicate JS handler completion')
    selected_ups = {(r['pid'], r['gesture']) for r in ups if any(role in r.get('identifiers', []) for role in roles)}
    linked_ups = [(r['pid'], r['gesture']) for r in associations]
    expect(set(linked_ups) == selected_ups and len(linked_ups) == len(set(linked_ups)),
           'Selected native UP and original JS handler delivery are not one-to-one')
    for row in native:
        if row.get('phase') in ['fabric.willMount', 'fabric.didMount']:
            expect(type(row.get('rootTag')) is int and row['rootTag'] > 0, 'Invalid native Fabric root identity')
    for row in javascript:
        if row.get('phase') == 'react.layoutEffect':
            expect(isinstance(row.get('state'), dict), 'Invalid React layout-effect state')
        if row.get('role') == 'persisted.portal' and row.get('phase') == 'react.layoutEffect':
            state = row.get('state', {})
            expect(type(state.get('hostMounted')) is bool and type(state.get('toggleCount')) is int and
                   state['toggleCount'] >= 0, 'Invalid persisted-portal React state')
    for role in ['lifecycle.screen1', 'lifecycle.screen2', 'persisted.portal']:
        expect(any(r.get('phase') == 'react.layoutEffect' and r.get('role') == role for r in javascript),
               f'Missing actual React layout-effect coverage: {role}')
    portal_states = [r.get('state') for r in javascript if r.get('phase') == 'react.layoutEffect' and r.get('role') == 'persisted.portal']
    for state in [{'hostMounted': False, 'toggleCount': 0}, {'hostMounted': True, 'toggleCount': 1},
                  {'hostMounted': False, 'toggleCount': 2}, {'hostMounted': True, 'toggleCount': 3}]:
        expect(state in portal_states, 'Original persisted-portal state transition coverage missing')
    for phase in ['fabric.willMount', 'fabric.didMount']:
        expect(any(r.get('phase') == phase for r in native), f'Missing actual native mount observation: {phase}')
    for phase in ['navigation.transitionStart.received', 'navigation.transitionEnd.received']:
        expect(any(r.get('phase') == phase and type(r.get('closing')) is bool and
                   r.get('role') == 'NAVIGATION_LIFECYCLE_NESTED' for r in javascript),
               f'Missing actual nested native-stack JS event delivery: {phase}')
    return {'version': 1, 'profile': 'indigo-visual-touch-trace', 'sourceSHA': metadata['sourceSHA'],
            'nativeRecords': native, 'jsRecords': javascript, 'runtimeProcesses': identity_pids,
            'nativeUps': len(ups), 'selectedPressAssociations': associations,
            'processExitTruncatedWindows': truncated_windows, 'errors': errors,
            'final_stability_credit': False,
            'limit': 'Event dispatch, JS callbacks, React layout effects, native mounts and presentation-layer samples are separate observations. They are not physical display transaction IDs. Logging/sampling can perturb scheduling; diagnostic only.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--artifact', type=Path, required=True)
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--device', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    metadata = source_audit(args.artifact, args.candidate)
    result = check(args.log.read_text(), metadata, args.device)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ['nativeRecords', 'jsRecords']}))
    raise SystemExit(bool(result['errors']))


if __name__ == '__main__':
    main()
