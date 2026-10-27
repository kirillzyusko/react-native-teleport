"""Compile actual composed handlers with host screen/HTTP bindings; no devices."""
import argparse
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

SPEC = importlib.util.spec_from_file_location('body_patch', Path(__file__).with_name('maestro-ios-frame-bodies.py'))
PATCH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PATCH)

MOCK = r'''
import Foundation
import CryptoKit
struct Logger { init(subsystem: String, category: String) {} }
struct HTTPRequest { var query: [String: String] = [:] }
enum Status { case ok, badRequest }
struct HTTPResponse { var statusCode: Status; var body: Data }
struct AppError {
    init(type: ErrorType = .precondition, message: String) {}
    enum ErrorType { case precondition }
    var httpResponse: HTTPResponse { HTTPResponse(statusCode: .badRequest, body: Data()) }
}
@MainActor protocol HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse
}
@MainActor enum CaptureFixture {
    static var frames: [Data] = []
    static var captures = 0
    static var pngEncodes = 0
    static var jpegEncodes = 0
}
@MainActor struct XCUIScreen {
    static let main = XCUIScreen()
    func screenshot() -> FixtureScreenshot {
        CaptureFixture.captures += 1
        return FixtureScreenshot(bytes: CaptureFixture.frames.removeFirst())
    }
}
@MainActor struct FixtureScreenshot {
    var bytes: Data
    var pngRepresentation: Data { CaptureFixture.pngEncodes += 1; return bytes }
    var image: FixtureImage { FixtureImage(bytes: bytes) }
}
@MainActor struct FixtureImage {
    var bytes: Data
    func jpegData(compressionQuality: Double) -> Data? {
        precondition(compressionQuality == 0.5)
        CaptureFixture.jpegEncodes += 1
        return Data("jpeg-".utf8) + bytes
    }
}
'''
MAIN = r'''
extension TeleportFrameBodyArchive.Store {
    func drainForFixture() { queue.sync {} }
}
extension TeleportFrameBodyArchive {
    static func drainForFixture() { shared.drainForFixture() }
}
@main struct FrameMethodsFixture {
    @MainActor static func main() async throws {
        let a = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==")!
        let b = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWNgYPj/HwADAgH/FAeIXAAAAABJRU5ErkJggg==")!
        CaptureFixture.frames = [a, a, a, b, a, b]
        let handler = IsScreenStaticHandler()
        let stable = try await handler.handleRequest(HTTPRequest())
        let moving = try await handler.handleRequest(HTTPRequest())
        let stableValue = try JSONSerialization.jsonObject(with: stable.body) as! [String: Bool]
        let movingValue = try JSONSerialization.jsonObject(with: moving.body) as! [String: Bool]
        precondition(stableValue == ["isScreenStatic": true])
        precondition(movingValue == ["isScreenStatic": false])
        let png = try await ScreenshotHandler().handleRequest(HTTPRequest())
        let jpeg = try await ScreenshotHandler().handleRequest(HTTPRequest(query: ["compressed": "true"]))
        precondition(png.body == a && jpeg.body == Data("jpeg-".utf8) + b)
        precondition(CaptureFixture.frames.isEmpty && CaptureFixture.captures == 6)
        precondition(CaptureFixture.pngEncodes == 5 && CaptureFixture.jpegEncodes == 1)
        TeleportFrameBodyArchive.drainForFixture()
        print("{\"captureCalls\":6,\"pngEncodes\":5,\"jpegEncodes\":1,\"unchangedResponses\":4,\"deviceAPICalls\":0}")
    }
}
'''


