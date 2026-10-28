"""Positive and negative controls for passive UIKit navigation raw evidence."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('native_navigation_gate', Path(__file__).with_name('check-ios-native-navigation.py'))
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)
META = {'sourceSHA': 'a' * 64, 'helperSourceHashes': {'native': 'b' * 64}}


def fixture():
    object_id = lambda n: {'id': str(n), 'class': 'FixtureController'}
    state = {'version': 1, 'navigation': object_id(1), 'stack': [object_id(2), object_id(3)],
             'top': object_id(3), 'visible': object_id(3), 'observedBegin': 100.01, 'observedEnd': 100.02,
             'coordinator': {'identity': object_id(4), 'animated': True, 'interactive': False,
                             'initiallyInteractive': False, 'cancelled': False, 'duration': 0.4,
                             'percentComplete': 0.2, 'from': object_id(2), 'to': object_id(3)}}
    base = {'version': 1, 'pid': 42, 'simulatorUDID': 'fixture', 'sourceSHA': META['sourceSHA'],
            'helperSHA': META['helperSourceHashes']['native'], 'wallTimeMs': 100000, 'uptime': 100.03, 'gesture': 1}
    return [{**base, 'phase': 'touch.up.dispatched', 'identifiers': ['go_next']},
            {**base, 'phase': 'presentation.sample', 'role': 'go_next', 'sample': 1, 'nativeNavigation': state}]


def raw(rows):
    return '\n'.join('[teleport-visual-native] ' + json.dumps(row) for row in rows)


class NavigationControls(unittest.TestCase):
    def test_active_and_nil_are_observations_only(self):
        rows = fixture()
        result = CHECK.audit(raw(rows), META, 'fixture')
        self.assertEqual(result['errors'], [])
        self.assertEqual((result['selectedGestures'], result['samples'], result['coordinatorPresentSamples']), (1, 1, 1))
        self.assertFalse(result['final_stability_credit'])
        rows[1]['nativeNavigation']['coordinator'] = None
        result = CHECK.audit(raw(rows), META, 'fixture')
        self.assertEqual(result['errors'], [])
        self.assertEqual(result['coordinatorPresentSamples'], 0)
        self.assertIn('not an idle certificate', result['limit'])

    def test_distinct_raw_failures_remain_fatal(self):
        cases = {
            'missing_field': lambda r: r[1].pop('nativeNavigation'),
            'wrong_field_type': lambda r: r[1].update(nativeNavigation=[]),
            'producer_error': lambda r: r[1].update(nativeNavigation={'version': 1, 'error': 'missing context'}),
            'extra_field': lambda r: r[1]['nativeNavigation'].update(unexpected=1),
            'wrong_version': lambda r: r[1]['nativeNavigation'].update(version=True),
            'wrong_source': lambda r: r[1].update(sourceSHA='c' * 64),
            'wrong_helper': lambda r: r[1].update(helperSHA='c' * 64),
            'wrong_device': lambda r: r[1].update(simulatorUDID='other'),
            'wrong_process': lambda r: r[1].update(pid=43),
            'wrong_gesture': lambda r: r[1].update(gesture=2),
            'missing_up': lambda r: r.pop(0),
            'duplicate_up': lambda r: r.append(copy.deepcopy(r[0])),
            'missing_sample': lambda r: r.pop(1),
            'sample_gap': lambda r: r[1].update(sample=2),
            'sample_bool': lambda r: r[1].update(sample=True),
            'negative_time': lambda r: r[1]['nativeNavigation'].update(observedBegin=-1),
            'reversed_time': lambda r: r[1]['nativeNavigation'].update(observedBegin=101),
            'late_time': lambda r: r[1]['nativeNavigation'].update(observedEnd=101),
            'infinite_time': lambda r: r[1]['nativeNavigation'].update(observedEnd=float('inf')),
            'missing_navigation': lambda r: r[1]['nativeNavigation'].update(navigation=None),
            'zero_pointer': lambda r: r[1]['nativeNavigation']['navigation'].update(id='0'),
            'wide_pointer': lambda r: r[1]['nativeNavigation']['navigation'].update(id='a' * 17),
            'extra_identity_key': lambda r: r[1]['nativeNavigation']['navigation'].update(extra=1),
            'wide_class': lambda r: r[1]['nativeNavigation']['navigation'].update(**{'class': 'a' * 257}),
            'control_in_class': lambda r: r[1]['nativeNavigation']['navigation'].update(**{'class': 'bad\nclass'}),
            'stack_type': lambda r: r[1]['nativeNavigation'].update(stack='wrong'),
            'stack_bound': lambda r: r[1]['nativeNavigation'].update(stack=[{'id': str(n), 'class': 'C'} for n in range(1, 18)]),
            'stack_duplicate': lambda r: r[1]['nativeNavigation']['stack'].append(copy.deepcopy(r[1]['nativeNavigation']['stack'][0])),
            'top_wrong': lambda r: r[1]['nativeNavigation'].update(top=None),
            'visible_malformed': lambda r: r[1]['nativeNavigation'].update(visible=1),
            'coordinator_type': lambda r: r[1]['nativeNavigation'].update(coordinator=False),
            'coordinator_extra': lambda r: r[1]['nativeNavigation']['coordinator'].update(extra=True),
            'coordinator_flag': lambda r: r[1]['nativeNavigation']['coordinator'].update(animated=1),
            'coordinator_identity': lambda r: r[1]['nativeNavigation']['coordinator'].update(identity=None),
            'coordinator_from': lambda r: r[1]['nativeNavigation']['coordinator'].update(**{'from': {}}),
            'coordinator_to': lambda r: r[1]['nativeNavigation']['coordinator'].update(to='wrong'),
            'negative_duration': lambda r: r[1]['nativeNavigation']['coordinator'].update(duration=-1),
            'nan_progress': lambda r: r[1]['nativeNavigation']['coordinator'].update(percentComplete=float('nan')),
            'progress_bound': lambda r: r[1]['nativeNavigation']['coordinator'].update(percentComplete=1.01),
            'wrong_scope': lambda r: r[1].update(role='persisted_portal_toggle_host'),
            'malformed_json': lambda r: None,
        }
        for name, mutate in cases.items():
            with self.subTest(name=name):
                rows = fixture()
                mutate(rows)
                text = raw(rows) + ('\n[teleport-visual-native] {' if name == 'malformed_json' else '')
                self.assertTrue(CHECK.audit(text, META, 'fixture')['errors'])

    def test_context_change_and_duplicate_sample_rejected(self):
        rows = fixture()
        rows.append(copy.deepcopy(rows[1]))
        self.assertTrue(CHECK.audit(raw(rows), META, 'fixture')['errors'])
        rows[2]['sample'] = 2
        rows[2]['nativeNavigation']['navigation']['id'] = '9'
        self.assertTrue(CHECK.audit(raw(rows), META, 'fixture')['errors'])


if __name__ == '__main__':
    unittest.main()
