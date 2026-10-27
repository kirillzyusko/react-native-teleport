"""Raw positive/negative gates using the device-free compiled native helper."""
import importlib.util
import json
import os
from pathlib import Path
import unittest

SCRIPTS = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('idle_checker', SCRIPTS / 'check-ios-idle-observe.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
FIXTURE = Path(os.environ.get('MAESTRO_IDLE_FIXTURE_OUTPUT', ''))
DEVICE = '00000000-0000-0000-0000-000000000001'
ROUTE = '[FlyingFox] <127.0.0.1> request: POST /touch\n'


class RawContracts(unittest.TestCase):
    def records(self, mode='sync'):
        return checker.parse((FIXTURE / f'{mode}.stderr').read_text())

    def checked(self, records, frames=None):
        return checker.check(records, ROUTE, DEVICE, frames or [], minimum_inputs=1)

    def test_actual_compiled_native_nil_callbacks_and_synchronous_order_pass(self):
        result = self.checked(self.records())
        self.assertEqual(result['errors'], [])
        self.assertEqual(result['inputs'], 1)
        self.assertEqual(len(result['callbacks']), 2)

    def test_delayed_callbacks_and_static_correlation_are_observation_only(self):
        records = self.records('deferred')
        item = next(r for r in records if r['event'] == 'input_complete')
        returns = [r['uptime'] for r in records if r['event'] == 'registration_return']
        replies = [r['uptime'] for r in records if r['event'] == 'callback']
        middle = (max(returns) + min(replies)) / 2
        frame = {'route': 'isScreenStatic', 'isScreenStatic': True, 'sequence': 9,
                 'begin': item['uptime'], 'ready': middle}
        result = self.checked(records, [frame])
        self.assertEqual(result['errors'], [])
        self.assertEqual(set(result['staticTrueWhileNotificationPending'][0]['pendingKinds']), {'eventLoop', 'animations'})
        self.assertIs(result['final_stability_credit'], False)

    def test_completed_callbacks_do_not_imply_a_presented_frame(self):
        records = self.records('deferred')
        end = records[-1]['uptime'] + 1
        result = self.checked(records, [{'route': 'isScreenStatic', 'isScreenStatic': True,
                                        'sequence': 10, 'begin': end, 'ready': end + 0.1}])
        self.assertEqual(result['errors'], [])
        self.assertEqual(result['staticTrueWhileNotificationPending'], [])
        self.assertIn('not display transaction', result['limit'])

    def test_native_non_nil_errors_are_rejected(self):
        self.assertTrue(self.checked(self.records('error'))['errors'])

    def test_registration_exception_is_not_synthesized_into_success(self):
        self.assertTrue(self.checked(self.records('throw'))['errors'])

    def test_unsupported_abi_is_rejected(self):
        self.assertTrue(self.checked(self.records('wrongEncoding'))['errors'])

    def test_duplicate_callback_is_rejected(self):
        self.assertTrue(self.checked(self.records('duplicate'))['errors'])

    def test_missing_cached_application_is_rejected(self):
        self.assertTrue(self.checked(self.records('missingProcess'))['errors'])

    def test_wrong_simulator_is_rejected(self):
        records = self.records()
        records[0]['simulatorUDID'] = '00000000-0000-0000-0000-000000000002'
        self.assertTrue(self.checked(records)['errors'])

    def test_wrong_loaded_xctest_identity_is_rejected(self):
        records = self.records()
        next(r for r in records if r['event'] == 'registration_begin')['frameworkUUID'] = '00000000-0000-0000-0000-000000000000'
        self.assertTrue(self.checked(records)['errors'])

    def test_unknown_callback_kind_is_rejected_even_with_both_required_replies(self):
        records = self.records()
        extra = dict(next(r for r in records if r['event'] == 'callback'))
        extra.update(sequence=len(records) + 1, kind='other', uptime=records[-1]['uptime'] + 0.01)
        records.append(extra)
        self.assertTrue(self.checked(records)['errors'])

    def test_boolean_generation_is_not_an_integer_identity(self):
        records = self.records()
        for r in records:
            if 'generation' in r:
                r['generation'] = True
        self.assertTrue(self.checked(records)['errors'])

    def test_deferred_replies_follow_original_process_across_context_replacement(self):
        result = checker.check(self.records('replaceProcess'), ROUTE + ROUTE.replace('/touch', '/swipeV2'),
                               DEVICE, [], minimum_inputs=2)
        self.assertEqual(result['errors'], [])
        self.assertEqual(len(result['callbacks']), 4)

    def test_runtime_helper_source_must_match(self):
        records = self.records()
        records[0]['sourceSHA'] = '0' * 64
        self.assertTrue(self.checked(records)['errors'])

    def test_every_http_gesture_kind_and_order_must_match(self):
        records = self.records()
        next(r for r in records if r['event'] == 'input_complete')['route'] = 'swipeV2'
        self.assertTrue(self.checked(records)['errors'])

    def test_actual_boolean_cannot_be_replaced_by_integer(self):
        records = self.records()
        next(r for r in records if r['event'] == 'callback')['errorIsNil'] = 1
        self.assertTrue(self.checked(records)['errors'])

    def test_missing_or_wrong_process_reply_is_rejected(self):
        records = self.records()
        next(r for r in records if r['event'] == 'callback')['pid'] = 999
        self.assertTrue(self.checked(records)['errors'])
        records = self.records()
        records = [r for r in records if not (r['event'] == 'callback' and r['kind'] == 'animations')]
        self.assertTrue(self.checked(records)['errors'])

    def test_regressed_timestamp_is_rejected(self):
        records = self.records()
        records[-1]['uptime'] = records[0]['uptime'] - 1
        self.assertTrue(self.checked(records)['errors'])

    def test_old_untraced_evidence_cannot_pass(self):
        self.assertTrue(checker.check([], ROUTE, DEVICE, [])['errors'])

    def test_source_audit_of_actual_prepared_archive(self):
        artifact = Path(os.environ['MAESTRO_IDLE_SOURCE_ARTIFACT'])
        self.assertEqual(checker.source_audit(artifact), [])
        metadata = json.loads((artifact / 'maestro-ios-input.json').read_text())
        self.assertEqual(metadata['idle_observation']['helper_sha256'], checker.SOURCE.helper_hash())


if __name__ == '__main__':
    unittest.main()
