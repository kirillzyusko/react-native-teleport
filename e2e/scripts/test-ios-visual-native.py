"""Compile the actual native logger body with device-free host UIKit substitutes."""
import argparse
import importlib.util
import hashlib
import json
from pathlib import Path
import subprocess

SOURCE = Path(__file__).with_name('ios-visual-trace') / 'VisualEventTrace.swift'
MOCK = r'''
import Foundation
import CoreGraphics
import ObjectiveC
enum FixtureState {
  static var forwarded = 0
  static var added = 0
  static var removed = 0
  static var cachedGetterReads = 0
  static var activeLinks = 0
  static var clock = 100.0
}
final class FixtureProcessInfo {
  static let processInfo = FixtureProcessInfo()
  var processIdentifier: Int32 { ProcessInfo.processInfo.processIdentifier }
  var environment: [String: String] { ["SIMULATOR_UDID": "fixture"] }
  var systemUptime: Double { FixtureState.clock }
}
final class FixtureBundle {
  static let main = FixtureBundle()
  func object(forInfoDictionaryKey key: String) -> Any? {
    if key == "TeleportVisualTrace" { return CommandLine.arguments[1] != "disabled" }
    return String(repeating: "a", count: 64)
  }
  var executableURL: URL? { nil }
  func url(forResource: String, withExtension: String) -> URL? { nil }
}
@objc protocol RCTSurfacePresenterObserver: NSObjectProtocol {
  @objc optional func willMountComponents(withRootTag rootTag: Int)
  @objc optional func didMountComponents(withRootTag rootTag: Int)
}
@objc protocol RCTSurfacePresenterStub: NSObjectProtocol {
  @objc(addObserver:) func add(_ observer: RCTSurfacePresenterObserver)
  @objc(removeObserver:) func remove(_ observer: RCTSurfacePresenterObserver)
}
// Match the actual linked RN class: observer selectors, no Stub conformance.
final class FixturePresenter: NSObject {
  weak var observer: RCTSurfacePresenterObserver?
  @objc(addObserver:) func add(_ next: RCTSurfacePresenterObserver) { FixtureState.added += 1; observer = next }
  @objc(removeObserver:) func remove(_ previous: RCTSurfacePresenterObserver) { FixtureState.removed += 1; observer = nil }
  func mount() {
    observer?.willMountComponents?(withRootTag: 1)
    observer?.didMountComponents?(withRootTag: 1)
  }
}
final class WrongAddPresenter: NSObject {
  @objc(addObserver:) func add(_ observer: RCTSurfacePresenterObserver) -> Int32 { fatalError("ABI guard did not reject wrong add") }
  @objc(removeObserver:) func remove(_ observer: RCTSurfacePresenterObserver) { fatalError("Wrong add receiver used") }
}
final class WrongRemovePresenter: NSObject {
  @objc(addObserver:) func add(_ observer: RCTSurfacePresenterObserver) { fatalError("Wrong remove receiver used") }
  @objc(removeObserver:) func remove(_ observer: RCTSurfacePresenterObserver) -> Int32 { fatalError("ABI guard did not reject wrong remove") }
}
final class FixtureHost: NSObject {
  let presenter: NSObject?
  init(_ presenter: NSObject?) { self.presenter = presenter }
  @objc func surfacePresenter() -> NSObject? {
    FixtureState.cachedGetterReads += 1
    return presenter
  }
}
final class FixtureFactory: NSObject {
  let host: FixtureHost
  init(_ presenter: NSObject?) { host = FixtureHost(presenter) }
  @objc func reactHost() -> NSObject {
    FixtureState.cachedGetterReads += 1
    return host
  }
}
final class CALayer {
  var frame = CGRect(x: 0, y: 0, width: 402, height: 874)
  var opacity: Float = 1
  func presentation() -> CALayer? { nil }
}
final class UIView: NSObject {
  var accessibilityIdentifier: String?
  var superview: UIView?
  let layer = CALayer()
}
final class UITouch: NSObject {
  enum Phase { case began, ended }
  var phase = Phase.ended
  var view: UIView?
  var timestamp = 100.0
  func location(in: UIView?) -> CGPoint { CGPoint(x: 201, y: 194) }
}
final class UIEvent: NSObject {
  var allTouches: Set<UITouch>?
}
class UIApplication: NSObject {
  @objc dynamic func sendEvent(_ event: UIEvent) { FixtureState.forwarded += 1 }
}
final class CADisplayLink: NSObject {
  static var last: CADisplayLink?
  weak var target: NSObject?
  let selector: Selector
  var timestamp = 100.0
  var targetTimestamp = 100.016
  var active = false
  init(target: NSObject, selector: Selector) {
    self.target = target
    self.selector = selector
    super.init()
    Self.last = self
  }
  func add(to: RunLoop, forMode: RunLoop.Mode) { active = true; FixtureState.activeLinks += 1 }
  func invalidate() { if active { active = false; FixtureState.activeLinks -= 1 } }
  func fire() { _ = target?.perform(selector, with: self) }
}
'''
MAIN = r'''
extension VisualEventTrace {
  static func drainFixtureOutput() { outputQueue.sync {} }
}
@main struct FixtureMain {
  static func main() throws {
    let mode = CommandLine.arguments[1]
    let trace = VisualEventTrace.shared
    let presenter: NSObject? = mode == "wrong-add" ? WrongAddPresenter() :
      mode == "wrong-remove" ? WrongRemovePresenter() : mode == "nil-presenter" ? nil : FixturePresenter()
    trace.install()
    trace.attachFactory(FixtureFactory(presenter))
    if mode == "reattach" { trace.attachFactory(FixtureFactory(presenter)) }
    let app = UIApplication()
    let touch = UITouch()
    let view = UIView()
    touch.view = view
    let event = UIEvent()
    event.allTouches = [touch]
    touch.phase = .began
    app.sendEvent(event)
    touch.phase = .ended
    if mode == "overflow" {
      for _ in 0..<4200 { app.sendEvent(event) }
    } else {
      view.accessibilityIdentifier = "go_next"
      if mode == "chunked" {
        var cursor = view
        for _ in 0..<15 {
          let parent = UIView()
          cursor.superview = parent
          cursor = parent
        }
      }
      app.sendEvent(event)
      (presenter as? FixturePresenter)?.mount()
      CADisplayLink.last?.fire()
      FixtureState.clock += 3.1
      CADisplayLink.last?.fire()
    }
    RunLoop.main.run(until: Date().addingTimeInterval(1.1))
    VisualEventTrace.drainFixtureOutput()
    let report: [String: Any] = [
      "mode": mode, "originalCalls": FixtureState.forwarded,
      "mountObservers": FixtureState.added, "activeLinks": FixtureState.activeLinks,
      "removedObservers": FixtureState.removed,
      "presenterConformsToStub": presenter is RCTSurfacePresenterStub,
      "cachedGetterReads": FixtureState.cachedGetterReads,
      "deviceAPICalls": 0
    ]
    print(String(data: try JSONSerialization.data(withJSONObject: report, options: .sortedKeys), encoding: .utf8)!)
  }
}
'''


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    actual = SOURCE.read_text()
    body = actual.replace('__TELEPORT_VISUAL_NATIVE_SHA__', hashlib.sha256(actual.encode()).hexdigest())
    body = body.replace('import UIKit\n', '').replace('import React\n', '')
    body = body.replace('Bundle.main', 'FixtureBundle.main').replace('ProcessInfo.processInfo', 'FixtureProcessInfo.processInfo')
    fixture = output / 'fixture.swift'
    fixture.write_text(MOCK + '\n' + body + '\n' + MAIN)
    binary = output / 'fixture'
    with (output / 'compile.log').open('w') as log:
        subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', '-module-cache-path', 'example/ios/build/ModuleCache.noindex',
                        '-parse-as-library', str(fixture), '-o', str(binary)],
                       stdout=log, stderr=subprocess.STDOUT, check=True)
    results = []
    for mode in ['disabled', 'enabled', 'chunked', 'overflow', 'wrong-add', 'wrong-remove', 'nil-presenter', 'reattach']:
        result = subprocess.run([str(binary), mode], capture_output=True, text=True, timeout=30)
        (output / f'{mode}.stdout').write_text(result.stdout)
        (output / f'{mode}.stderr').write_text(result.stderr)
        if result.returncode:
            raise ValueError(f'Host mock exited {result.returncode}: {mode}')
        report = json.loads(result.stdout)
        assert report['presenterConformsToStub'] is False
        spec = importlib.util.spec_from_file_location('visual_trace_raw', Path(__file__).with_name('check-ios-visual-trace.py'))
        checker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(checker)
        parsed = checker.parse_log(result.stderr)
        assert not parsed['errors'], parsed['errors']
        records = parsed['native']
        chunks = [line for line in result.stderr.splitlines() if '[teleport-visual-native-chunk] ' in line]
        phases = [r['phase'] for r in records]
        if mode == 'chunked':
            assert len(chunks) >= 4 and phases.count('presentation.sample') == 2
        assert report['deviceAPICalls'] == 0 and report['activeLinks'] == 0
        if mode == 'disabled':
            assert report['originalCalls'] == 2 and report['mountObservers'] == 0 and report['cachedGetterReads'] == 0 and not records
        elif mode in ('enabled', 'chunked', 'reattach'):
            assert report['originalCalls'] == 2 and report['mountObservers'] == (2 if mode == 'reattach' else 1)
            assert report['cachedGetterReads'] == (4 if mode == 'reattach' else 2)
            assert report['removedObservers'] == (1 if mode == 'reattach' else 0)
            assert phases.count('touch.up.dispatched') == 1
            assert phases.count('fabric.willMount') == phases.count('fabric.didMount') == 1
            assert phases.count('presentation.sample') == 2 and phases.count('presentation.end') == 1
            touch = next(r for r in records if r['phase'] == 'touch.up.dispatched')
            assert touch['touchTimestampMs'] == 100000 and touch['identifiers'] == ['go_next']
        elif mode == 'overflow':
            assert report['originalCalls'] == 4201 and phases.count('buffer.overflow') == 1
        else:
            assert report['originalCalls'] == 2 and report['mountObservers'] == 0 and report['removedObservers'] == 0
            assert report['cachedGetterReads'] == 2 and phases.count('setup.error') == 1
            assert 'mount.observer.installed' not in phases and 'fabric.willMount' not in phases and 'fabric.didMount' not in phases
        numbered = [r['sequence'] for r in records if 'sequence' in r]
        assert numbered == sorted(numbered) and len(numbered) == len(set(numbered))
        results.append(report)
    report = {'nativeSourceSHA256': hashlib.sha256(actual.encode()).hexdigest(), 'cases': results,
              'deviceAPICalls': 0, 'source_scope': 'Actual helper body, UIKit/React/Bundle/process bindings substituted; host mocks only.'}
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    run(parser.parse_args().output)
