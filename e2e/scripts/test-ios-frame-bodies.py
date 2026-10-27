"""Device-free tests of the actual bounded PNG archive helper; no SDK integration."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess

SPEC = importlib.util.spec_from_file_location('frame_bodies', Path(__file__).with_name('maestro-ios-frame-bodies.py'))
PATCH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PATCH)

FIXTURE = r'''
extension TeleportFrameBodyArchive.Store {
    func drainForFixture() { queue.sync {} }
    func holdForFixture(_ ready: DispatchSemaphore, _ release: DispatchSemaphore) {
        queue.async { ready.signal(); release.wait() }
    }
    func stateForFixture() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return ["attempted": attempted, "acceptedBytes": acceptedBytes,
                "pending": pending, "failed": failed]
    }
}

@main struct ArchiveFixture {
    static func main() throws {
        let mode = CommandLine.arguments[1]
        let root = URL(fileURLWithPath: CommandLine.arguments[2])
        let red = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==")!
        let blue = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWNgYPj/HwADAgH/FAeIXAAAAABJRU5ErkJggg==")!
        var limits = TeleportFrameBodyArchive.Limits.production
        if mode == "pair-bound" {
            limits = .init(pairs: 1, pngBytes: 1024, totalBytes: 4096, pendingPairs: 2)
        } else if mode == "png-bound" {
            limits = .init(pairs: 3, pngBytes: red.count - 1, totalBytes: 4096, pendingPairs: 2)
        } else if mode == "total-bound" {
            limits = .init(pairs: 3, pngBytes: 1024, totalBytes: 2 * red.count + 1, pendingPairs: 2)
        } else if mode == "queue-bound" {
            limits = .init(pairs: 3, pngBytes: 1024, totalBytes: 4096, pendingPairs: 1)
        }
        func digest(_ data: Data) -> String {
            SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        }
        var state: [String: Any] = [:]
        if mode != "disabled" {
            if mode == "filesystem-error" { try Data("owned blocker".utf8).write(to: root) }
            if mode == "existing-file" {
                try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
                try Data("owned sentinel".utf8).write(to: root.appendingPathComponent("pair-000001-first.png"))
            }
            let store = TeleportFrameBodyArchive.Store(root: root, limits: limits)
            let ready = DispatchSemaphore(value: 0)
            let release = DispatchSemaphore(value: 0)
            if mode == "queue-bound" {
                store.holdForFixture(ready, release)
                guard ready.wait(timeout: .now() + 5) == .success else { fatalError("Fixture writer did not pause") }
            }
            let first = mode == "bad-png" ? Data("not a PNG".utf8) : red
            let second = mode == "different" ? blue : first
            let hash = mode == "bad-hash" ? String(repeating: "0", count: 64) : digest(first)
            func submit() {
                store.submit(first: first, second: second, firstHash: hash, secondHash: digest(second),
                             firstReturned: 1.1, secondReturned: 1.2, isScreenStatic: first == second)
            }
            submit()
            if mode == "queue-bound" {
                submit()
                release.signal()
            } else if mode == "pair-bound" || mode == "total-bound" {
                store.drainForFixture()
                submit()
            }
            store.drainForFixture()
            state = store.stateForFixture()
            if mode == "existing-file" {
                let original = try Data(contentsOf: root.appendingPathComponent("pair-000001-first.png"))
                precondition(original == Data("owned sentinel".utf8))
            }
        }
        let report: [String: Any] = [
            "mode": mode, "state": state, "limits": limits.fields,
            "productionLimits": TeleportFrameBodyArchive.Limits.production.fields,
            "deviceAPICalls": 0, "extraScreenshotOrEncodingCalls": 0
        ]
        print(String(data: try JSONSerialization.data(withJSONObject: report, options: .sortedKeys), encoding: .utf8)!)
    }
}
'''


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    raw = PATCH.helper_bytes().decode()
    lines = raw.splitlines(keepends=True)
    assert lines[0].strip() == '#if targetEnvironment(simulator)' and lines[-1].strip() == '#endif'
    body = ''.join(lines[1:-1])
    assert 'queue.sync' not in body and '.wait(' not in body and '.screenshot(' not in body
    source = output / 'fixture.swift'
    source.write_text(body + '\n' + FIXTURE)
    binary = output / 'fixture'
    processes = []

    def invoke(command, **options):
        child = subprocess.Popen(command, **options)
        row = {'owner': 'This task device-free archive fixture', 'pid': child.pid,
               'command': command, 'device': None, 'port': None,
               'stop': 'normal bounded compiler/fixture completion'}
        processes.append(row)
        (output / 'processes.json').write_text(json.dumps(processes, indent=2) + '\n')
        stdout, stderr = child.communicate(timeout=60)
        row['exit'] = child.returncode
        (output / 'processes.json').write_text(json.dumps(processes, indent=2) + '\n')
        if child.returncode:
            raise ValueError(f'Archive fixture command exited {child.returncode}: {command}')
        return stdout, stderr

    with (output / 'compile.log').open('w') as log:
        invoke(['xcrun', 'swiftc', '-swift-version', '5', '-parse-as-library',
                '-module-cache-path', 'example/ios/build/ModuleCache.noindex',
                str(source), '-o', str(binary)], stdout=log, stderr=subprocess.STDOUT)
    modes = ['disabled', 'equal', 'different', 'bad-hash', 'bad-png', 'queue-bound',
             'pair-bound', 'png-bound', 'total-bound', 'filesystem-error', 'existing-file']
    results = []
    for mode in modes:
        root = (output / (mode + '-data')).resolve()
        assert not root.exists(), 'Use a fresh fixture output, preserving prior evidence'
        stdout, stderr = invoke([str(binary), mode, str(root)], stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True,
                                env={**os.environ, 'SIMULATOR_UDID': '00000000-0000-0000-0000-000000000001'})
        (output / (mode + '.stdout')).write_text(stdout)
        (output / (mode + '.stderr')).write_text(stderr)
        report = json.loads(stdout)
        records = [json.loads(line.split('[teleport-frame-bodies] ', 1)[1])
                   for line in stderr.splitlines() if '[teleport-frame-bodies] ' in line]
        assert all(row['helperSHA'] == hashlib.sha256(PATCH.HELPER.read_bytes()).hexdigest() for row in records)
        assert report['productionLimits'] == {'pairs': 1024, 'pngBytes': 16777216,
            'totalBytes': 268435456, 'pendingPairs': 8}
        assert report['deviceAPICalls'] == report['extraScreenshotOrEncodingCalls'] == 0
        phases = [row['phase'] for row in records]
        if mode == 'disabled':
            assert not records and not root.exists()
        else:
            assert report['state']['pending'] == 0
        if mode in ['equal', 'different']:
            assert phases == ['queued', 'initialized', 'saved'] and report['state']['failed'] is False
            saved = records[-1]
            assert hashlib.sha256((root / saved['firstFile']).read_bytes()).hexdigest() == saved['firstHash']
            assert hashlib.sha256((root / saved['secondFile']).read_bytes()).hexdigest() == saved['secondHash']
            assert records[0]['isScreenStatic'] is (mode == 'equal')
        elif mode.endswith('bound'):
            reason = {'queue-bound': 'pending_pairs', 'pair-bound': 'pair_count',
                      'png-bound': 'png_bytes', 'total-bound': 'total_bytes'}[mode]
            assert report['state']['failed'] is True
            assert [r['reason'] for r in records if r['phase'] == 'rejected'] == [reason]
        elif mode != 'disabled':
            assert report['state']['failed'] is True and phases.count('write.error') == 1
            assert 'saved' not in phases
        results.append(report)
    result = {'helperSHA': hashlib.sha256(PATCH.HELPER.read_bytes()).hexdigest(),
              'cases': results, 'deviceAPICalls': 0,
              'scope': 'Actual helper body with only outer Simulator directive removed. Bounds cases instantiate documented smaller Limits; production constants also checked. No SDK/UI execution.'}
    (output / 'report.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    run(parser.parse_args().output)
