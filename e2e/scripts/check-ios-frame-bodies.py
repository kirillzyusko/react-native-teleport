"""Reparse every original static pair, source identity and archived PNG body."""
import argparse
import importlib.util
import json
from pathlib import Path
import re


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BODY = load('frame_body_check_contract', 'ios-frame-bodies.py')
SCREEN = load('frame_body_original_screen', 'check-ios-screen-trace.py')
COLLECT = load('frame_body_file_contract', 'collect-ios-frame-bodies.py')


def check(text, artifact, manifest, read_file, names, device):
    result = {'version': 1, 'helperSHA': BODY.sha(BODY.PATCH.HELPER.read_bytes()),
              'deviceUDID': device, 'errors': [], 'final_stability_credit': False,
              'limit': 'Original PNG bytes and API-return times are not physical display transaction timestamps.'}
    try:
        metadata = BODY.source_audit(artifact)
        errors = SCREEN.source_audit(artifact)
        if errors:
            raise ValueError(str(errors))
        screens = SCREEN.parse(text)
        contract = BODY.runtime_contract(BODY.parse(text), screens, metadata, device)
        if (manifest.get('deviceUDID') != device or manifest.get('deviceAPICalls') != 0 or
                manifest.get('errors') != [] or manifest.get('final_stability_credit') is not False):
            raise ValueError('Collection device/scope/error receipt differs')
        roots = manifest.get('roots', [])
        if len(roots) != len(contract['roots']) or {r.get('pid') for r in roots} != set(contract['roots']):
            raise ValueError('Collection root/PID coverage differs')
        for root in roots:
            pid = root['pid']
            raw = contract['roots'][pid]
            prefix = rf'(?:/var/mobile|/[^\n]+/Devices/{re.escape(device)}/data)/Containers/Data/Application/'
            if (root.get('runtimeRoot') != raw or root.get('selectedDevice') != device or
                    root.get('bundleIdentifier') != COLLECT.BUNDLE or
                    not re.fullmatch(BODY.UUID, root.get('container', '')) or
                    not re.fullmatch(r'[a-f0-9]{64}', root.get('containerMetadataSHA256', '')) or
                    '..' in Path(raw).parts or
                    not re.fullmatch(prefix + rf"{root['container']}/tmp/teleport-frame-bodies-{pid}-{BODY.UUID}", raw)):
                raise ValueError('Collection root provenance differs')
        files = BODY.file_audit(contract, manifest, read_file)
        if set(names) != {'manifest.json', *(f['file'] for f in files)} or len(names) != len(files) + 1:
            raise ValueError('Body artifact includes missing, duplicate or unexpected files')
        result.update(pairs=len(contract['pairs']), PNGs=len(files), totalBytes=contract['totalBytes'],
                      processes=sorted(contract['roots']), files=files,
                      staticPairs=[{'sequence': p['sequence'], 'pid': p['pid'], 'ordinal': p['ordinal'],
                                    'isScreenStatic': p['queued']['isScreenStatic'],
                                    'firstHash': p['queued']['firstHash'], 'secondHash': p['queued']['secondHash'],
                                    'firstReturned': p['queued']['firstReturned'], 'secondReturned': p['queued']['secondReturned']}
                                   for p in contract['pairs']])
    except (OSError, ValueError, KeyError, TypeError) as error:
        result['errors'].append(f'{type(error).__name__}: {error}')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--artifact', type=Path, required=True)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--device', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    files = [p for p in args.archive.rglob('*') if p.is_file()]
    names = [p.relative_to(args.archive).as_posix() for p in files]

    def read_file(name):
        path = args.archive / name
        COLLECT.no_links(path, args.archive)
        return COLLECT.regular_bytes(path, BODY.PATCH.LIMITS['pngBytes'])

    result = check(args.log.read_text(), args.artifact,
                   json.loads((args.archive / 'manifest.json').read_text()), read_file, names, args.device)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ('files', 'staticPairs')}))
    raise SystemExit(bool(result['errors']))


if __name__ == '__main__':
    main()