def run(artifact, output):
    output.mkdir(parents=True, exist_ok=True)
    original = (artifact / 'ScreenDiffHandler.original.swift').read_bytes()
    intermediate = (artifact / 'ScreenDiffHandler.patched.swift').read_bytes()
    composed = PATCH.patch(original, intermediate)
    assert PATCH.physical_source(composed) == original
    shot = PATCH.FRAME.patch(PATCH.FRAME.SHOT, (artifact / 'ScreenshotHandler.original.swift').read_bytes())

    def bindings(raw):
        body = PATCH.simulator_source(raw).decode()
        for name in ['XCTest', 'FlyingFox', 'os']:
            body = body.replace('import ' + name + '\n', '')
        return body.replace('FlyingFox.HTTPRequest', 'HTTPRequest').replace('FlyingFox.HTTPResponse', 'HTTPResponse').replace(
            'subsystem: Bundle.main.bundleIdentifier!,', 'subsystem: "fixture",')

    source = output / 'fixture.swift'
    source.write_text(MOCK + '\n' + bindings(composed) + '\n' + bindings(shot) + '\n' + MAIN)
    (output / 'ScreenDiffHandler.body-patched.swift').write_bytes(composed)
    binary = output / 'fixture'
    processes = []

    def invoke(command, **options):
        child = subprocess.Popen(command, **options)
        row = {'owner': 'This task device-free original handler fixture', 'pid': child.pid,
               'command': command, 'device': None, 'port': None, 'stop': 'normal bounded subprocess completion'}
        processes.append(row)
        (output / 'processes.json').write_text(json.dumps(processes, indent=2) + '\n')
        stdout, stderr = child.communicate(timeout=60)
        row['exit'] = child.returncode
        (output / 'processes.json').write_text(json.dumps(processes, indent=2) + '\n')
        if child.returncode:
            raise ValueError(f'Actual handler fixture exited {child.returncode}')
        return stdout, stderr

    with (output / 'compile.log').open('w') as log:
        invoke(['xcrun', 'swiftc', '-swift-version', '5', '-parse-as-library',
                '-module-cache-path', 'example/ios/build/ModuleCache.noindex',
                str(source), '-o', str(binary)], stdout=log, stderr=subprocess.STDOUT)
    stdout, stderr = invoke([str(binary)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                            env={**os.environ, 'SIMULATOR_UDID': '00000000-0000-0000-0000-000000000001'})
    (output / 'stdout.json').write_text(stdout)
    (output / 'native.log').write_text(stderr)
    result = json.loads(stdout)
    assert result == {'captureCalls': 6, 'pngEncodes': 5, 'jpegEncodes': 1,
                      'unchangedResponses': 4, 'deviceAPICalls': 0}
    rows = [json.loads(s.split('[teleport-frame-bodies] ', 1)[1]) for s in stderr.splitlines()
            if '[teleport-frame-bodies] ' in s]
    traces = [json.loads(s.split('[teleport-screen-trace] ', 1)[1]) for s in stderr.splitlines()
              if '[teleport-screen-trace] ' in s]
    assert len(traces) == 4 and [r['isScreenStatic'] for r in traces[:2]] == [True, False]
    queued = [r for r in rows if r['phase'] == 'queued']
    saved = [r for r in rows if r['phase'] == 'saved']
    initialized = [r for r in rows if r['phase'] == 'initialized']
    assert len(queued) == len(saved) == 2 and len(initialized) == 1
    assert not any(r['phase'] in ['rejected', 'write.error'] for r in rows)
    assert [r['ordinal'] for r in queued] == [1, 2] and [r['ordinal'] for r in saved] == [1, 2]
    root = Path(initialized[0]['root'])
    assert root.name.startswith('teleport-frame-bodies-' + str(initialized[0]['pid']) + '-')
    assert not root.is_symlink() and root.resolve().is_relative_to(Path(tempfile.gettempdir()).resolve())
    assert {f.name for f in root.iterdir()} == {r[k] for r in saved for k in ['firstFile', 'secondFile']}
    preserved = output / 'archive-files'
    preserved.mkdir()
    for pair, row, trace in zip(queued, saved, traces[:2]):
        assert pair['firstReturned'] == trace['firstCaptured'] and pair['secondReturned'] == trace['secondCaptured']
        assert pair['firstHash'] == trace['firstHash'] and pair['secondHash'] == trace['secondHash']
        assert pair['isScreenStatic'] is trace['isScreenStatic']
        for label in ['first', 'second']:
            file = root / row[label + 'File']
            assert not file.is_symlink()
            data = file.read_bytes()
            assert hashlib.sha256(data).hexdigest() == row[label + 'Hash'] == pair[label + 'Hash']
            assert len(data) == row[label + 'Bytes'] == pair[label + 'Bytes']
            (preserved / file.name).write_bytes(data)
    # Only the exact fixture-owned temporary root is removed after preserving all bytes.
    shutil.rmtree(root)
    result.update(archivedPairs=2, archivedPNGs=4, originalSourceSHA256=hashlib.sha256(original).hexdigest(),
                  helperSHA256=hashlib.sha256(PATCH.HELPER.read_bytes()).hexdigest(),
                  physicalSourceIdentical=True, temporaryArchiveRootRemoved=True,
                  sourceScope='Actual composed methods/helper, only outer target directives and XCTest/HTTP/Bundle bindings substituted')
    (output / 'report.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.artifact, args.output)
