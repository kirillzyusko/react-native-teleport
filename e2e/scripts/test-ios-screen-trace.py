"""Positive/negative raw response controls; uses the actual compiled mock trace."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('screen_check', HERE / 'check-ios-screen-trace.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class RawTrace(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixture = Path(os.environ.get('MAESTRO_SCREEN_FIXTURE', str(HERE.parents[1] / 'example/ios/build/maestro-input/frame-trace-runtime')))
        actual = json.loads((fixture / 'report.json').read_text())['trace_records']
        # Two real mock static results plus twenty synthetic screenshot requests
        # reuse the compiled handler's actual body identities for full gate coverage.
        cls.records = [copy.deepcopy(r) for r in actual[:2] + actual[2:] * 10]
        for index, record in enumerate(cls.records):
            record['sequence'] = index + 1
            for key in ['begin', 'firstCaptured', 'secondCaptured', 'captured', 'ready']:
                if key in record:
                    record[key] += index * 10
        cls.log = '\n'.join(f'[FlyingFox] request: GET /{r["route"]}' for r in cls.records)
        cls.images = [(f'flow{i}/takeScreenshot/e2e/frame.png', b'synthetic-frame-a') for i in range(20)]

    def check(self, records=None, log=None, images=None):
        return checker.check(records if records is not None else self.records,
                             log if log is not None else self.log,
                             images if images is not None else self.images, minimum_static=2)

    def test_actual_compiled_mock_responses_and_body_hashes(self):
        self.assertEqual(self.check()['errors'], [])
        self.assertEqual(self.check()['native_static_true'], 1)
        self.assertEqual(self.check()['native_static_false'], 1)
        self.assertIs(self.check()['final_stability_credit'], False)

    def test_missing_duplicate_or_wrong_route_records_fail(self):
        for records in [self.records[1:], self.records + self.records[:1], self.records[::-1]]:
            with self.subTest(records=records):
                self.assertTrue(self.check(records=records)['errors'])
        self.assertTrue(self.check(log=self.log + '\n[FlyingFox] request: GET /screenshot')['errors'])

    def test_static_response_must_match_both_original_hashes(self):
        for field, value in [('isScreenStatic', False), ('firstHash', 'a' * 64), ('version', 0), ('ready', -1)]:
            records = copy.deepcopy(self.records)
            records[0][field] = value
            with self.subTest(field=field):
                self.assertTrue(self.check(records=records)['errors'])

    def test_actual_takeScreenshot_bytes_must_have_uncompressed_native_identity(self):
        self.assertTrue(self.check(images=self.images[:-1] + [('changed.png', b'wrong bytes')])['errors'])
        self.assertTrue(self.check(images=[])['errors'])
        records = copy.deepcopy(self.records)
        
        for record in records[2:]:
            record['compressed'] = True
        self.assertTrue(self.check(records=records)['errors'])

    def test_old_untraced_log_cannot_masquerade_as_native_responses(self):
        self.assertTrue(self.check(records=[])['errors'])
        with self.assertRaises(json.JSONDecodeError):
            checker.parse('[teleport-screen-trace] {truncated')


if __name__ == '__main__':
    unittest.main()
