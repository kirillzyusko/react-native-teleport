"""Independently verify additive completion evidence; never replace original body gates."""
import argparse
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import stat


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


FILES = load('completion_check_original_files', 'collect-ios-frame-bodies.py')
BODY = FILES.BODY
LIVE = load('completion_check_original_live', 'ios-frame-body-live.py')
CAPTURE = Path(__file__).with_name('ios-frame-completions.py')
MAX_RECORD = 4096
MAX_METADATA = 4 * 1024 * 1024
FIELDS = {'version', 'phase', 'helperSHA', 'pid', 'simulatorUDID', 'ordinal',
          'firstFile', 'secondFile', 'firstHash', 'secondHash', 'firstBytes', 'secondBytes',
          'firstReturned', 'secondReturned', 'isScreenStatic', 'uptime', 'wallTime'}


def decoded(raw):
    def dictionary(pairs):
        answer = {}
        for key, value in pairs:
            if key in answer:
                raise ValueError('Duplicate archive JSON key')
            answer[key] = value
        return answer
    def invalid(value):
        raise ValueError('Nonfinite archive JSON value: ' + value)
    return json.loads(raw.decode('utf-8'), object_pairs_hook=dictionary, parse_constant=invalid)


def preflight(artifact, scope):
    # Reject scope before reading any archive member or trusting producer values.
    if (set(scope) != {'candidate', 'run', 'attempt', 'profile', 'device'} or
            not re.fullmatch('[a-f0-9]{40}', scope.get('candidate', '')) or
            type(scope.get('run')) is not int or scope['run'] <= 0 or
            type(scope.get('attempt')) is not int or scope['attempt'] != 1 or
            scope.get('profile') != 'indigo-visual-touch-trace' or
            not re.fullmatch(BODY.UUID, scope.get('device', ''))):
        raise ValueError('Independent completion scope differs')
    metadata = BODY.source_audit(artifact)
    build = decoded((Path(artifact) / 'maestro-ios-input.json').read_bytes())
    if metadata.get('completion_files') != {'version': 1, 'recordBytes': 4096, 'totalBytes': 4194304} or build.get('candidate_sha') != scope['candidate']:
        raise ValueError('Independent completion source/build opt-in differs')
    return metadata


