"""Compile actual patched handlers against a device-free Swift capture fixture."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

SCRIPTS = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('screen_trace', SCRIPTS / 'maestro-ios-screen-trace.py')
trace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trace)

STUBS = r'''
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
    var pngRepresentation: Data {
        CaptureFixture.pngEncodes += 1
        return bytes
    }
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
@main struct Main {
    @MainActor static func main() async throws {
        let a = Data("synthetic-frame-a".utf8)
        let b = Data("synthetic-frame-b".utf8)
        CaptureFixture.frames = [a, a, a, b, a, b]
        let handler = IsScreenStaticHandler()
        let stable = try await handler.handleRequest(HTTPRequest())
        let moving = try await handler.handleRequest(HTTPRequest())
        let first = try JSONSerialization.jsonObject(with: stable.body) as! [String: Bool]
        let second = try JSONSerialization.jsonObject(with: moving.body) as! [String: Bool]
        precondition(first == ["isScreenStatic": true])
        precondition(second == ["isScreenStatic": false])
        let png = try await ScreenshotHandler().handleRequest(HTTPRequest())
        let jpeg = try await ScreenshotHandler().handleRequest(HTTPRequest(query: ["compressed": "true"]))
        precondition(png.body == a)
        precondition(jpeg.body == Data("jpeg-".utf8) + b)
        precondition(CaptureFixture.frames.isEmpty)
        precondition(CaptureFixture.captures == 6)
        precondition(CaptureFixture.pngEncodes == 5)
        precondition(CaptureFixture.jpegEncodes == 1)
        print("{\"captureCalls\":6,\"pngEncodes\":5,\"jpegEncodes\":1,\"unchangedResponses\":4,\"deviceAPICalls\":0}")
    }
}
'''


def simulator_fixture(data):
    # This is only a mock compiler target. Real target preprocessing is tested
    # separately; original SDK methods are otherwise used verbatim.
    return '\n'.join(line for line in data.decode().splitlines()
        if not line.startswith(('import FlyingFox', 'import XCTest', 'import os'))
        and line.strip() not in ('#if targetEnvironment(simulator)', '#endif')).replace('Bundle.main.bundleIdentifier!', '"fixture"').replace('FlyingFox.HTTPRequest', 'HTTPRequest').replace('FlyingFox.HTTPResponse', 'HTTPResponse')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    handlers = []
    for name in trace.PINNED:
        raw = (args.artifact / f'{Path(name).stem}.original.swift').read_bytes()
        handlers.append(simulator_fixture(trace.patch(name, raw)))
    file = args.output / 'ScreenObservationFixture.swift'
    file.write_text(STUBS + '\n' + '\n'.join(handlers) + '\n' + MAIN)
    binary = args.output / 'ScreenObservationFixture'
    subprocess.run(['xcrun', 'swiftc', '-module-cache-path', str(SCRIPTS.parents[1] / 'example/ios/build/maestro-input/DerivedData/ModuleCache.noindex'), '-parse-as-library', '-swift-version', '5', '-warnings-as-errors', str(file), '-o', str(binary)], check=True, timeout=120)
    result = subprocess.run([str(binary)], capture_output=True, text=True, check=True, timeout=15)
    (args.output / 'stdout.json').write_text(result.stdout)
    (args.output / 'native.log').write_text(result.stderr)
    records = [json.loads(line.split('[teleport-screen-trace] ', 1)[1]) for line in result.stderr.splitlines() if '[teleport-screen-trace] ' in line]
    assert len(records) == 4 and [r['sequence'] for r in records] == [1, 2, 3, 4]
    assert [r['isScreenStatic'] for r in records[:2]] == [True, False]
    for r in records[:2]:
        assert r['isScreenStatic'] == (r['firstHash'] == r['secondHash'])
        assert r['begin'] <= r['firstCaptured'] <= r['secondCaptured'] <= r['ready']
    for r, data, compressed in zip(records[2:], [b'synthetic-frame-a', b'jpeg-synthetic-frame-b'], [False, True]):
        assert r['bodyHash'] == hashlib.sha256(data).hexdigest()
        assert r['compressed'] == compressed and r['byteCount'] == len(data)
        assert r['begin'] <= r['captured'] <= r['ready']
    report = {'scope': 'Actual patched Swift handler bodies with mock screen/HTTP; no XCTest/device calls',
              'controls': json.loads(result.stdout), 'trace_records': records,
              'helper_sha256': hashlib.sha256(trace.HELPER.read_bytes()).hexdigest(),
              'final_stability_credit': False}
    (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report['controls']))


if __name__ == '__main__':
    main()
