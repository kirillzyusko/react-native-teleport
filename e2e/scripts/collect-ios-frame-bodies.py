"""Finalize selected runner PNG evidence, including explicitly requested live preservation."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import re
import stat


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BODY = load('body_contract', 'ios-frame-bodies.py')
SCREEN = load('old_screen_contract', 'check-ios-screen-trace.py')
BUNDLE = 'dev.mobile.maestro-driver-iosUITests.xctrunner'


def regular_bytes(path, maximum):
    """Never follow an archive file link; reject files changing during the read."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or not 0 < before.st_size <= maximum:
            raise ValueError('Body source is not a bounded regular file')
        chunks = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(fd, min(remaining, 1024 * 1024))
            if not chunk:
                raise ValueError('Body source truncated during collection')
            chunks.append(chunk)
            remaining -= len(chunk)
        after = os.fstat(fd)
        current = Path(path).lstat()
        if ((before.st_ino, before.st_dev, before.st_size, before.st_mtime_ns) !=
                (after.st_ino, after.st_dev, after.st_size, after.st_mtime_ns) or
                (current.st_ino, current.st_dev, current.st_size, current.st_mtime_ns) !=
                (after.st_ino, after.st_dev, after.st_size, after.st_mtime_ns) or
                not stat.S_ISREG(current.st_mode)):
            raise ValueError('Body source changed during collection')
        return b''.join(chunks)
    finally:
        os.close(fd)


def no_links(path, boundary):
    """Every component below the explicitly selected device must be real."""
    relative = path.relative_to(boundary)
    current = boundary
    if not stat.S_ISDIR(current.lstat().st_mode):
        raise ValueError('Selected device directory is missing or a link')
    for part in relative.parts:
        current = current / part
        if stat.S_ISLNK(current.lstat().st_mode):
            raise ValueError('Body source path contains a link')


def selected_root(raw_root, pid, device, devices_root):
    device_dir = devices_root / device
    containers = device_dir / 'data/Containers/Data/Application'
    raw = Path(raw_root)
    if '..' in raw.parts or not raw.is_absolute():
        raise ValueError('Invalid body root path')
    # Foundation on Simulator may expose its virtual /var/mobile prefix.
    virtual = Path('/var/mobile/Containers/Data/Application')
    if raw.is_relative_to(virtual):
        raw = containers / raw.relative_to(virtual)
    relative = raw.relative_to(containers)
    if (len(relative.parts) != 3 or not re.fullmatch(BODY.UUID, relative.parts[0]) or
            relative.parts[1] != 'tmp' or
            not re.fullmatch(rf'teleport-frame-bodies-{pid}-{BODY.UUID}', relative.parts[2])):
        raise ValueError('Body root is outside the exact selected SDK temporary container')
    no_links(raw, device_dir)
    if not raw.is_dir():
        raise ValueError('Body root is not a directory')
    metadata_path = containers / relative.parts[0] / '.com.apple.mobile_container_manager.metadata.plist'
    no_links(metadata_path, device_dir)
    metadata_raw = regular_bytes(metadata_path, 1024 * 1024)
    metadata = plistlib.loads(metadata_raw)
    if metadata.get('MCMMetadataIdentifier') != BUNDLE:
        raise ValueError('Body root belongs to another app container')
    return raw, {'pid': pid, 'runtimeRoot': raw_root, 'selectedDevice': device,
                 'container': relative.parts[0], 'bundleIdentifier': BUNDLE,
                 'containerMetadataSHA256': BODY.sha(metadata_raw)}


def collect(text, artifact, device, devices_root, output, *, body_text, live_archive=None, live_process=None):
    if live_archive is not None:
        live = load('body_live_finalizer', 'ios-frame-body-live.py')
        return live.finalize(text, artifact, device, output, body_text, live_archive, live_process)
    output = Path(output)
    if output.exists():
        raise ValueError('Refusing to replace a previous body archive')
    output.mkdir(parents=True)
    result = {'version': 1, 'deviceUDID': device, 'helperSHA': BODY.sha(BODY.PATCH.HELPER.read_bytes()),
              'bodySource': BODY.transport_source(text, body_text),
              'collectorSourceSHA256': BODY.sha(Path(__file__).read_bytes()),
              'roots': [], 'files': [], 'deviceAPICalls': 0, 'errors': [], 'final_stability_credit': False}
    try:
        metadata = BODY.source_audit(artifact)
        errors = SCREEN.source_audit(artifact)
        if errors:
            raise ValueError(str(errors))
        contract = BODY.runtime_contract(BODY.parse_unified(body_text), SCREEN.parse(text), metadata, device)
        for pid, raw_root in contract['roots'].items():
            root, receipt = selected_root(raw_root, pid, device, Path(devices_root))
            result['roots'].append(receipt)
            pairs = [p for p in contract['pairs'] if p['pid'] == pid]
            expected = {p['saved'][side + 'File'] for p in pairs for side in ('first', 'second')}
            if set(os.listdir(root)) != expected:
                raise ValueError('Body root contains missing, incomplete or unexpected files')
            (output / str(pid)).mkdir()
            for pair in pairs:
                for side in ('first', 'second'):
                    name = pair['saved'][side + 'File']
                    path = root / name
                    no_links(path, Path(devices_root) / device)
                    raw = regular_bytes(path, BODY.PATCH.LIMITS['pngBytes'])
                    target = output / str(pid) / name
                    with target.open('xb') as stream:
                        stream.write(raw)
                    # Preserve copied bytes before interpreting any failure.
                    result['files'].append({'file': f'{pid}/{name}', 'sha256': BODY.sha(raw),
                                            'bytes': len(raw), 'png': BODY.png_info(raw)})
            if set(os.listdir(root)) != expected:
                raise ValueError('Body root changed during collection')
        order = {f"{p['pid']}/{p['saved'][side + 'File']}": i * 2 + j
                 for i, p in enumerate(contract['pairs']) for j, side in enumerate(('first', 'second'))}
        result['files'].sort(key=lambda f: order[f['file']])
        BODY.file_audit(contract, result, lambda name: (output / name).read_bytes())
    except (OSError, ValueError, KeyError, TypeError) as error:
        result['errors'].append(f'{type(error).__name__}: {error}')
    (output / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--body-log', type=Path, required=True)
    parser.add_argument('--artifact', type=Path, required=True)
    parser.add_argument('--device', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--devices-root', type=Path, default=Path.home() / 'Library/Developer/CoreSimulator/Devices')
    parser.add_argument('--live-archive', type=Path)
    parser.add_argument('--live-process', type=Path)
    args = parser.parse_args()
    result = collect(args.log.read_bytes().decode(), args.artifact, args.device, args.devices_root, args.output,
                     body_text=args.body_log.read_bytes().decode(), live_archive=args.live_archive,
                     live_process=json.loads(args.live_process.read_text()) if args.live_process else None)
    print(json.dumps({k: v for k, v in result.items() if k != 'files'}))
    raise SystemExit(bool(result['errors']))


if __name__ == '__main__':
    main()
