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
    builder = CHECK.load_builder()
    scope = json.loads((builder.SOURCE / 'patch-manifest.json').read_text())
    raw_project = (artifact / 'originals' / builder.PROJECT).read_bytes()
    original = b''.join(line for line in raw_project.splitlines(keepends=True)
                        if line not in {f'\t\t\t\t{k} = {v};\n'.encode() for k, v in builder.CCACHE_SETTINGS.items()})
    assert builder.sha(original) == scope['originals'][builder.PROJECT]
    # Insert only the exact five generated settings into the two project configs.
    generated = []
    current = None
    for line in original.splitlines(keepends=True):
        match = builder.re.fullmatch(rb'\t\t([A-F0-9]{24}) /\* [^\n]* \*/ = \{\n', line)
        if match:
            current = match[1].decode()
        generated.append(line)
        if line == b'\t\t\tbuildSettings = {\n' and current in builder.PROJECT_CONFIGS:
            generated.extend(f'\t\t\t\t{k} = {v};\n'.encode() for k, v in builder.CCACHE_SETTINGS.items())
    generated = b''.join(generated)
    assert builder.project_variant(generated, scope['originals'][builder.PROJECT]) == 'rn-ccache-project-settings'
    traced = builder.patched_project(generated)
    assert builder.project_variant(traced, scope['patched'][builder.PROJECT]) == 'rn-ccache-project-settings'
    project_cases = ['exact_generated_settings', 'trace_patch_preserves_generated_settings']
    bad_projects = {
        'wrong_compiler': generated.replace(b'ccache-clang.sh', b'other-clang.sh', 1),
        'wrong_cache_binary': generated.replace(b'/opt/homebrew/bin/ccache', b'/other/ccache', 1),
        'missing_generated_field': generated.replace(b'\t\t\t\tCXX = "$(REACT_NATIVE_PATH)/scripts/xcode/ccache-clang++.sh";\n', b'', 1),
        'duplicate_generated_field': generated.replace(b'\t\t\t\tCCACHE_BINARY = /opt/homebrew/bin/ccache;\n', b'\t\t\t\tCCACHE_BINARY = /opt/homebrew/bin/ccache;\n' * 2, 1),
        'different_deployment_target': generated.replace(b'IPHONEOS_DEPLOYMENT_TARGET = 15.1;', b'IPHONEOS_DEPLOYMENT_TARGET = 16.0;', 1),
        'unrelated_source_reference': generated.replace(b'AppDelegate.swift', b'Other.swift', 1),
        'extra_configuration': generated.replace(b'83CBBA201A601CBA00E9B192', b'83CBBA201A601CBA00E9B199'),
    }
    for label, raw in bad_projects.items():
        try:
            builder.project_variant(raw, scope['originals'][builder.PROJECT])
        except ValueError:
            project_cases.append(label)
        else:
            raise AssertionError('Invalid generated project accepted: ' + label)
    with tempfile.TemporaryDirectory(prefix='teleport-visual-proof-fixtures-') as tmp:
        root = Path(tmp)
        proof = root / 'archive'
        proof.mkdir()
        names = ['app-identity.json', 'source-manifest.json', 'prepare-ios-visual-trace.py', 'observed-inputs.json']
        names += ['observed-inputs/' + n for n in metadata['originals']]
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
        failure_builder = CHECK.load_builder()
        failure_builder.ROOT = root / 'unexpected-input-fixture'
        unexpected = failure_builder.ROOT / builder.PROJECT
        unexpected.parent.mkdir(parents=True)
        unexpected.write_bytes(bad_projects['different_deployment_target'])
        try:
            failure_builder.prepare(root / 'failed-preparation-proof')
        except ValueError:
            assert (root / 'failed-preparation-proof/observed-inputs' / builder.PROJECT).read_bytes() == unexpected.read_bytes()
            assert (root / 'failed-preparation-proof/preparation-failure.json').exists()
            project_cases.append('unexpected_input_archived_before_rejection')
        else:
            raise AssertionError('Unexpected project accepted')
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
    return {'sourceSHA': metadata['sourceSHA'], 'cases': cases, 'project_controls': project_cases, 'deviceAPICalls': 0,
            'scope': 'Focused archived-source fixtures only; not application runtime verification.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    options = parser.parse_args()
    result = run(options.artifact)
    options.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