def check(artifact, body_text, scope, manifest, process, read_file, members, *, directories):
    metadata = preflight(artifact, scope)
    expected = {'version': 1, 'scope': scope, 'collectorSourceSHA256': BODY.sha(CAPTURE.read_bytes()),
                'producerHelperSHA256': metadata['helper_sha256'],
                'clock': 'host_python_monotonic_ns',
                'bounds': {'recordBytes': MAX_RECORD, 'totalMetadataBytes': MAX_METADATA,
                           'originalPNG': BODY.PATCH.LIMITS},
                'errors': [], 'inputEnded': True, 'deviceAPICalls': 0, 'final_stability_credit': False,
                'producerErrorLines': []}
    if any(type(manifest.get(k)) is not type(v) or manifest.get(k) != v for k, v in expected.items()):
        raise ValueError('Independent completion manifest source/scope/error/EOF differs')
    if any(type(manifest['scope'].get(k)) is not type(v) or manifest['scope'].get(k) != v for k, v in scope.items()):
        raise ValueError('Independent completion manifest typed scope differs')
    if set(manifest) != set(expected) | {'workerPID', 'parentPID', 'startedNs', 'finishedNs',
                                       'bodyRecords', 'bodyLineSHA256', 'roots', 'members', 'completions'}:
        raise ValueError('Independent completion manifest fields differ')
    if (type(manifest.get('workerPID')) is not int or manifest['workerPID'] <= 0 or
            type(manifest.get('parentPID')) is not int or manifest['parentPID'] <= 0 or
            type(manifest.get('startedNs')) is not int or type(manifest.get('finishedNs')) is not int or
            not 0 < manifest['startedNs'] <= manifest['finishedNs']):
        raise ValueError('Independent completion process/clock identity differs')
    # Bind the same original child. Its failed exit remains explicitly reported;
    # supplementary byte integrity never replaces its original qualification.
    parent_command = process.get('parentCommand', [])
    if (not isinstance(parent_command, list) or len(parent_command) < 6 or
            not all(isinstance(s, str) for s in parent_command) or
            Path(parent_command[1]).name != 'native-diagnostics.mjs' or
            parent_command[2:5] != ['ios', scope['device'], '--'] or
            process.get('wrapperSourceSHA256') != BODY.sha(Path(__file__).with_name('native-diagnostics.mjs').read_bytes()) or
            process.get('inputBufferBytes') != 8 * 1024 * 1024 or
            process.get('pid') != manifest['workerPID'] or process.get('parentPID') != manifest['parentPID'] or
            process.get('workerSourceSHA256') != LIVE.source_hash() or
            process.get('adapterSourceSHA256') != LIVE.adapter_hash() or
            process.get('inputEnded') is not True or process.get('deviceAPICalls') != 0 or
            type(process.get('deviceAPICalls')) is not int or not isinstance(process.get('errors'), list) or
            any(not isinstance(e, str) for e in process['errors']) or
            process.get('nodeVersion') != 'v20.19.4' or process.get('signal') is not None or
            type(process.get('exit')) is not int or process['exit'] not in (0, 1)):
        raise ValueError('Independent completion existing child receipt differs')
    # exit1 is preserved as a failure of the original worker, never promoted to
    # normal completion. Supplementary byte integrity remains independently useful.
    original_worker_success = process['exit'] == 0 and process.get('errors') == []
    if len(body_text.encode()) > 16 * 1024 * 1024:
        raise ValueError('Independent completion original body log bound exceeded')
    rows = BODY.parse_unified(body_text)
    for line in body_text.splitlines():
        if BODY.MARKER in line:
            decoded(line.split(BODY.MARKER, 1)[1].replace('\\134', '\\').encode())
    line_hashes = [BODY.sha(line.encode()) for line in body_text.splitlines() if BODY.MARKER in line]
    if (rows != manifest.get('bodyRecords') or line_hashes != manifest.get('bodyLineSHA256') or
            not rows or len(rows) > 2 * BODY.PATCH.LIMITS['pairs'] + 1):
        raise ValueError('Independent completion original raw rows/digests differ')
    queued, initialized, saved = [], [], []
    total_png = 0
    for row in rows:
        if (type(row.get('version')) is not int or row['version'] != 1 or
                row.get('helperSHA') != metadata['helper_sha256'] or row.get('simulatorUDID') != scope['device'] or
                type(row.get('pid')) is not int or row['pid'] <= 0 or
                any(type(row.get(k)) not in (int, float) or not math.isfinite(row[k]) or row[k] <= 0
                    for k in ['uptime', 'wallTime'])):
            raise ValueError('Independent completion raw source/clock differs')
        if row.get('phase') == 'queued':
            if (type(row.get('ordinal')) is not int or row['ordinal'] != len(queued) + 1 or
                    row['ordinal'] > BODY.PATCH.LIMITS['pairs'] or
                    type(row.get('pendingPairs')) is not int or not 1 <= row['pendingPairs'] <= BODY.PATCH.LIMITS['pendingPairs'] or
                    type(row.get('isScreenStatic')) is not bool):
                raise ValueError('Independent completion queued bounds/order differ')
            for side in ['first', 'second']:
                if (type(row.get(side + 'Bytes')) is not int or not 0 < row[side + 'Bytes'] <= BODY.PATCH.LIMITS['pngBytes'] or
                        not re.fullmatch('[a-f0-9]{64}', row.get(side + 'Hash', '')) or
                        type(row.get(side + 'Returned')) not in (int, float) or
                        not math.isfinite(row[side + 'Returned']) or row[side + 'Returned'] <= 0):
                    raise ValueError('Independent completion queued PNG identity differs')
            if not row['firstReturned'] <= row['secondReturned'] <= row['uptime']:
                raise ValueError('Independent completion queued clock order differs')
            total_png += row['firstBytes'] + row['secondBytes']
            queued.append(row)
        elif row.get('phase') == 'initialized':
            initialized.append(row)
        elif row.get('phase') == 'saved':
            saved.append(row)
        else:
            raise ValueError('Independent completion original body error phase')
    if not queued or len(initialized) != 1 or total_png > BODY.PATCH.LIMITS['totalBytes']:
        raise ValueError('Independent completion original count/root/bounds differ')
    if original_worker_success and (process.get('workerFinished') is not True or
            type(process.get('copiedPNGsObserved')) is not int or process['copiedPNGsObserved'] != 2 * len(queued)):
        raise ValueError('Independent completion original normal-exit receipt is incomplete')
    root, = manifest.get('roots', [])
    init, = initialized
    root_pattern = rf'(?:/var/mobile/Containers/Data/Application|.*/{scope["device"]}/data/Containers/Data/Application)/({BODY.UUID})/tmp/teleport-frame-bodies-{init["pid"]}-{BODY.UUID}'
    match = re.fullmatch(root_pattern, init.get('root', ''))
    if (not match or init.get('limits') != BODY.PATCH.LIMITS or
            root.get('pid') != init['pid'] or root.get('runtimeRoot') != init['root'] or
            root.get('selectedDevice') != scope['device'] or root.get('container') != match[1] or
            root.get('bundleIdentifier') != FILES.BUNDLE or
            not re.fullmatch('[a-f0-9]{64}', root.get('containerMetadataSHA256', '')) or
            any(q['pid'] != init['pid'] for q in queued)):
        raise ValueError('Independent completion original root/MCM identity differs')
    if directories != [str(root['pid'])]:
        raise ValueError('Independent completion archive directory coverage differs')
    completions, receipts = manifest.get('completions', []), manifest.get('members', [])
    if len(completions) != len(queued) or len(receipts) != 3 * len(queued):
        raise ValueError('Independent completion complete member coverage differs')
    expected_names, inodes, metadata_bytes = [], set(), 0
    for q, record in zip(queued, completions):
        n, pid = q['ordinal'], q['pid']
        if not isinstance(record, dict) or set(record) != FIELDS:
            raise ValueError('Independent completion record fields differ')
        if record.get('phase') != 'durable-completion' or type(record.get('version')) is not int or record['version'] != 1:
            raise ValueError('Independent completion version/phase differs')
        for key in ['pid', 'simulatorUDID', 'helperSHA', 'ordinal', 'firstHash', 'secondHash',
                    'firstBytes', 'secondBytes', 'firstReturned', 'secondReturned', 'isScreenStatic']:
            if type(record[key]) is not type(q[key]) or record[key] != q[key]:
                raise ValueError('Independent completion queued binding differs: ' + key)
        for key in ['uptime', 'wallTime']:
            if type(record[key]) not in (int, float) or not math.isfinite(record[key]) or record[key] < q[key]:
                raise ValueError('Independent completion completion clock differs')
        names = [f'{pid}/pair-{n:06d}-completion.json']
        for side in ['first', 'second']:
            expected_name = f'pair-{n:06d}-{side}.png'
            if record[side + 'File'] != expected_name:
                raise ValueError('Independent completion PNG name differs')
            names.append(f'{pid}/{expected_name}')
        raw_record = read_file(names[0])
        metadata_bytes += len(raw_record)
        if not 0 < len(raw_record) <= MAX_RECORD or decoded(raw_record) != record:
            raise ValueError('Independent completion original metadata bytes differ')
        for i, name in enumerate(names):
            raw = raw_record if i == 0 else read_file(name)
            if i:
                side = ['first', 'second'][i - 1]
                BODY.png_info(raw)
                if len(raw) != q[side + 'Bytes'] or BODY.sha(raw) != q[side + 'Hash']:
                    raise ValueError('Independent completion original PNG bytes/hash/CRC differ')
            receipt = receipts[len(expected_names)]
            source = receipt.get('source', {})
            identity = source.get('identity', {})
            if (receipt.get('file') != name or receipt.get('SHA256') != BODY.sha(raw) or
                    receipt.get('bytes') != len(raw) or receipt.get('root') != root or
                    set(identity) != {'device', 'inode', 'mode', 'links', 'uid', 'gid', 'bytes', 'mtimeNs', 'ctimeNs'} or
                    any(type(v) is not int or v < (1 if k in ['inode', 'mode', 'links', 'bytes', 'mtimeNs', 'ctimeNs'] else 0)
                        for k, v in identity.items()) or
                    not stat.S_ISREG(identity['mode']) or identity['links'] != 1 or identity['bytes'] != len(raw) or
                    any(type(v) is not int for v in [source.get('readStartedNs'), source.get('readFinishedNs'), receipt.get('copiedNs')]) or
                    not manifest['startedNs'] <= source['readStartedNs'] <= source['readFinishedNs'] <= receipt['copiedNs'] <= manifest['finishedNs']):
                raise ValueError('Independent completion descriptor/copy provenance differs')
            inode = identity['device'], identity['inode']
            if inode in inodes:
                raise ValueError('Independent completion source inode repeated')
            inodes.add(inode)
            expected_names.append(name)
    if (metadata_bytes > MAX_METADATA or len(members) != len(set(members)) or
            set(members) != {'manifest.json', *expected_names}):
        raise ValueError('Independent completion archive extras/duplicates/bounds differ')
    saved_ordinals = [r.get('ordinal') for r in saved]
    return {'version': 1, 'scope': scope, 'completionPairs': len(queued), 'PNGs': 2 * len(queued),
            'originalSavedRows': len(saved),
            'originalSavedCoverageComplete': saved_ordinals == list(range(1, len(queued) + 1)),
            'originalWorkerSucceeded': original_worker_success,
            'scopeLimit': 'Supplementary original-byte integrity only. All original log/body/suite/video gates remain mandatory and separate.',
            'collectorSourceSHA256': BODY.sha(CAPTURE.read_bytes()),
            'checkerSourceSHA256': BODY.sha(Path(__file__).read_bytes()),
            'errors': [], 'final_stability_credit': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', required=True, type=Path)
    parser.add_argument('--body-log', required=True, type=Path)
    parser.add_argument('--archive', required=True, type=Path)
    parser.add_argument('--live-process', required=True, type=Path)
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--run', required=True, type=int)
    parser.add_argument('--attempt', required=True, type=int)
    parser.add_argument('--device', required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    result = {'errors': [], 'final_stability_credit': False}
    try:
        scope = {'candidate': args.candidate, 'run': args.run, 'attempt': args.attempt,
                 'profile': 'indigo-visual-touch-trace', 'device': args.device}
        preflight(args.artifact, scope)
        def read(name):
            file = args.archive / name
            FILES.no_links(file, args.archive)
            return FILES.regular_bytes(file, 32 * 1024 * 1024 if name == 'manifest.json' else BODY.PATCH.LIMITS['pngBytes'])
        names, directories = [], []
        for file in args.archive.rglob('*'):
            FILES.no_links(file, args.archive)
            if file.is_file():
                names.append(str(file.relative_to(args.archive)))
            elif file.is_dir():
                directories.append(str(file.relative_to(args.archive)))
            elif not file.is_dir():
                raise ValueError('Nonregular completion archive member')
        result = check(args.artifact, args.body_log.read_text(), scope, decoded(read('manifest.json')),
                       decoded(args.live_process.read_bytes()), read, names, directories=directories)
    except (OSError, ValueError, KeyError, TypeError, UnicodeError) as error:
        result['errors'].append(f'{type(error).__name__}: {error}')
    with args.output.open('x') as out:
        out.write(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
    raise SystemExit(bool(result['errors']))


if __name__ == '__main__':
    main()
