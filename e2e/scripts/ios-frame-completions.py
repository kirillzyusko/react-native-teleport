"""Additional original-PNG evidence on the existing log-read cadence; no device calls."""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import stat
import time


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


COLLECT = load('completion_original_file_contract', 'collect-ios-frame-bodies.py')
BODY = COLLECT.BODY
ERROR_MARKER = '[teleport-frame-completions] '
MAX_RECORD = 4096
MAX_METADATA = 4 * 1024 * 1024
SCOPE_KEYS = {'candidate', 'run', 'attempt', 'profile', 'device'}
RECORD_KEYS = {'version', 'phase', 'helperSHA', 'pid', 'simulatorUDID', 'ordinal',
               'firstFile', 'secondFile', 'firstHash', 'secondHash', 'firstBytes', 'secondBytes',
               'firstReturned', 'secondReturned', 'isScreenStatic', 'uptime', 'wallTime'}


def source_hash():
    return BODY.sha(Path(__file__).read_bytes())


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('Duplicate completion JSON key')
            result[key] = value
        return result
    def invalid(value):
        raise ValueError('Nonfinite completion JSON value: ' + value)
    return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs, parse_constant=invalid)


def scope_check(scope):
    if (not isinstance(scope, dict) or set(scope) != SCOPE_KEYS or
            not isinstance(scope['candidate'], str) or not re.fullmatch('[a-f0-9]{40}', scope['candidate']) or
            type(scope['run']) is not int or scope['run'] <= 0 or
            type(scope['attempt']) is not int or scope['attempt'] != 1 or
            scope['profile'] != 'indigo-visual-touch-trace' or
            not isinstance(scope['device'], str) or not re.fullmatch(BODY.UUID, scope['device'])):
        raise ValueError('Completion candidate/run/attempt/profile/device scope differs')


def environment_scope(device):
    if (os.environ.get('MAESTRO_IOS_ARCHIVE_FRAMES') != 'true' or
            os.environ.get('MAESTRO_IOS_DURABLE_COMPLETIONS') != 'true'):
        raise ValueError('Completion archive requires both explicit archive opt-ins')
    return {'candidate': os.environ.get('GITHUB_SHA'), 'run': int(os.environ.get('GITHUB_RUN_ID', '0')),
            'attempt': int(os.environ.get('GITHUB_RUN_ATTEMPT', '0')),
            'profile': os.environ.get('MAESTRO_IOS_PROFILE'), 'device': device}


def source_check(artifact, scope):
    scope_check(scope)
    metadata = BODY.source_audit(artifact)
    built = strict_json((Path(artifact) / 'maestro-ios-input.json').read_bytes())
    if (metadata.get('completion_files') != BODY.PATCH.COMPLETIONS or
            built.get('candidate_sha') != scope['candidate']):
        raise ValueError('Completion compiled opt-in/source/candidate differs')
    return metadata


def file_identity(info):
    return {'device': info.st_dev, 'inode': info.st_ino, 'mode': info.st_mode,
            'links': info.st_nlink, 'uid': info.st_uid, 'gid': info.st_gid,
            'bytes': info.st_size, 'mtimeNs': info.st_mtime_ns, 'ctimeNs': info.st_ctime_ns}


def regular_read(path, maximum, boundary):
    COLLECT.no_links(path, boundary)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    started = time.monotonic_ns()
    try:
        before = os.fstat(fd)
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or
                not 0 < before.st_size <= maximum):
            raise ValueError('Completion source is not a bounded unlinked regular file')
        chunks, remaining = [], before.st_size
        while remaining:
            raw = os.read(fd, min(remaining, 1024 * 1024))
            if not raw:
                raise ValueError('Completion source ended before its declared size')
            remaining -= len(raw)
            chunks.append(raw)
        if os.read(fd, 1):
            raise ValueError('Completion source grew during read')
        after, current = os.fstat(fd), path.lstat()
        if file_identity(before) != file_identity(after) or file_identity(after) != file_identity(current):
            raise ValueError('Completion source identity changed during read')
        return b''.join(chunks), {'identity': file_identity(before), 'readStartedNs': started,
                                 'readFinishedNs': time.monotonic_ns()}
    finally:
        os.close(fd)


