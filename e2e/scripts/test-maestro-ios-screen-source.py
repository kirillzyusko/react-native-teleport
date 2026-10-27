"""Device-free contracts for opt-in observation of the original screen handlers."""
import hashlib
import importlib.util
import os
import json
import tempfile
from types import SimpleNamespace
from pathlib import Path
import unittest

SCRIPTS = Path(__file__).resolve().parent
SOURCE = SCRIPTS.parents[1] / 'example/ios/build/maestro-input/source'
spec = importlib.util.spec_from_file_location('screen_trace', SCRIPTS / 'maestro-ios-screen-trace.py')
trace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trace)


def physical(data):
    # Original handlers have no conditionals. Every new block is Simulator-only.
    lines = []
    skipping = False
    for line in data.decode().splitlines(keepends=True):
        if line.strip() == '#if targetEnvironment(simulator)':
            assert not skipping
            skipping = True
        elif line.strip() == '#endif':
            assert skipping
            skipping = False
        elif not skipping:
            lines.append(line)
    assert not skipping
    return ''.join(lines)


class Contracts(unittest.TestCase):
    def original(self, name):
        # Shared build sources are generated. A previous trace build may have
        # patched them; use the preserved pinned originals from its artifact.
        file = SOURCE / name
        data = file.read_bytes()
        if trace.blob(data) != trace.PINNED[name]:
            label = Path(name).stem
            original = Path(os.environ.get('MAESTRO_INPUT_SOURCE_ARTIFACT', str(SOURCE.parent / 'artifact'))) / f'{label}.original.swift'
            data = original.read_bytes()
        self.assertEqual(trace.blob(data), trace.PINNED[name])
        return data

    def test_source_pin_rejects_unsupported_and_already_modified(self):
        for name in trace.PINNED:
            original = self.original(name)
            with self.assertRaises(ValueError):
                trace.patch(name, original + b'\n')
            with self.assertRaises(ValueError):
                trace.patch(name, trace.patch(name, original))

    def test_physical_source_and_all_original_operations_survive(self):
        for name in trace.PINNED:
            original = self.original(name)
            changed = trace.patch(name, original)
            self.assertEqual(physical(changed), original.decode())
            self.assertEqual(changed.count(b'XCUIScreen.main.screenshot()'), original.count(b'XCUIScreen.main.screenshot()'))
            self.assertNotIn(b'Thread.sleep', changed)
            self.assertNotIn(b'Task.sleep', changed)
            self.assertNotIn(b'viewHierarchy', changed)

    def test_static_response_and_original_hashes_are_observed_without_new_comparison(self):
        changed = trace.patch(trace.SCREEN, self.original(trace.SCREEN)).decode()
        self.assertEqual(changed.count('let isScreenStatic = hash1 == hash2'), 1)
        self.assertEqual(changed.count('SHA256.hash(data:'), 2)
        self.assertIn('"firstHash": TeleportScreenTrace.hex(hash1)', changed)
        self.assertIn('"secondHash": TeleportScreenTrace.hex(hash2)', changed)
        self.assertLess(changed.index('let responseData = try JSONSerialization.data'), changed.index('TeleportScreenTrace.emit(['))
        self.assertLess(changed.index('TeleportScreenTrace.emit(['), changed.index('return HTTPResponse(statusCode: .ok, body: responseData)'))

    def test_screenshot_logs_exact_return_body_after_existing_capture_and_encoding(self):
        changed = trace.patch(trace.SHOT, self.original(trace.SHOT)).decode()
        self.assertEqual(changed.count('fullScreenshot.pngRepresentation'), 1)
        self.assertEqual(changed.count('jpegData(compressionQuality: 0.5)'), 1)
        self.assertIn('TeleportScreenTrace.hex(SHA256.hash(data: image))', changed)
        self.assertIn('"byteCount": image.count', changed)
        self.assertLess(changed.index('guard let image = image else'), changed.index('TeleportScreenTrace.emit(['))
        self.assertLess(changed.index('TeleportScreenTrace.emit(['), changed.index('return HTTPResponse(statusCode: .ok, body: image)'))

    def test_install_requires_exact_opt_in_profile_before_sdk_access(self):
        spec = importlib.util.spec_from_file_location('input_builder', SCRIPTS / 'maestro-ios-input.py')
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        for metadata, expected in [({}, True), ({'frame_trace': {'version': 1}}, False)]:
            with tempfile.TemporaryDirectory(prefix='teleport-frame-install-') as tmp:
                folder = Path(tmp)
                (folder / 'maestro-ios-input.json').write_text(json.dumps({
                    'status': 'built', 'source_commit': builder.SOURCE_COMMIT,
                    'lead_in_seconds': 0, 'backend': 'indigo', **metadata}))
                with self.assertRaisesRegex(RuntimeError, 'frame-observation profile does not match'):
                    builder.install(SimpleNamespace(jar=folder / 'absent.jar', artifact=folder,
                        expected_lead_in='0', expected_backend='indigo', expected_frame_trace=expected))


if __name__ == '__main__':
    unittest.main()
