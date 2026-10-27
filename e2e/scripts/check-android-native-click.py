"""Independently audit SDK-only click diagnostics; never stability credit."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import zipfile

spec = importlib.util.spec_from_file_location('click_patch', Path(__file__).with_name('patch-maestro-native-click.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def check(directory, maestro_log, apksigner):
    errors = []
    def expect(value, message):
        if not value:
            errors.append(message)
    directory = Path(directory)
    patch_dir = directory / 'sdk-click'
    manifest = json.loads((patch_dir / 'native-click-patch.json').read_text())
    expected = {'version': 1, 'mode': 'input-trace-sdk', 'final_stability_credit': False,
        'input_apk_sha256': builder.APK_SHA, 'original_source_sha256': builder.SMALI_SHA,
        'apktool_sha256': builder.TOOL_SHA, 'public_key_sha256': builder.KEY_SHA,
        'certificate_sha256': builder.CERT_SHA, 'sdk_app_sha256': builder.APP_SHA,
        'foreground_driver_sha256': builder.DRIVER_SHA, 'installation_modified': True,
        'all_added_calls_after_click_returns': True, 'changed_jar_entries': ['maestro-server.apk'],
        'builder_sha256': builder.sha(Path(builder.__file__).read_bytes()),
        'tail_sha256': builder.sha(Path(builder.__file__).with_name('native-click-log.smali').read_bytes())}
    for key, value in expected.items():
        expect(manifest.get(key) == value, f'Unexpected patch field: {key}')
    original, modified = patch_dir / 'server-original.apk', patch_dir / 'server-diagnostic.apk'
    expect(builder.sha(original.read_bytes()) == builder.APK_SHA, 'Original server APK differs')
    expect(builder.sha(modified.read_bytes()) == manifest['output_apk_sha256'], 'Diagnostic server APK differs')
    with zipfile.ZipFile(original) as a, zipfile.ZipFile(modified) as b:
        expect(builder.apk_changes(a, b) == manifest['changed_apk_entries'], 'APK ZIP changes differ')
        expect(builder.sha(b.read('classes6.dex')) == 'f3d7574eac98657754ebb9b93a73918811206baa2e1baa9ea9857a0dce722bf4',
               'Diagnostic DEX differs from independently assembled prototype')
    source = (patch_dir / 'UiDeviceExt.original.smali').read_text()
    tail = Path(builder.__file__).with_name('native-click-log.smali').read_text()
    expect(builder.patch(source, tail) == (patch_dir / 'UiDeviceExt.patched.smali').read_text(), 'Source patch differs')
    normalize = lambda text: [line for line in text.splitlines() if line.strip()]
    expect(normalize((patch_dir / 'UiDeviceExt.roundtrip.smali').read_text()) == normalize(builder.patch(source, tail)),
           'DEX roundtrip differs')
    certs = subprocess.check_output([str(apksigner), 'verify', '--verbose', '--print-certs', str(modified)], text=True)
    expect(f'certificate SHA-256 digest: {builder.CERT_SHA}' in certs, 'SDK certificate differs')
    runtime = json.loads((directory / 'native-click-runtime-install.json').read_text())
    expect(runtime == {'jar_sha256': manifest['output_jar_sha256'], 'server_sha256': manifest['output_apk_sha256'],
                       'app_sha256': builder.APP_SHA, 'driver_sha256': builder.DRIVER_SHA},
           'Private runtime SDK does not match the prepared dependency')
    installed = json.loads((directory / 'native-click-installed.json').read_text())
    expect(not installed.get('error') and installed.get('sha256') == builder.sha(modified.read_bytes()),
           'Actual live installed server APK was not the diagnostic APK')
    expect(installed.get('package') == 'dev.mobile.maestro.test' and
           bool(re.fullmatch(r'emulator-\d+', installed.get('device', ''))), 'Selected emulator identity missing')
    raw_identity = (directory / 'native-click-installed-commands.log').read_text()
    expect(raw_identity.count('shell pm path dev.mobile.maestro.test') == 2 and
           f"{installed.get('sha256')}  {installed.get('path')}" in raw_identity and
           raw_identity.count(f"adb -s {installed.get('device')} " ) == 3 and
           'diagnostic timed out' not in raw_identity and raw_identity.count('exit=0 signal=null') == 3,
           'Raw live APK commands missing, failed or timed out')
    text = (directory / 'logcat.log').read_text()
    expect('TeleportInputTrace' not in text and '[teleport-input]' not in text, 'Application input hooks were enabled')
    records = []
    for line in text.splitlines():
        match = re.search(r'\bMaestroNativeInput\s*:\s*(\{.*\})\s*$', line)
        if not match:
            continue
        event = json.loads(match[1])
        expect(event.get('phase') == 'native.click.complete' and type(event.get('accepted')) is bool and
               all(type(event.get(k)) is int and event[k] >= 0 for k in ['x', 'y', 'completedUptimeMs']),
               'Malformed native JSON')
        records.append(event)
    targets = [(int(x), int(y)) for x, y in re.findall(r'Tapping at \((\d+), (\d+)\) using hierarchy based logic for wait',
                                                                      Path(maestro_log).read_text())]
    expect(len(records) >= 100 and len(targets) >= 100, 'Insufficient full-suite native click coverage')
    expect([(r.get('x'), r.get('y')) for r in records] == targets, 'Native click sequence differs from actual CLI targets')
    rejected = [i + 1 for i, event in enumerate(records) if event.get('accepted') is False]
    expect(not rejected, f'Native click API returned false for actions: {rejected}')
    expect(all(a.get('completedUptimeMs', -1) < b.get('completedUptimeMs', -1) for a, b in zip(records, records[1:])),
           'Native post-click clock is not increasing')
    timeline = (directory / 'timeline.log').read_text()
    expect('Android SDK post-click diagnostics=1; app hooks disabled' in timeline and '; Node=v20.19.4' in timeline,
           'Wrapper mode/project Node not confirmed')
    return {'version': 1, 'mode': 'input-trace-sdk', 'native_clicks': len(records), 'cli_targets': len(targets),
            'rejected_actions': rejected, 'installed_server_sha256': installed.get('sha256'),
            'records': records, 'errors': errors, 'final_stability_credit': False,
            'limit': 'API acceptance does not prove delivery to the application; aggregate false does not distinguish DOWN from UP.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('maestro_log', type=Path)
    parser.add_argument('--apksigner', type=Path, required=True)
    options = parser.parse_args()
    result = check(options.directory, options.maestro_log, options.apksigner)
    print(json.dumps(result, indent=2))
    raise SystemExit(bool(result['errors']))


if __name__ == '__main__':
    main()