def validate_completion(record, queued):
    if not isinstance(record, dict) or set(record) != RECORD_KEYS:
        raise ValueError('Completion record fields differ')
    if (type(record['version']) is not int or record['version'] != 1 or
            record['phase'] != 'durable-completion' or type(record['pid']) is not int or
            type(record['ordinal']) is not int or type(record['isScreenStatic']) is not bool):
        raise ValueError('Completion record types/phase differ')
    for key in ['helperSHA', 'pid', 'simulatorUDID', 'ordinal', 'firstHash', 'secondHash',
                'firstBytes', 'secondBytes', 'firstReturned', 'secondReturned', 'isScreenStatic']:
        if type(record[key]) is not type(queued[key]) or record[key] != queued[key]:
            raise ValueError('Completion differs from original queued field: ' + key)
    for key in ['uptime', 'wallTime', 'firstReturned', 'secondReturned']:
        if type(record[key]) not in (int, float) or not math.isfinite(record[key]) or record[key] <= 0:
            raise ValueError('Completion clock type/value differs')
    if record['uptime'] < queued['uptime'] or record['wallTime'] < queued['wallTime']:
        raise ValueError('Completion precedes the original queued record')
    for side in ['first', 'second']:
        if record[side + 'File'] != f"pair-{record['ordinal']:06d}-{side}.png":
            raise ValueError('Completion original PNG name differs')


