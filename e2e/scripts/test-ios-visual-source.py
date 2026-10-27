"""Focused archived-source and restoration controls; never launches an app."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

SPEC = importlib.util.spec_from_file_location('visual_source_gate', Path(__file__).with_name('check-ios-visual-trace.py'))
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


def run(artifact):
    metadata = json.loads((artifact / 'app-identity.json').read_text())
    candidate = metadata['candidateSHA']
    CHECK.source_audit(artifact, candidate)
    cases = ['actual_archived_source_build']
    with tempfile.TemporaryDirectory(prefix='teleport-visual-proof-fixtures-') as tmp:
        root = Path(tmp)
        proof = root / 'archive'
        proof.mkdir()
        names = ['app-identity.json', 'source-manifest.json', 'prepare-ios-visual-trace.py']
        names += ['originals/' + n for n in metadata['originals']]
        names += ['patched/' + n for n in {**metadata['patched'], **metadata['helpers']}]
        for name in names:
            target = proof / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(artifact / name, target)
        changes = {
            'wrong_candidate': lambda d: d.update(candidateSHA='0' * 40),
            'wrong_optin': lambda d: d.update(profile='indigo'),
            'wrong_builder': lambda d: d.update(builderSHA256='0' * 64),
            'wrong_source': lambda d: d.update(sourceSHA='0' * 64),
            'wrong_helper': lambda d: d['helperSourceHashes'].update(native='0' * 64),
            'missing_compiled_fingerprint': lambda d: d['builtApp'].update(compiledFingerprintsPresent=False),
            'missing_binary_hash': lambda d: d['builtApp'].update(executableSHA256=''),
            'wrong_bundle': lambda d: d['builtApp'].update(bundleID='other.app'),
            'extra_patch_scope': lambda d: d['patched'].update(unrelated='0' * 64),
        }
        for label, change in changes.items():
            altered = copy.deepcopy(metadata)
            change(altered)
            (proof / 'app-identity.json').write_text(json.dumps(altered))
            try:
                CHECK.source_audit(proof, candidate)
            except ValueError:
                cases.append(label)
            else:
                raise AssertionError(f'Invalid source identity accepted: {label}')
        (proof / 'app-identity.json').write_text(json.dumps(metadata))
        for group, names in [('originals', metadata['originals']), ('patched', metadata['helpers'])]:
            target = proof / group / next(iter(names))
            saved = target.read_bytes()
            target.write_bytes(saved + b'\nchanged')
            try:
                CHECK.source_audit(proof, candidate)
            except ValueError:
                cases.append('changed_' + group)
            else:
                raise AssertionError('Altered archived source accepted')
            target.write_bytes(saved)
        builder = CHECK.load_builder()
        builder.ROOT = root / 'restore-fixture'
        for name in {**metadata['patched'], **metadata['helpers']}:
            target = builder.ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(proof / 'patched' / name, target)
        changed = builder.ROOT / next(iter(metadata['patched']))
        original = changed.read_bytes()
        changed.write_bytes(original + b'\nunrelated edit')
        try:
            builder.restore(proof)
        except ValueError:
            cases.append('restore_refuses_unrelated_change')
        else:
            raise AssertionError('Restore overwrote unrelated edit')
        assert changed.read_bytes().endswith(b'unrelated edit')
        changed.write_bytes(original)
        builder.restore(proof)
        assert all(builder.sha((builder.ROOT / n).read_bytes()) == sha for n, sha in metadata['originals'].items())
        assert all(not (builder.ROOT / n).exists() for n in metadata['helpers'])
        cases.append('restore_exact_owned_sources_only')
        wrong = subprocess.run([sys.executable, '-B', str(Path(builder.__file__)), 'prepare', '--profile', 'indigo',
                                '--output', str(root / 'must-not-exist')], capture_output=True, text=True)
        assert wrong.returncode != 0 and 'Explicit indigo-visual-touch-trace profile required before accessing app sources' in wrong.stderr
        assert not (root / 'must-not-exist').exists()
        cases.append('wrong_profile_rejected_before_app_access')
    return {'sourceSHA': metadata['sourceSHA'], 'cases': cases, 'deviceAPICalls': 0,
            'scope': 'Focused archived-source fixtures only; not application runtime verification.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    options = parser.parse_args()
    result = run(options.artifact)
    options.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
