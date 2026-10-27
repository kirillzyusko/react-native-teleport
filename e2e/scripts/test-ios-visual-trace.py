"""Synthetic raw-gate controls; these do not represent device verification."""
import base64
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('visual_gate', Path(__file__).with_name('check-ios-visual-trace.py'))
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)
META = {'sourceSHA': 'a' * 64, 'helperSourceHashes': {'native': 'b' * 64, 'js': 'c' * 64},
        'builtApp': {'executableSHA256': 'd' * 64, 'jsBundleSHA256': 'e' * 64}}


def fixture():
    native, javascript = [], []
    def add(phase, values=None, js=False):
        rows = javascript if js else native
        sequence = len(rows) + 1
        time = 100 + sequence / 10
        row = {'version': 1, 'phase': phase, 'sourceSHA': META['sourceSHA'],
               'helperSHA': META['helperSourceHashes']['js' if js else 'native'],
               'pid': 42, 'simulatorUDID': 'fixture', 'wallTimeMs': 1700000000000 + time * 1000,
               'sequence': sequence, 'monotonicMs' if js else 'uptime': time}
        row.update(values or {})
        rows.append(row)
        return row
    add('installed')
    add('mount.observer.installed')
    for number in range(104):
        role = 'go_next' if number == 100 else 'persisted_portal_toggle_host' if number > 100 else None
        row = add('touch.up.dispatched', {'gesture': number + 1, 'x': 201, 'y': 194,
                                        'identifiers': [role] if role else []})
        row.update(touchTimestampMs=(row['uptime'] - 0.01) * 1000,
                   dispatchBegin=row['uptime'] - 0.005, dispatchReturned=row['uptime'] - 0.001)
    identity = dict(native[0], phase='runtime.identity', **META['builtApp'])
    identity.pop('sequence')
    native.insert(0, identity)
    add('installed', js=True)
    for up in [r for r in native if r.get('identifiers')]:
        role = up['identifiers'][0]
        add('onPress.begin', {'role': role, 'touchTimestampMs': up['touchTimestampMs'], 'x': 201, 'y': 194}, js=True)
        add('onPress.end', {'role': role}, js=True)
        add('presentation.begin', {'role': role, 'gesture': up['gesture']})
        add('fabric.willMount', {'rootTag': 1})
        add('fabric.didMount', {'rootTag': 1})
        row = add('presentation.sample', {'role': role, 'gesture': up['gesture'], 'sample': 1,
            'layers': [{'index': 0, 'frame': [-20, 0, 402, 874], 'presentationLayer': True}]})
        row.update(displayLinkTimestamp=row['uptime'], targetTimestamp=row['uptime'] + 0.016)
        add('presentation.end', {'role': role, 'gesture': up['gesture'], 'samples': 1, 'reason': 'window.end'})
    # Runtime identity is unnumbered; the producer's other sequences remain contiguous.
    for sequence, row in enumerate([r for r in native if r['phase'] != 'runtime.identity'], 1):
        row['sequence'] = sequence
    for role in ['lifecycle.screen1', 'lifecycle.screen2', 'persisted.portal']:
        add('react.layoutEffect', {'role': role, 'state': {'hostMounted': False, 'toggleCount': 0} if role == 'persisted.portal' else {}}, js=True)
    for count in [1, 2, 3]:
        add('react.layoutEffect', {'role': 'persisted.portal', 'state': {'hostMounted': count % 2 == 1, 'toggleCount': count}}, js=True)
    for phase in ['navigation.transitionStart.received', 'navigation.transitionEnd.received']:
        add(phase, {'role': 'NAVIGATION_LIFECYCLE_NESTED', 'closing': False}, js=True)
    return native, javascript


def text(native, javascript):
    return '\n'.join(f'[teleport-visual-{kind}] ' + json.dumps(r) for kind, rows in
                     [('native', native), ('js', javascript)] for r in rows)