class Capture:
    def __init__(self, artifact, scope, devices_root, output):
        self.metadata = source_check(artifact, scope)
        self.scope, self.devices_root, self.output = scope, Path(devices_root), Path(output)
        if self.output.exists():
            raise ValueError('Refusing to replace a completion evidence archive')
        self.output.mkdir(mode=0o700)
        self.queued, self.roots, self.completed = {}, {}, {}
        self.inodes, self.total_metadata, self.total_png = set(), 0, 0
        self.result = {'version': 1, 'scope': scope, 'collectorSourceSHA256': source_hash(),
                       'producerHelperSHA256': self.metadata['helper_sha256'],
                       'workerPID': os.getpid(), 'parentPID': os.getppid(),
                       'clock': 'host_python_monotonic_ns', 'startedNs': time.monotonic_ns(),
                       'bounds': {'recordBytes': MAX_RECORD, 'totalMetadataBytes': MAX_METADATA,
                                  'originalPNG': BODY.PATCH.LIMITS},
                       'bodyRecords': [], 'bodyLineSHA256': [], 'producerErrorLines': [],
                       'roots': [], 'members': [], 'completions': [], 'inputEnded': False,
                       'deviceAPICalls': 0, 'errors': [], 'final_stability_credit': False}

    def fail(self, error):
        self.result['errors'].append(f'{type(error).__name__}: {error}')

    def observe(self, raw):
        if self.result['errors']:
            return
        try:
            if len(raw) > 1024 * 1024:
                raise ValueError('Completion input line bound exceeded')
            if ERROR_MARKER.encode() in raw:
                self.result['producerErrorLines'].append({'SHA256': BODY.sha(raw), 'raw': raw.decode()})
                raise ValueError('Producer reported an additional completion write failure')
            if BODY.MARKER.encode() not in raw:
                return
            if not raw.endswith(b'\n') or len(self.result['bodyRecords']) >= 2 * BODY.PATCH.LIMITS['pairs'] + 1:
                raise ValueError('Completion original raw input is incomplete/oversized')
            row, = BODY.parse_unified(raw.decode())
            strict_json(raw.decode().split(BODY.MARKER, 1)[1].replace('\\134', '\\').encode())
            self.result['bodyRecords'].append(row)
            self.result['bodyLineSHA256'].append(BODY.sha(raw.rstrip(b'\n')))
            if (row.get('helperSHA') != self.metadata['helper_sha256'] or
                    row.get('simulatorUDID') != self.scope['device'] or
                    type(row.get('version')) is not int or row['version'] != 1 or
                    type(row.get('pid')) is not int or row['pid'] <= 0 or
                    any(type(row.get(k)) not in (int, float) or not math.isfinite(row[k]) or row[k] <= 0
                        for k in ['uptime', 'wallTime'])):
                raise ValueError('Completion original row source/device/PID/clock differs')
            if row['phase'] == 'queued':
                ordinal = row.get('ordinal')
                if (type(ordinal) is not int or ordinal != len(self.queued) + 1 or
                        ordinal > BODY.PATCH.LIMITS['pairs'] or type(row.get('pendingPairs')) is not int or
                        not 1 <= row['pendingPairs'] <= BODY.PATCH.LIMITS['pendingPairs'] or
                        type(row.get('isScreenStatic')) is not bool):
                    raise ValueError('Completion original queued order/bounds/type differs')
                for side in ['first', 'second']:
                    if (type(row.get(side + 'Bytes')) is not int or
                            not 0 < row[side + 'Bytes'] <= BODY.PATCH.LIMITS['pngBytes'] or
                            not re.fullmatch('[a-f0-9]{64}', row.get(side + 'Hash', '')) or
                            type(row.get(side + 'Returned')) not in (int, float) or
                            not math.isfinite(row[side + 'Returned']) or row[side + 'Returned'] <= 0):
                        raise ValueError('Completion original queued PNG identity differs')
                if not row['firstReturned'] <= row['secondReturned'] <= row['uptime']:
                    raise ValueError('Completion original return-clock order differs')
                self.total_png += row['firstBytes'] + row['secondBytes']
                if self.total_png > BODY.PATCH.LIMITS['totalBytes']:
                    raise ValueError('Completion original total PNG bound exceeded')
                self.queued[ordinal] = row
            elif row['phase'] == 'initialized':
                if self.roots or row.get('limits') != BODY.PATCH.LIMITS:
                    raise ValueError('Completion original root/count/bounds differs')
                root, proof = COLLECT.selected_root(row['root'], row['pid'], self.scope['device'], self.devices_root)
                self.roots[row['pid']] = (root, proof)
                self.result['roots'].append(proof)
                (self.output / str(row['pid'])).mkdir(mode=0o700)
            elif row['phase'] != 'saved':
                raise ValueError('Original producer reported a body error/unknown phase')
            self.reconcile(final=False)
        except (OSError, ValueError, KeyError, TypeError, UnicodeError) as error:
            self.fail(error)

    def preserve(self, root, proof, name, maximum):
        raw, receipt = regular_read(root / name, maximum, self.devices_root / self.scope['device'])
        relative = f"{proof['pid']}/{name}"
        with (self.output / relative).open('xb') as out:
            out.write(raw)
        inode = (receipt['identity']['device'], receipt['identity']['inode'])
        self.result['members'].append({'file': relative, 'SHA256': BODY.sha(raw), 'bytes': len(raw),
                                       'root': proof, 'source': receipt, 'copiedNs': time.monotonic_ns()})
        if inode in self.inodes:
            raise ValueError('Completion source inode reused across members')
        self.inodes.add(inode)
        return raw

    def reconcile(self, *, final):
        if self.result['errors'] or not self.roots:
            return
        pending = [n for n in self.queued if n not in self.completed]
        # Each existing original body line examines at most the existing producer
        # pending-pair bound. EOF makes one final bounded pass; no timer or sleep.
        for ordinal in pending if final else pending[:BODY.PATCH.LIMITS['pendingPairs']]:
            q = self.queued[ordinal]
            if q['pid'] not in self.roots:
                raise ValueError('Completion queued PID differs from original root')
            root, initial = self.roots[q['pid']]
            name = f'pair-{ordinal:06d}-completion.json'
            try:
                (root / name).lstat()
            except FileNotFoundError:
                continue
            _, current = COLLECT.selected_root(initial['runtimeRoot'], q['pid'], self.scope['device'], self.devices_root)
            if current != initial:
                raise ValueError('Completion source container metadata changed')
            raw = self.preserve(root, initial, name, MAX_RECORD)
            self.total_metadata += len(raw)
            if self.total_metadata > MAX_METADATA:
                raise ValueError('Completion metadata total bound exceeded')
            record = strict_json(raw)
            validate_completion(record, q)
            for side in ['first', 'second']:
                png = self.preserve(root, initial, record[side + 'File'], BODY.PATCH.LIMITS['pngBytes'])
                BODY.png_info(png)
                if BODY.sha(png) != q[side + 'Hash'] or len(png) != q[side + 'Bytes']:
                    raise ValueError('Completion original PNG bytes differ')
            self.completed[ordinal] = record
            self.result['completions'].append(record)

    def finish(self, input_ended):
        self.result['inputEnded'] = input_ended
        try:
            self.reconcile(final=True)
            if (not input_ended or not self.queued or len(self.roots) != 1 or
                    len(self.completed) != len(self.queued)):
                raise ValueError('Completion source ended with incomplete original PNG coverage')
        except (OSError, ValueError, KeyError, TypeError, UnicodeError) as error:
            self.fail(error)
        self.result['finishedNs'] = time.monotonic_ns()
        (self.output / 'manifest.json').write_text(json.dumps(self.result, indent=2) + '\n')
        return self.result


class ExistingInput:
    """Observe exactly the reads requested by the unchanged original stream()."""
    def __init__(self, original, capture):
        self.original, self.capture, self.ended = original, capture, False

    def readline(self, size=-1):
        raw = self.original.readline(size)
        if not raw:
            self.ended = True
        else:
            self.capture.observe(raw)
        return raw


def run_original(stream, artifact, device, devices_root, output, original, progress):
    scope = environment_scope(device)
    capture = Capture(artifact, scope, devices_root, Path(output).with_name(Path(output).name + '-completions'))
    reader = ExistingInput(original, capture)
    result = stream(artifact, device, devices_root, output, reader, progress)
    supplementary = capture.finish(reader.ended)
    return result, supplementary
