"""Pinned-source and device-free native idle callback ownership/ABI controls."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest

SCRIPTS = Path(__file__).resolve().parent
REPO = SCRIPTS.parents[1]
SOURCE = REPO / 'example/ios/build/maestro-input/source'
spec = importlib.util.spec_from_file_location('idle_source', SCRIPTS / 'maestro-ios-idle-observe.py')
idle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(idle)


def original(name):
    data = (SOURCE / name).read_bytes()
    if idle.blob(data) != idle.PINNED[name]:
        artifact = Path(os.environ.get('MAESTRO_INPUT_SOURCE_ARTIFACT', str(SOURCE.parent / 'artifact')))
        data = (artifact / f'idle-{Path(name).name}.original').read_bytes()
    assert idle.blob(data) == idle.PINNED[name]
    return data


def physical(data):
    output = []
    condition = None
    for line in data.decode().splitlines(keepends=True):
        if line.strip() in ['#if TARGET_OS_SIMULATOR', '#if targetEnvironment(simulator)']:
            assert condition is None
            condition = 'simulator'
        elif line.strip() == '#else':
            assert condition == 'simulator'
            condition = 'physical'
        elif line.strip() == '#endif':
            assert condition in ['simulator', 'physical']
            condition = None
        elif condition != 'simulator':
            output.append(line)
    assert condition is None
    return ''.join(output).encode()


class SourceContracts(unittest.TestCase):
    def test_exact_source_pins_reject_unrecognized_and_double_patches(self):
        for name in idle.PINNED:
            raw = original(name)
            with self.assertRaises(ValueError):
                idle.patch(name, raw + b'\n')
            with self.assertRaises(ValueError):
                idle.patch(name, idle.patch(name, raw))

    def test_physical_sources_remain_byte_identical(self):
        for name in idle.PINNED:
            raw = original(name)
            self.assertEqual(physical(idle.patch(name, raw)), raw)

    def test_original_hierarchy_supplies_context_without_another_foreground_query(self):
        raw = original(idle.HIERARCHY)
        patched = idle.patch(idle.HIERARCHY, raw)
        self.assertEqual(patched.count(b'getForegroundApp()'), raw.count(b'getForegroundApp()'))
        self.assertEqual(patched.count(b'TeleportIdleRememberApplication(foregroundApp)'), 1)
        self.assertGreater(patched.index(b'TeleportIdleRememberApplication'), patched.index(b'let appViewHierarchy = try await'))

    def test_original_handler_and_response_are_preserved_without_awaiting_callbacks(self):
        helper = (idle.HELPERS / 'IdleObserve.swift').read_text()
        self.assertEqual(helper.count('try await handler.handleRequest(request)'), 1)
        self.assertLess(helper.index('try await handler.handleRequest'), helper.index('TeleportIdleObserveInput'))
        self.assertLess(helper.index('TeleportIdleObserveInput'), helper.index('return response'))
        native = idle.native_helper().decode()
        self.assertNotIn('__TELEPORT_IDLE_SOURCE_SHA__', native)
        for forbidden in ['dispatch_semaphore_wait(', 'dispatch_group_wait(', 'sleep(', 'activeAppsInfo(', 'launch(']:
            self.assertNotIn(forbidden, native)
        self.assertIn('v24@0:8@?16', native)
        self.assertIn('typedef void (^TeleportIdleReply)(NSError *error)', native)

    def test_install_rejects_wrong_observation_profile_before_reading_sdk(self):
        spec = importlib.util.spec_from_file_location('input_builder', SCRIPTS / 'maestro-ios-input.py')
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        for observed, expected in [(False, True), (True, False)]:
            with tempfile.TemporaryDirectory(prefix='teleport-idle-profile-') as tmp:
                folder = Path(tmp)
                metadata = {'status': 'built', 'source_commit': builder.SOURCE_COMMIT,
                            'lead_in_seconds': 0, 'backend': 'indigo', 'frame_trace': {'version': 1}}
                if observed:
                    metadata['idle_observation'] = {'version': 1}
                (folder / 'maestro-ios-input.json').write_text(json.dumps(metadata))
                args = SimpleNamespace(jar=folder / 'absent.jar', artifact=folder, expected_lead_in='0',
                    expected_backend='indigo', expected_frame_trace=True, expected_idle_observation=expected)
                with self.assertRaisesRegex(RuntimeError, 'idle-observation profile does not match'):
                    builder.install(args)


class NativeContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix='teleport-idle-native-')
        cls.folder = Path(os.environ.get('MAESTRO_IDLE_FIXTURE_OUTPUT', cls.temporary.name))
        cls.folder.mkdir(parents=True, exist_ok=True)
        template = (idle.HELPERS / 'IdleObserveFixture.m').read_text()
        source = template.replace('__TELEPORT_IDLE_NATIVE_HELPER__', idle.native_helper().decode())
        file = cls.folder / 'fixture.m'
        file.write_text(source)
        cls.executable = cls.folder / 'fixture'
        result = subprocess.run(['xcrun', 'clang', '-fobjc-arc', '-fblocks',
            '-Wall', '-Wextra', '-Werror', '-framework', 'Foundation', str(file), '-o', str(cls.executable)],
            capture_output=True, text=True)
        (cls.folder / 'compile.log').write_text(result.stdout + result.stderr)
        if result.returncode:
            raise RuntimeError(result.stderr)
        cls.receipts = []

    @classmethod
    def tearDownClass(cls):
        (cls.folder / 'report.json').write_text(json.dumps({'native_source_sha': idle.helper_hash(),
            'cases': cls.receipts, 'device_API_calls': 0, 'fixture_processes_remaining': 0}, indent=2) + '\n')
        cls.temporary.cleanup()

    def run_case(self, mode):
        result = subprocess.run([str(self.executable), mode], capture_output=True, text=True, check=True,
                                timeout=10, env={**os.environ, 'SIMULATOR_UDID': '00000000-0000-0000-0000-000000000001'})
        (self.folder / f'{mode}.stderr').write_text(result.stderr)
        (self.folder / f'{mode}.stdout').write_text(result.stdout)
        records = [json.loads(line.split('[teleport-idle-observe] ', 1)[1])
                   for line in result.stderr.splitlines() if '[teleport-idle-observe] ' in line]
        outcome = json.loads(result.stdout)
        self.assertEqual(outcome['extraAPIcalls'], 0)
        self.assertEqual(outcome['pendingAfterDrain'], 0)
        self.assertEqual([r['sequence'] for r in records], list(range(1, len(records) + 1)))
        self.assertTrue(all(r['sourceSHA'] == idle.helper_hash() for r in records))
        self.receipts.append({'mode': mode, 'result': outcome, 'events': len(records), 'exit': result.returncode})
        return outcome, records

    def test_synchronous_one_error_argument_callbacks(self):
        _, records = self.run_case('sync')
        callbacks = [r for r in records if r['event'] == 'callback']
        self.assertEqual({r['kind'] for r in callbacks}, {'eventLoop', 'animations'})
        self.assertTrue(all(r['errorIsNil'] is True and r['validErrorType'] is True for r in callbacks))

    def test_returns_before_deferred_replies_and_keeps_blocks_alive(self):
        outcome, records = self.run_case('deferred')
        self.assertEqual(outcome['deferredBeforeDrain'], 2)
        self.assertEqual(len([r for r in records if r['event'] == 'callback']), 2)

    def test_native_errors_remain_typed_errors_not_idle_success(self):
        _, records = self.run_case('error')
        callbacks = [r for r in records if r['event'] == 'callback']
        self.assertEqual(len(callbacks), 2)
        self.assertTrue(all(r['errorIsNil'] is False and r['errorDomain'] == 'FixtureIdle' and r['errorCode'] == 17 for r in callbacks))

    def test_registration_exceptions_do_not_escape_or_forge_callbacks(self):
        _, records = self.run_case('throw')
        self.assertEqual(len([r for r in records if r['event'] == 'registration_error']), 2)
        self.assertFalse(any(r['event'] == 'callback' for r in records))

    def test_wrong_method_encoding_is_rejected_before_call(self):
        _, records = self.run_case('wrongEncoding')
        self.assertEqual(len([r for r in records if r['event'] == 'registration_error']), 2)
        self.assertFalse(any(r['event'] == 'registration_begin' for r in records))

    def test_unknown_xctest_image_is_rejected_before_private_call(self):
        _, records = self.run_case('wrongImage')
        self.assertEqual(len([r for r in records if r['event'] == 'registration_error']), 2)
        self.assertFalse(any(r['event'] == 'registration_begin' for r in records))

    def test_replaced_process_and_deferred_blocks_keep_original_generation_identity(self):
        outcome, records = self.run_case('replaceProcess')
        self.assertEqual(outcome['deferredBeforeDrain'], 4)
        callbacks = [r for r in records if r['event'] == 'callback']
        self.assertEqual(len(callbacks), 4)
        self.assertEqual({r['pid'] for r in callbacks if r['generation'] == 1}, {101})
        self.assertEqual({r['pid'] for r in callbacks if r['generation'] == 2}, {202})

    def test_duplicate_replies_do_not_consume_another_generation(self):
        _, records = self.run_case('duplicate')
        self.assertEqual(len([r for r in records if r['event'] == 'duplicate_or_late_callback']), 2)
        self.assertEqual(len([r for r in records if r['event'] == 'callback']), 2)

    def test_missing_replies_are_bounded_without_waiting_or_more_registrations(self):
        outcome, records = self.run_case('bound')
        self.assertEqual(outcome['inputs'], 6)
        self.assertEqual(outcome['deferredBeforeDrain'], 8)
        self.assertEqual(len([r for r in records if r['event'] == 'registration_error']), 2)

    def test_missing_cached_application_never_triggers_app_lookup_or_launch(self):
        _, records = self.run_case('missingProcess')
        self.assertEqual(len([r for r in records if r['event'] == 'remember_error']), 1)
        self.assertFalse(any(r['event'] == 'registration_begin' for r in records))


if __name__ == '__main__':
    unittest.main()