class RawGateControls(unittest.TestCase):
    def test_positive_raw_model_and_no_final_credit(self):
        result = CHECK.check(text(*fixture()), META, 'fixture')
        self.assertEqual(result['errors'], [])
        self.assertEqual(len(result['selectedPressAssociations']), 4)
        self.assertFalse(result['final_stability_credit'])

    def test_distinct_identity_coverage_and_clock_failures(self):
        cases = {
            'wrong_device': lambda n, j: n[4].update(simulatorUDID='wrong'),
            'wrong_source': lambda n, j: j[0].update(sourceSHA='f' * 64),
            'wrong_native_helper': lambda n, j: n[0].update(helperSHA='f' * 64),
            'wrong_js_helper': lambda n, j: j[0].update(helperSHA='f' * 64),
            'wrong_binary': lambda n, j: n[0].update(executableSHA256='f' * 64),
            'missing_identity': lambda n, j: n.pop(0),
            'duplicate_sequence': lambda n, j: n[4].update(sequence=1),
            'missing_up_target': lambda n, j: next(r for r in n if 'go_next' in r.get('identifiers', [])).update(identifiers=[]),
            'wrong_touch_time': lambda n, j: next(r for r in j if r['phase'] == 'onPress.begin').update(touchTimestampMs=1),
            'missing_js_end': lambda n, j: j.remove(next(r for r in j if r['phase'] == 'onPress.end')),
            'unknown_phase': lambda n, j: n[-1].update(phase='made.up'),
            'overflow': lambda n, j: n[-1].update(phase='buffer.overflow'),
            'missing_mount': lambda n, j: [r.update(phase='fabric.willMount') for r in n if r['phase'] == 'fabric.didMount'],
            'missing_layout': lambda n, j: next(r for r in j if r.get('role') == 'lifecycle.screen2').update(role='wrong'),
            'missing_transition_end': lambda n, j: j[-1].update(phase='navigation.transitionStart.received'),
            'invalid_layer': lambda n, j: next(r for r in n if r['phase'] == 'presentation.sample')['layers'][0].update(frame=[float('nan'), 0, 1, 1]),
            'invalid_up_clock': lambda n, j: n[4].update(dispatchReturned=-1),
            'backwards_js_clock': lambda n, j: j[-1].update(monotonicMs=1),
            'duplicate_up_id': lambda n, j: n[4].update(gesture=1),
            'wrong_root': lambda n, j: next(r for r in n if r['phase'] == 'fabric.didMount').update(rootTag='1'),
            'missing_last_portal_state': lambda n, j: next(r for r in j if r.get('state', {}).get('toggleCount') == 3).update(state={'hostMounted': True, 'toggleCount': 2}),
            'wrong_portal_state': lambda n, j: next(r for r in j if r.get('role') == 'persisted.portal').update(state={'hostMounted': 1}),
            'wrong_end_role': lambda n, j: next(r for r in j if r['phase'] == 'onPress.end').update(role='persisted_portal_toggle_host'),
            'missing_install': lambda n, j: n[1].update(phase='mount.observer.installed'),
            'missing_js': lambda n, j: j.clear(),
        }
        for label, mutate in cases.items():
            with self.subTest(label=label):
                native, javascript = fixture()
                mutate(native, javascript)
                self.assertTrue(CHECK.check(text(native, javascript), META, 'fixture')['errors'])

    def test_truncated_sampling_requires_original_app_exit_evidence(self):
        native, javascript = fixture()
        terminal = next(r for r in native if r['phase'] == 'presentation.end')
        native.remove(terminal)
        for sequence, row in enumerate([r for r in native if r['phase'] != 'runtime.identity'], 1):
            row['sequence'] = sequence
        self.assertTrue(CHECK.check(text(native, javascript), META, 'fixture')['errors'])
        raw = text(native, javascript) + '\nrunningboardd process [app<teleport.example((null))>:42] exited with context <original force-quit>'
        result = CHECK.check(raw, META, 'fixture')
        self.assertEqual(result['errors'], [])
        self.assertEqual(len(result['processExitTruncatedWindows']), 1)

    def test_native_chunk_bytes_and_negative_envelopes(self):
        native, _ = fixture()
        row = native[3]
        data = json.dumps(row).encode()
        encoded = base64.b64encode(data).decode()
        parts = [encoded[i:i + 512] for i in range(0, len(encoded), 512)]
        records = [{'version': 1, 'pid': 42, 'recordSHA256': hashlib.sha256(data).hexdigest(),
                    'part': i, 'parts': len(parts), 'payload': value} for i, value in enumerate(parts)]
        encode = lambda rows: '\n'.join('[teleport-visual-native-chunk] ' + json.dumps(r) for r in rows)
        result = CHECK.parse_log(encode(records))
        self.assertEqual(result['native'], [row])
        self.assertEqual(result['errors'], [])
        bad = copy.deepcopy(records)
        bad[0]['payload'] = 'A' + bad[0]['payload'][1:]
        self.assertTrue(CHECK.parse_log(encode(bad))['errors'])
        self.assertTrue(CHECK.parse_log(encode(records[:-1]))['errors'])
        self.assertTrue(CHECK.parse_log(encode(records + records))['errors'])
        bad = copy.deepcopy(records)
        bad[-1]['pid'] = 43
        self.assertTrue(CHECK.parse_log(encode(bad))['errors'])


if __name__ == '__main__':
    unittest.main()
