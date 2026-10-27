"""Prepare an explicit app measurement; default application sources stay original."""
import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).with_name('ios-visual-trace')
PROFILE = 'indigo-visual-touch-trace'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_identity():
    manifest = json.loads((SOURCE / 'patch-manifest.json').read_text())
    files = ['patch-manifest.json', 'app.patch', *sorted(manifest['helpers'])]
    return sha(Path(__file__).read_bytes() + b''.join(name.encode() + b'\0' + (SOURCE / name).read_bytes() for name in files))


def helper_hashes():
    return {'native': sha((SOURCE / 'VisualEventTrace.swift').read_bytes()),
            'js': sha((SOURCE / 'visualTrace.ts').read_bytes() + (SOURCE / 'visualTraceBuffer.ts').read_bytes())}


def helper_bytes(name):
    hashes = helper_hashes()
    return (SOURCE / name).read_bytes().replace(b'__TELEPORT_VISUAL_NATIVE_SHA__', hashes['native'].encode()).replace(
        b'__TELEPORT_VISUAL_JS_SHA__', hashes['js'].encode())


def prepare(output):
    manifest = json.loads((SOURCE / 'patch-manifest.json').read_text())
    identity = source_identity()
    for name, expected in manifest['originals'].items():
        if sha((ROOT / name).read_bytes()) != expected:
            raise ValueError(f'Original app source differs: {name}')
    if sha((ROOT / manifest['info']).read_bytes()) != manifest['info_original_sha256']:
        raise ValueError('Original application Info.plist differs')
    for name in manifest['helpers'].values():
        if (ROOT / name).exists():
            raise ValueError(f'App measurement output already exists: {name}')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'prepare-ios-visual-trace.py').write_bytes(Path(__file__).read_bytes())
    originals = {name: (ROOT / name).read_bytes() for name in [*manifest['originals'], manifest['info']]}
    for name, data in originals.items():
        target = output / 'originals' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    info = plistlib.loads(originals[manifest['info']])
    info.update(TeleportVisualTrace=True, TeleportVisualTraceSourceSHA=identity)
    patched_info = plistlib.dumps(info, sort_keys=False)
    metadata = {
        'version': 1, 'profile': PROFILE, 'sourceSHA': identity,
        'builderSHA256': sha(Path(__file__).read_bytes()),
        'helperSourceHashes': helper_hashes(),
        'candidateSHA': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'originals': {name: sha(data) for name, data in originals.items()},
        'patched': {**manifest['patched'], manifest['info']: sha(patched_info)},
        'helpers': {name: sha(helper_bytes(label)) for label, name in manifest['helpers'].items()},
        'final_stability_credit': False,
    }
    (output / 'source-manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
    try:
        subprocess.run(['git', 'apply', '--check', str(SOURCE / 'app.patch')], cwd=ROOT, check=True)
        subprocess.run(['git', 'apply', str(SOURCE / 'app.patch')], cwd=ROOT, check=True)
        for label, name in manifest['helpers'].items():
            (ROOT / name).write_bytes(helper_bytes(label))
        (ROOT / manifest['info']).write_bytes(patched_info)
        for name, expected in {**metadata['patched'], **metadata['helpers']}.items():
            data = (ROOT / name).read_bytes()
            if sha(data) != expected:
                raise ValueError(f'Prepared application source differs: {name}')
            target = output / 'patched' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    except BaseException:
        restore(output)
        raise
    return metadata


def restore(output):
    metadata = json.loads((output / 'source-manifest.json').read_text())
    scope = json.loads((SOURCE / 'patch-manifest.json').read_text())
    expected_originals = {**scope['originals'], scope['info']: scope['info_original_sha256']}
    if metadata.get('originals') != expected_originals or set(metadata.get('helpers', {})) != set(scope['helpers'].values()):
        raise ValueError('Application restore source scope differs')
    expected_info = plistlib.loads((output / 'originals' / scope['info']).read_bytes())
    expected_info.update(TeleportVisualTrace=True, TeleportVisualTraceSourceSHA=metadata['sourceSHA'])
    expected_patched = {**scope['patched'], scope['info']: sha(plistlib.dumps(expected_info, sort_keys=False))}
    if metadata.get('patched') != expected_patched:
        raise ValueError('Application restore patch identities differ')
    # Refuse to overwrite other work, including during partial-prepare cleanup.
    for name, before in metadata['originals'].items():
        current = sha((ROOT / name).read_bytes())
        if current not in (before, metadata['patched'][name]):
            raise ValueError(f'Cannot restore modified application source: {name}')
        if sha((output / 'originals' / name).read_bytes()) != before:
            raise ValueError(f'Archived original differs: {name}')
    for name, expected in metadata['helpers'].items():
        if (ROOT / name).exists() and sha((ROOT / name).read_bytes()) != expected:
            raise ValueError(f'Cannot remove changed measurement helper: {name}')
    for name in metadata['originals']:
        (ROOT / name).write_bytes((output / 'originals' / name).read_bytes())
    for name in metadata['helpers']:
        (ROOT / name).unlink(missing_ok=True)


def finish(output, app):
    metadata = json.loads((output / 'source-manifest.json').read_text())
    if metadata.get('sourceSHA') != source_identity() or metadata.get('builderSHA256') != sha(Path(__file__).read_bytes()):
        raise ValueError('App measurement builder changed during build')
    for name, expected in {**metadata['patched'], **metadata['helpers']}.items():
        if sha((ROOT / name).read_bytes()) != expected:
            raise ValueError(f'Application source changed during build: {name}')
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    if info.get('TeleportVisualTrace') is not True or info.get('TeleportVisualTraceSourceSHA') != metadata['sourceSHA']:
        raise ValueError('Built app measurement flag/source identity differs')
    executable = info['CFBundleExecutable']
    if not isinstance(executable, str) or Path(executable).name != executable:
        raise ValueError('Unexpected application executable name')
    binary = (app / executable).read_bytes()
    javascript = (app / 'main.jsbundle').read_bytes()
    if metadata['helperSourceHashes']['native'].encode() not in binary:
        raise ValueError('Built binary lacks the exact compiled native helper fingerprint')
    if metadata['helperSourceHashes']['js'].encode() not in javascript:
        raise ValueError('Built JS bundle lacks the exact compiled JS helper fingerprint')
    metadata['builtApp'] = {
        'executableSHA256': sha(binary),
        'jsBundleSHA256': sha(javascript),
        'bundleID': info['CFBundleIdentifier'],
        'compiledFingerprintsPresent': True,
    }
    (output / 'app-identity.json').write_text(json.dumps(metadata, indent=2) + '\n')
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'finish', 'restore'])
    parser.add_argument('--profile', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--app', type=Path)
    args = parser.parse_args()
    if args.profile != PROFILE:
        raise ValueError('Explicit indigo-visual-touch-trace profile required before accessing app sources')
    if args.command == 'finish' and args.app is None:
        parser.error('finish requires --app')
    result = prepare(args.output) if args.command == 'prepare' else finish(args.output, args.app) if args.command == 'finish' else restore(args.output)
    print(json.dumps({'command': args.command, 'profile': PROFILE, 'sourceSHA': result and result['sourceSHA']}))


if __name__ == '__main__':
    main()
