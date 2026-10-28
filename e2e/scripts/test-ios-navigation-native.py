"""Compile the actual observer with public UIKit substitutes; no device is used."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MAIN = r'''
final class FixtureCoordinator: NSObject, UIViewControllerTransitionCoordinator {
  var isAnimated = true
  var isInteractive = false
  var initiallyInteractive = false
  var isCancelled = false
  var transitionDuration = 0.4
  var percentComplete: CGFloat = 0.25
  var from: UIViewController?
  var to: UIViewController?
  func viewController(forKey key: UITransitionContextViewControllerKey) -> UIViewController? {
    key == .from ? from : to
  }
}
final class CountingNavigation: UINavigationController {
  static var reads = 0
  private var current: UIViewControllerTransitionCoordinator?
  override var transitionCoordinator: UIViewControllerTransitionCoordinator? {
    get { Self.reads += 1; return current }
    set { current = newValue }
  }
}
final class FixtureResponder: UIResponder {
  var following: UIResponder?
  override var next: UIResponder? { following }
}
extension VisualEventTrace {
  static func drainNavigationOutput() { outputQueue.sync {} }
}
@main struct NativeNavigationMain {
  static func main() throws {
    let mode = CommandLine.arguments[1]
    let trace = VisualEventTrace.shared
    trace.install()
    let app = UIApplication()
    let touch = UITouch()
    let view = UIView()
    let first = UIViewController()
    let second = UIViewController()
    var navigation: CountingNavigation? = CountingNavigation()
    navigation!.viewControllers = [first, second]
    first.navigationController = navigation
    second.navigationController = navigation
    view.fixtureNext = first
    let coordinator = FixtureCoordinator()
    coordinator.from = first
    coordinator.to = second
    navigation!.transitionCoordinator = coordinator
    if mode == "nil" || mode == "late-start" { navigation!.transitionCoordinator = nil }
    if mode == "missing" { view.fixtureNext = nil }
    if mode == "cycle" { view.fixtureNext = view }
    var responders: [FixtureResponder] = []
    if mode == "responder-bound" {
      responders = (0..<64).map { _ in FixtureResponder() }
      for index in 0..<63 { responders[index].following = responders[index + 1] }
      responders.last!.following = first
      view.fixtureNext = responders.first
    }
    if mode == "stack-bound" { navigation!.viewControllers = (0..<17).map { _ in UIViewController() } }
    if mode == "nonfinite" { coordinator.percentComplete = .nan }
    view.accessibilityIdentifier = mode == "unselected" ? "persisted_portal_toggle_host" : "go_next"
    touch.view = view
    let event = UIEvent()
    event.allTouches = [touch]
    touch.phase = .began
    app.sendEvent(event)
    touch.phase = .ended
    app.sendEvent(event)
    if mode == "released" { navigation = nil }
    CADisplayLink.last?.fire()
    if mode == "late-start" { navigation!.transitionCoordinator = coordinator }
    if mode == "pending" { navigation!.transitionCoordinator = nil }
    FixtureState.clock += 3.1
    CADisplayLink.last?.fire()
    RunLoop.main.run(until: Date().addingTimeInterval(1.1))
    VisualEventTrace.drainNavigationOutput()
    let report: [String: Any] = [
      "mode": mode, "originalCalls": FixtureState.forwarded, "activeLinks": FixtureState.activeLinks,
      "coordinatorGetterReads": CountingNavigation.reads, "deviceAPICalls": 0,
      "extraTimers": 0, "registeredTransitionCallbacks": 0, "viewLoads": 0
    ]
    print(String(data: try JSONSerialization.data(withJSONObject: report, options: .sortedKeys), encoding: .utf8)!)
    withExtendedLifetime((navigation, responders)) {}
  }
}
'''


def run(output):
    old = load('existing_native_visual_fixture', HERE / 'test-ios-visual-native.py')
    checker = load('compiled_navigation_raw', HERE / 'check-ios-native-navigation.py')
    output.mkdir(parents=True, exist_ok=True)
    actual = old.SOURCE.read_text()
    native_sha = hashlib.sha256(actual.encode()).hexdigest()
    body = actual.replace('__TELEPORT_VISUAL_NATIVE_SHA__', native_sha)
    body = body.replace('import UIKit\n', '').replace('import React\n', '')
    body = body.replace('Bundle.main', 'FixtureBundle.main').replace('ProcessInfo.processInfo', 'FixtureProcessInfo.processInfo')
    source = output / 'fixture.swift'
    source.write_text(old.MOCK + '\n' + body + '\n' + MAIN)
    binary = output / 'fixture'
    with (output / 'compile.log').open('w') as log:
        subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', '-module-cache-path',
                        'example/ios/build/ModuleCache.noindex', '-parse-as-library', str(source), '-o', str(binary)],
                       stdout=log, stderr=subprocess.STDOUT, check=True)
    cases = []
    modes = ['disabled', 'unselected', 'pending', 'late-start', 'nil', 'missing', 'cycle',
             'responder-bound', 'stack-bound', 'released', 'nonfinite']
    rejected = {'missing', 'cycle', 'responder-bound', 'stack-bound', 'released', 'nonfinite'}
    for mode in modes:
        process = subprocess.run([str(binary), mode], capture_output=True, text=True, timeout=30)
        (output / f'{mode}.stdout').write_text(process.stdout)
        (output / f'{mode}.stderr').write_text(process.stderr)
        assert process.returncode == 0, (mode, process.stderr)
        case = json.loads(process.stdout)
        assert case['originalCalls'] == 2 and case['activeLinks'] == 0
        parsed = checker.VISUAL.parse_log(process.stderr)
        assert not parsed['errors'], parsed['errors']
        if mode == 'disabled':
            assert not parsed['native'] and case['coordinatorGetterReads'] == 0
        elif mode == 'unselected':
            assert not any('nativeNavigation' in row for row in parsed['native']) and case['coordinatorGetterReads'] == 0
        else:
            meta = {'sourceSHA': 'a' * 64, 'helperSourceHashes': {'native': native_sha}}
            result = checker.audit(process.stderr, meta, 'fixture')
            assert bool(result['errors']) == (mode in rejected), (mode, result['errors'])
            if mode not in rejected:
                assert case['coordinatorGetterReads'] == 2 and result['samples'] == 2
                assert result['coordinatorPresentSamples'] == (0 if mode == 'nil' else 1)
                states = [row['nativeNavigation']['coordinator'] for row in result['nativeRecords']]
                if mode == 'pending':
                    assert states[0]['percentComplete'] == 0.25 and states[1] is None
                if mode == 'late-start':
                    assert states[0] is None and states[1]['percentComplete'] == 0.25
            case['rawErrors'] = result['errors']
            case['samples'] = result['samples']
        assert all(case[key] == 0 for key in ['deviceAPICalls', 'extraTimers', 'registeredTransitionCallbacks', 'viewLoads'])
        cases.append(case)
    report = {'nativeSourceSHA256': native_sha, 'cases': cases, 'deviceAPICalls': 0, 'final_stability_credit': False,
              'scope': 'Exact complete native helper body compiled with public UIKit substitutes. Pending/nil/late transition context follows only the existing two fired pulses. Bounds, released context and nonfinite payloads remain rejected. No real device or App state is represented.'}
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    run(parser.parse_args().output)
