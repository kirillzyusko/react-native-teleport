"""Preserve existing SDK PNGs from the existing live log stream, without device calls."""
import argparse
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys
import time


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


COLLECT = load('live_body_file_contract', 'collect-ios-frame-bodies.py')
BODY = COLLECT.BODY
SCREEN = COLLECT.SCREEN
LINE_BYTES = 1024 * 1024
BODY_LOG_BYTES = 16 * 1024 * 1024


def source_hash():
    return BODY.sha(Path(__file__).read_bytes())


def adapter_hash():
    return BODY.sha(Path(__file__).with_suffix('.mjs').read_bytes())


def line_hashes(text):
    return [BODY.sha(line.encode()) for line in text.splitlines() if BODY.MARKER in line]


def stream(artifact, device, devices_root, output, input_stream, progress=None):
    output = Path(output)
    if output.exists():
        raise ValueError('Refusing to replace a live body archive')
    output.mkdir(parents=True, mode=0o700)
    live = {'version': 1, 'workerSourceSHA256': source_hash(), 'adapterSourceSHA256': adapter_hash(),
            'workerPID': os.getpid(), 'parentPID': os.getppid(), 'records': [], 'lineSHA256': [],
            'clock': 'host_python_monotonic_ns', 'startedMonotonicNs': time.monotonic_ns(),
            'startedWallTimeNs': time.time_ns(), 'copyReceipts': [],
            'bounds': {'lineBytes': LINE_BYTES, 'bodyLogBytes': BODY_LOG_BYTES}}
    result = {'version': 1, 'deviceUDID': device, 'helperSHA': BODY.sha(BODY.PATCH.HELPER.read_bytes()),
              'collectorSourceSHA256': BODY.sha(Path(__file__).with_name('collect-ios-frame-bodies.py').read_bytes()),
              'roots': [], 'files': [], 'deviceAPICalls': 0, 'errors': [],
              'final_stability_credit': False, 'liveExport': live}
    queued, saved, roots = {}, set(), {}
    total = body_bytes = 0
    try:
        metadata = BODY.source_audit(artifact)
        if SCREEN.source_audit(artifact):
            raise ValueError('Live exporter source proof differs')
        while True:
            raw = input_stream.readline(LINE_BYTES + 1)
            if not raw:
                break
            if len(raw) > LINE_BYTES:
                raise ValueError('Live log line is oversized')
            if BODY.MARKER.encode() not in raw:
                continue
            if not raw.endswith(b'\n'):
                raise ValueError('Live body log line is incomplete')
            body_bytes += len(raw)
            if body_bytes > BODY_LOG_BYTES or len(live['records']) >= 2 * BODY.PATCH.LIMITS['pairs'] + 1:
                raise ValueError('Live body metadata bound exceeded')
            row, = BODY.parse_unified(raw.decode())
            if (row.get('helperSHA') != metadata['helper_sha256'] or row.get('simulatorUDID') != device or
                    type(row.get('version')) is not int or row['version'] != 1 or
                    type(row.get('pid')) is not int or row['pid'] <= 0 or
                    any(type(row.get(k)) not in (int, float) or not math.isfinite(row[k])
                        for k in ['uptime', 'wallTime'])):
                raise ValueError('Live body source/process/device/clock identity differs')
            live['records'].append(row)
            live['lineSHA256'].append(BODY.sha(raw.rstrip(b'\n')))
            pid = row['pid']
            if row['phase'] == 'initialized':
                if roots or row.get('limits') != BODY.PATCH.LIMITS:
                    raise ValueError('Unexpected live runner root or bounds')
                root, receipt = COLLECT.selected_root(row['root'], pid, device, Path(devices_root))
                roots[pid] = (root, receipt)
                result['roots'].append(receipt)
                (output / str(pid)).mkdir(mode=0o700)
            elif row['phase'] == 'queued':
                ordinal = row.get('ordinal')
                if (type(ordinal) is not int or ordinal != len(queued) + 1 or
                        not 1 <= ordinal <= BODY.PATCH.LIMITS['pairs'] or
                        type(row.get('pendingPairs')) is not int or
                        not 1 <= row['pendingPairs'] <= BODY.PATCH.LIMITS['pendingPairs']):
                    raise ValueError('Live ordinal/pending bound differs')
                for side in ['first', 'second']:
                    size = row.get(side + 'Bytes')
                    if (type(size) is not int or not 0 < size <= BODY.PATCH.LIMITS['pngBytes'] or
                            not re.fullmatch(r'[a-f0-9]{64}', row.get(side + 'Hash', ''))):
                        raise ValueError('Live PNG identity or size bound differs')
                total += row['firstBytes'] + row['secondBytes']
                if total > BODY.PATCH.LIMITS['totalBytes']:
                    raise ValueError('Live total PNG bound exceeded')
                queued[ordinal] = row
            elif row['phase'] == 'saved':
                ordinal = row.get('ordinal')
                if type(ordinal) is not int or ordinal not in queued or ordinal in saved or pid not in roots:
                    raise ValueError('Live saved row is missing, duplicate or foreign')
                q = queued[ordinal]
                if q['pid'] != pid:
                    raise ValueError('Live queued/saved PID differs')
                root, initial = roots[pid]
                _, current = COLLECT.selected_root(initial['runtimeRoot'], pid, device, Path(devices_root))
                if current != initial:
                    raise ValueError('Live source container metadata changed')
                for side in ['first', 'second']:
                    name = f'pair-{ordinal:06d}-{side}.png'
                    if (row.get(side + 'File') != name or row.get(side + 'Hash') != q[side + 'Hash'] or
                            row.get(side + 'Bytes') != q[side + 'Bytes']):
                        raise ValueError('Live saved filename/hash/size differs')
                    source = root / name
                    COLLECT.no_links(source, Path(devices_root) / device)
                    before = source.lstat()
                    raw_png = COLLECT.regular_bytes(source, BODY.PATCH.LIMITS['pngBytes'])
                    after = source.lstat()
                    identity = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
                    if identity(before) != identity(after):
                        raise ValueError('Live source file identity changed')
                    target = output / str(pid) / name
                    with target.open('xb') as target_file:
                        target_file.write(raw_png)
                    # Preserve bytes before reporting a malformed producer value.
                    item = {'file': f'{pid}/{name}', 'sha256': BODY.sha(raw_png),
                            'bytes': len(raw_png), 'png': BODY.png_info(raw_png)}
                    result['files'].append(item)
                    if item['sha256'] != q[side + 'Hash'] or item['bytes'] != q[side + 'Bytes']:
                        raise ValueError('Live source PNG bytes differ')
                    live['copyReceipts'].append({'file': item['file'], 'sourceRoot': initial['runtimeRoot'],
                        'containerMetadataSHA256': initial['containerMetadataSHA256'],
                        'sourceFileIdentity': {'device': before.st_dev, 'inode': before.st_ino,
                            'bytes': before.st_size, 'mtimeNs': before.st_mtime_ns},
                        'copiedMonotonicNs': time.monotonic_ns(), 'copiedWallTimeNs': time.time_ns()})
                saved.add(ordinal)
                if progress:
                    progress({'phase': 'copied', 'workerPID': os.getpid(), 'PNGs': len(result['files'])})
            else:
                raise ValueError('Live producer reported an unexpected/error phase')
        if not queued or len(queued) != len(saved) or len(roots) != 1:
            raise ValueError('Live source ended with incomplete PNG coverage')
    except (OSError, ValueError, KeyError, TypeError) as error:
        result['errors'].append(f'{type(error).__name__}: {error}')
    live['finishedMonotonicNs'] = time.monotonic_ns()
    live['finishedWallTimeNs'] = time.time_ns()
    (output / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def audit(manifest, body_text, process, device):
    if not isinstance(process, dict) or not isinstance(manifest, dict):
        raise ValueError('Missing live exporter process/manifest proof')
    if (manifest.get('deviceUDID') != device or manifest.get('deviceAPICalls') != 0 or
            manifest.get('errors') != [] or manifest.get('final_stability_credit') is not False):
        raise ValueError('Live exporter device/error/scope receipt differs')
    parent_command = process.get('parentCommand', [])
    if (not isinstance(parent_command, list) or len(parent_command) < 6 or
            not all(isinstance(s, str) for s in parent_command) or
            Path(parent_command[1]).name != 'native-diagnostics.mjs' or
            parent_command[2:5] != ['ios', device, '--'] or
            process.get('wrapperSourceSHA256') != BODY.sha(Path(__file__).with_name('native-diagnostics.mjs').read_bytes())):
        raise ValueError('Live exporter original wrapper command/source differs')
    live = manifest.get('liveExport', {})
    expected = {'version': 1, 'workerSourceSHA256': source_hash(), 'adapterSourceSHA256': adapter_hash(),
                'clock': 'host_python_monotonic_ns',
                'bounds': {'lineBytes': LINE_BYTES, 'bodyLogBytes': BODY_LOG_BYTES}}
    if any(live.get(k) != v for k, v in expected.items()):
        raise ValueError('Live exporter source/clock/bounds proof differs')
    if (process.get('version') != 1 or process.get('device') != device or process.get('exit') != 0 or
            process.get('signal') is not None or process.get('errors') != [] or
            process.get('inputEnded') is not True or process.get('deviceAPICalls') != 0 or
            process.get('inputBufferBytes') != 8 * 1024 * 1024 or
            process.get('nodeVersion') != 'v20.19.4' or
            process.get('workerFinished') is not True or
            process.get('copiedPNGsObserved') != len(manifest.get('files', [])) or
            process.get('workerSourceSHA256') != source_hash() or
            process.get('adapterSourceSHA256') != adapter_hash() or
            type(process.get('pid')) is not int or type(process.get('parentPID')) is not int or
            process['pid'] != live.get('workerPID') or process['parentPID'] != live.get('parentPID')):
        raise ValueError('Live exporter owned-process proof differs')
    if live.get('records') != BODY.parse_unified(body_text) or live.get('lineSHA256') != line_hashes(body_text):
        raise ValueError('Live exporter source rows differ from final raw log')
    for k in ['startedMonotonicNs', 'finishedMonotonicNs', 'startedWallTimeNs', 'finishedWallTimeNs']:
        if type(live.get(k)) is not int or live[k] <= 0:
            raise ValueError('Live exporter host clock type differs')
    if live['finishedMonotonicNs'] < live['startedMonotonicNs']:
        raise ValueError('Live exporter host clock order differs')
    copies = live.get('copyReceipts', [])
    roots = {r['pid']: r for r in manifest['roots']}
    if [r.get('file') for r in copies] != [r['file'] for r in manifest['files']]:
        raise ValueError('Live exporter copy coverage differs')
    previous = live['startedMonotonicNs']
    for receipt in copies:
        root = roots[int(receipt['file'].split('/')[0])]
        file_identity = receipt.get('sourceFileIdentity', {})
        when = receipt.get('copiedMonotonicNs')
        if (receipt.get('sourceRoot') != root['runtimeRoot'] or
                receipt.get('containerMetadataSHA256') != root['containerMetadataSHA256'] or
                type(when) is not int or not previous <= when <= live['finishedMonotonicNs'] or
                type(receipt.get('copiedWallTimeNs')) is not int or
                any(type(file_identity.get(k)) is not int or file_identity[k] < (0 if k == 'device' else 1)
                    for k in ['device', 'inode', 'bytes', 'mtimeNs']) or
                file_identity['bytes'] != next(f['bytes'] for f in manifest['files'] if f['file'] == receipt['file'])):
            raise ValueError('Live exporter copy provenance differs')
        previous = when


def finalize(text, artifact, device, output, body_text, live_archive, process):
    output, live_archive = Path(output), Path(live_archive)
    if output.exists():
        raise ValueError('Refusing to replace a previous body archive')
    output.mkdir(parents=True)
    result = {'version': 1, 'deviceUDID': device, 'helperSHA': BODY.sha(BODY.PATCH.HELPER.read_bytes()),
              'collectorSourceSHA256': BODY.sha(Path(__file__).with_name('collect-ios-frame-bodies.py').read_bytes()),
              'bodySource': BODY.transport_source(text, body_text), 'roots': [], 'files': [],
              'deviceAPICalls': 0, 'errors': [], 'final_stability_credit': False}
    try:
        metadata = BODY.source_audit(artifact)
        if SCREEN.source_audit(artifact):
            raise ValueError('Live finalization source proof differs')
        COLLECT.no_links(live_archive, live_archive.parent)
        manifest = json.loads(COLLECT.regular_bytes(live_archive / 'manifest.json', 32 * 1024 * 1024))
        audit(manifest, body_text, process, device)
        contract = BODY.runtime_contract(BODY.parse_unified(body_text), SCREEN.parse(text), metadata, device)
        names = []
        directories = []
        for file in live_archive.rglob('*'):
            COLLECT.no_links(file, live_archive)
            if file.is_file():
                names.append(str(file.relative_to(live_archive)))
            elif file.is_dir():
                directories.append(str(file.relative_to(live_archive)))
            else:
                raise ValueError('Live archive contains a non-regular member')
        if set(directories) != {str(r['pid']) for r in manifest['roots']}:
            raise ValueError('Unexpected live archive directory')
        if set(names) != {'manifest.json', *(f['file'] for f in manifest['files'])}:
            raise ValueError('Unexpected live archive member')
        def read_file(name):
            path = live_archive / name
            COLLECT.no_links(path, live_archive)
            return COLLECT.regular_bytes(path, BODY.PATCH.LIMITS['pngBytes'])
        files = BODY.file_audit(contract, manifest, read_file)
        result.update(roots=manifest['roots'], liveExport=manifest['liveExport'], liveProcess=process)
        for item in files:
            target = output / item['file']
            target.parent.mkdir(exist_ok=True)
            with target.open('xb') as stream_file:
                stream_file.write(read_file(item['file']))
            result['files'].append(item)
    except (OSError, ValueError, KeyError, TypeError) as error:
        result['errors'].append(f'{type(error).__name__}: {error}')
    (output / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', type=Path, required=True)
    parser.add_argument('--device', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--devices-root', type=Path, default=Path.home() / 'Library/Developer/CoreSimulator/Devices')
    args = parser.parse_args()
    emit = lambda row: print(json.dumps(row), flush=True)
    supplementary = None
    if os.environ.get('MAESTRO_IOS_DURABLE_COMPLETIONS') == 'true':
        completions = load('additional_frame_completions', 'ios-frame-completions.py')
        result, supplementary = completions.run_original(
            stream, args.artifact, args.device, args.devices_root, args.output, sys.stdin.buffer, emit)
    else:
        result = stream(args.artifact, args.device, args.devices_root, args.output, sys.stdin.buffer, emit)
    emit({'phase': 'finished', 'workerPID': os.getpid(), 'errors': result['errors'],
          'PNGs': len(result['files']), 'deviceAPICalls': 0})
    raise SystemExit(bool(result['errors']) or bool(supplementary and supplementary['errors']))
