"""Device-free contracts for the transparent post-static native idle probe."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest

SCRIPTS = Path(__file__).resolve().parent


def load(label, file):
    spec = importlib.util.spec_from_file_location(label, SCRIPTS / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CHECK = load('static_idle_checker_test', 'check-ios-static-idle.py')
SOURCE = CHECK.SOURCE
ARTIFACT = Path(os.environ.get('MAESTRO_STATIC_IDLE_SOURCE_ARTIFACT', 'example/ios/build/maestro-input/artifact'))
FIXTURE = Path(os.environ['MAESTRO_IDLE_FIXTURE_OUTPUT'])
DEVICE = '00000000-0000-0000-0000-000000000001'


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


class SourceControls(unittest.TestCase):
    def test_only_exact_original_and_intermediate_sources_are_accepted(self):
        original = (ARTIFACT / 'idle-XCTestHTTPServer.swift.original').read_bytes()
        intermediate = SOURCE.BASE.patch(SOURCE.BASE.SERVER, original)
        for first, second in [(original + b'\n', intermediate), (original, intermediate + b'\n'),
                              (original, SOURCE.patch(original, intermediate))]:
            with self.assertRaises(ValueError):
                SOURCE.patch(first, second)

    def test_physical_http_source_is_byte_identical(self):
        original = (ARTIFACT / 'idle-XCTestHTTPServer.swift.original').read_bytes()
        self.assertEqual(physical(SOURCE.patch(original, SOURCE.BASE.patch(SOURCE.BASE.SERVER, original))), original)

    def test_old_core_and_new_final_sources_are_independently_audited(self):
        self.assertEqual(CHECK.BASE.source_audit(ARTIFACT), [])
        self.assertEqual(SOURCE.source_audit(ARTIFACT), [])

    def test_install_rejects_wrong_scope_before_accessing_sdk(self):
        builder = load('static_idle_builder_test', 'maestro-ios-input.py')
        for actual, expected in [(True, False), (False, True)]:
            with tempfile.TemporaryDirectory(prefix='teleport-static-idle-profile-') as temp:
                folder = Path(temp)
                metadata = {'status': 'built', 'source_commit': builder.SOURCE_COMMIT,
                    'lead_in_seconds': 0, 'backend': 'indigo', 'frame_trace': {'version': 1},
                    'idle_observation': {'version': 1}}
                if actual:
                    metadata['idle_static_observation'] = {'version': 1}
                (folder / 'maestro-ios-input.json').write_text(json.dumps(metadata))
                args = SimpleNamespace(jar=folder / 'absent.jar', artifact=folder, expected_lead_in='0',
                    expected_backend='indigo', expected_frame_trace=True, expected_idle_observation=True,
                    expected_static_idle_observation=expected)
                with self.assertRaisesRegex(RuntimeError, 'post-static idle-observation profile'):
                    builder.install(args)

    def test_actual_swift_wrappers_return_same_response_and_do_not_wait_for_replies(self):
        source = '''import Foundation
enum FlyingFox {
 struct HTTPRequest {}
 final class HTTPResponse {
  let statusCode: Int
  init(_ code: Int = 200) { statusCode = code }
 }
}
extension Int { static let ok = 200 }
enum Route: String { case touch, swipe, swipeV2, isScreenStatic, screenshot }
@MainActor protocol HTTPHandler {
 func handleRequest(_ request: FlyingFox.HTTPRequest) async throws -> FlyingFox.HTTPResponse
}
@MainActor var nativeCalls: [String] = []
@MainActor func TeleportIdleObserveInput(_ route: String) { nativeCalls.append(route) }
@MainActor final class Original: HTTPHandler {
 var calls = 0
 let response = FlyingFox.HTTPResponse()
 func handleRequest(_ request: FlyingFox.HTTPRequest) async throws -> FlyingFox.HTTPResponse {
  calls += 1
  return response
 }
}
'''
        source += (SOURCE.BASE.HELPERS / 'IdleObserve.swift').read_text().replace('#if targetEnvironment(simulator)', '#if true')
        source += SOURCE.HELPER.read_text().replace('#if targetEnvironment(simulator)', '#if true').replace('__TELEPORT_STATIC_IDLE_SOURCE_SHA__', SOURCE.helper_hash())
        source += '''
@main struct Main {
 @MainActor static func main() async throws {
  let original = Original()
  for route in [Route.isScreenStatic, .touch, .isScreenStatic, .screenshot, .isScreenStatic, .swipeV2, .isScreenStatic] {
   let handler = TeleportStaticIdleHTTPObserver(route: route,
       handler: TeleportIdleHTTPObserver(route: route, handler: original))
   let response = try await handler.handleRequest(FlyingFox.HTTPRequest())
   precondition(response === original.response)
  }
  precondition(original.calls == 7)
  precondition(nativeCalls == ["touch", "isScreenStatic", "isScreenStatic", "swipeV2", "isScreenStatic"])
  print("{\\"originalCalls\\":7,\\"sameResponses\\":7,\\"staticRegistrations\\":3,\\"deviceAPICalls\\":0}")
 }
}
'''
        folder = ARTIFACT / 'static-idle-fixture'
        folder.mkdir(exist_ok=True)
        file = folder / 'fixture.swift'
        file.write_text(source)
        compiled = subprocess.run(['xcrun', 'swiftc', '-parse-as-library', '-swift-version', '5',
            str(file), '-o', str(folder / 'fixture')], capture_output=True, text=True, timeout=60)
        (folder / 'compile.log').write_text(compiled.stdout + compiled.stderr)
        self.assertEqual(compiled.returncode, 0, compiled.stderr)
        result = subprocess.run([str(folder / 'fixture')], capture_output=True, text=True, timeout=10, check=True)
        (folder / 'stdout.json').write_text(result.stdout)
        (folder / 'native.log').write_text(result.stderr)
        self.assertEqual(json.loads(result.stdout), {'originalCalls': 7, 'sameResponses': 7,
            'staticRegistrations': 3, 'deviceAPICalls': 0})
        markers = [json.loads(line.split('[teleport-static-idle] ', 1)[1]) for line in result.stderr.splitlines() if '[teleport-static-idle]' in line]
        self.assertEqual([m['observed'] for m in markers], [False, True, True, True])


def fixture_text(pending=False):
    # Synthetic route/timestamp combinations use typed callback records emitted
    # by the compiled device-free C helper. They are never actual CI evidence.
    template = CHECK.BASE.parse((FIXTURE / 'sync.stderr').read_text())
    remembers = [r for r in template if r['event'] == 'remember']
    prototype = [r for r in template if r['event'] != 'remember']
    records = []
    for r in remembers:
        r = copy.deepcopy(r)
        r['uptime'] = 99.0
        records.append(r)
    for generation, route, begin in [(1, 'touch', 100), (2, 'isScreenStatic', 101.22), (3, 'isScreenStatic', 102.22)]:
        for i, r in enumerate(prototype):
            r = copy.deepcopy(r)
            r.update(generation=generation, uptime=begin + i * 0.001)
            if r['event'] == 'input_complete':
                r['route'] = route
            if pending and generation == 3 and r['event'] == 'callback':
                r['uptime'] = 104 + i * 0.001
            records.append(r)
    records.sort(key=lambda r: r['uptime'])
    for i, r in enumerate(records, 1):
        r['sequence'] = i
    frames = [{'route': 'isScreenStatic', 'begin': t, 'ready': t + 0.2, 'isScreenStatic': True,
               'firstCaptured': t + 0.1, 'secondCaptured': t + 0.19,
               'firstHash': 'a' * 64, 'secondHash': 'a' * 64, 'sequence': i}
              for i, t in enumerate([90, 101, 102], 1)]
    frames.append({'route': 'screenshot', 'begin': 103, 'captured': 103.1, 'ready': 103.2,
                   'bodyHash': 'a' * 64, 'sequence': 4})
    markers = [{'version': 1, 'sourceSHA': SOURCE.helper_hash(), 'staticOrdinal': i,
                'observed': i != 1, 'uptime': t + 0.21} for i, t in enumerate([90, 101, 102], 1)]
    http = '[FlyingFox] request: GET /isScreenStatic\n[FlyingFox] request: POST /touch\n'
    http += '[FlyingFox] request: GET /isScreenStatic\n' * 2 + '[FlyingFox] request: GET /screenshot\n'
    return http + ''.join('[teleport-idle-observe] ' + json.dumps(r) + '\n' for r in records) + \
        ''.join('[teleport-screen-trace] ' + json.dumps(r) + '\n' for r in frames) + \
        ''.join('[teleport-static-idle] ' + json.dumps(r) + '\n' for r in markers)


class RawControls(unittest.TestCase):
    def checked(self, text):
        return CHECK.check(text, DEVICE, minimum_inputs=1, minimum_static=1)

    def test_every_gesture_and_post_response_native_callback_is_required(self):
        result = self.checked(fixture_text())
        self.assertEqual(result['errors'], [])
        self.assertEqual((result['gestureInputs'], result['staticObserved'], len(result['callbacks'])), (1, 2, 6))

    def test_later_capture_while_fresh_idle_pending_is_evidence_only(self):
        result = self.checked(fixture_text(pending=True))
        self.assertEqual(result['errors'], [])
        self.assertEqual(set(result['screenshotsWhileFreshStaticIdlePending'][0]['pendingKinds']), {'eventLoop', 'animations'})
        self.assertIs(result['final_stability_credit'], False)

    def test_old_input_only_runtime_has_no_post_static_proof(self):
        text = (FIXTURE / 'sync.stderr').read_text()
        self.assertTrue(self.checked('[FlyingFox] request: POST /touch\n' + text)['errors'])

    def test_missing_static_callback_or_extra_http_response_is_rejected(self):
        text = fixture_text()
        self.assertTrue(self.checked(text.replace('[FlyingFox] request: GET /screenshot', '[FlyingFox] request: GET /isScreenStatic\n[FlyingFox] request: GET /screenshot'))['errors'])
        lines = text.splitlines()
        lines = [line for line in lines if not ('"generation": 3' in line and '"event": "callback"' in line)]
        self.assertTrue(self.checked('\n'.join(lines))['errors'])

    def test_marker_source_type_and_phase_cannot_be_forged(self):
        text = fixture_text()
        for bad in [text.replace(SOURCE.helper_hash(), '0' * 64),
                    text.replace('"observed": true', '"observed": 1'),
                    text.replace('"observed": false', '"observed": true')]:
            self.assertTrue(self.checked(bad)['errors'])

    def test_registration_must_follow_original_response_ready(self):
        text = fixture_text().replace('"uptime": 101.21', '"uptime": 101.1')
        self.assertTrue(self.checked(text)['errors'])

    def test_wrong_static_ordinal_and_missing_marker_are_rejected(self):
        text = fixture_text()
        self.assertTrue(self.checked(text.replace('"staticOrdinal": 2', '"staticOrdinal": true'))['errors'])
        self.assertTrue(self.checked('\n'.join(line for line in text.splitlines()
            if not ('[teleport-static-idle]' in line and '"staticOrdinal": 2' in line)))['errors'])


if __name__ == '__main__':
    unittest.main()
