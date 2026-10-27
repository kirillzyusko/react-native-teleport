"""Opt-in SDK diagnostics: record clickNoSync's existing result after it returns.

No event injection, hold duration, application source or driver lifecycle changes.
Only the isolated UiDeviceExt DEX and APK signatures change. The signing key is
Maestro's public upstream debug fixture, verified before use; never a user key.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile

APK_SHA = "4a1a775e103d848760984ae6f0294bc4419d523bef8892181533854a22e94370"
APP_SHA = "5ef8a8d02923e9ff532c60f15b95854a231cce429bcd696468aa5d327e14b7ee"
DRIVER_SHA = "52719512d1eab9ab4810a066195d7a3aa635afbc3121ebd8cb4d555d87aa5946"
SMALI_SHA = "bafb6820418d3ba4cf5b9abf7d451c178d541c0bf052e648cf32a196de223943"
TOOL_SHA = "b947b945b4bc455609ba768d071b64d9e63834079898dbaae15b67bf03bcd362"
KEY_SHA = "edd4ce0f6119d478758a5b76b3a4605ebbc5d94de71f0d2ef89d3464a9ef779a"
CERT_SHA = "1b6682d482545b1b99eed3ca09c985a2497a48aed0a284214b375e774f5eda04"
SOURCE = "smali_classes6/androidx/test/uiautomator/UiDeviceExt.smali"
CALL = "    invoke-virtual {v0, p2, p3}, Landroidx/test/uiautomator/InteractionController;->clickNoSync(II)Z\n"
METHOD = ".method public final clickExt(Landroidx/test/uiautomator/UiDevice;II)V\n    .locals 1\n"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def patch(source, tail):
    require(sha(source.encode()) == SMALI_SHA, "Unrecognized UiDeviceExt source")
    require(source.count(CALL) == source.count(METHOD) == 1, "Unexpected click method")
    result = source.replace(METHOD, METHOD.replace('.locals 1', '.locals 4'), 1).replace(CALL, CALL + tail, 1)
    require(result.replace(tail, '', 1).replace(METHOD.replace('.locals 1', '.locals 4'), METHOD, 1) == source,
            "Change extends outside post-click logging")
    return result


def entries(archive):
    names = archive.namelist()
    require(len(names) == len(set(names)), "Duplicate archive entries")
    return {n: sha(archive.read(n)) for n in names}


def apk_changes(original, modified):
    a, b = entries(original), entries(modified)
    changes = sorted(n for n in a.keys() | b.keys() if a.get(n) != b.get(n))
    require('classes6.dex' in changes, "Missing diagnostic DEX")
    require(all(n == 'classes6.dex' or (n.startswith('META-INF/') and n.endswith(('.SF', '.RSA', '.DSA', 'MANIFEST.MF')))
                for n in changes), "Unexpected APK code/resource change")
    require(original.read('classes6.dex')[:8] == modified.read('classes6.dex')[:8] == b'dex\n037\0',
            "DEX version changed")
    return changes


def pinned_file(path, url, digest):
    if not path.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        require(sha(data) == digest, f"Download digest differs: {url}")
        path.write_bytes(data)
    require(sha(path.read_bytes()) == digest, f"Pinned file differs: {path}")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('jar', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--apktool', type=Path)
    parser.add_argument('--keystore', type=Path)
    parser.add_argument('--apksigner', type=Path, required=True)
    parser.add_argument('--install', action='store_true')
    options = parser.parse_args()
    destination = options.destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    manifest = destination / 'native-click-patch.json'
    require(not manifest.exists(), "Refusing to overwrite diagnostic build evidence")
    jar = options.jar.resolve()
    with zipfile.ZipFile(jar) as z:
        before = entries(z)
        require(sha(z.read('maestro-server.apk')) == APK_SHA, "Expected stock server APK")
        require(sha(z.read('maestro-app.apk')) == APP_SHA, "Unexpected SDK app APK")
        require(sha(z.read('maestro/drivers/AndroidDriver.class')) == DRIVER_SHA,
                "Expected existing foreground instrumentation fix first")
        require(not any(n.startswith('META-INF/') and n.endswith(('.SF', '.RSA', '.DSA')) for n in before),
                "Signed SDK JAR")
        (destination / 'server-original.apk').write_bytes(z.read('maestro-server.apk'))
    original_jar_sha = sha(jar.read_bytes())
    tool = pinned_file(options.apktool or destination / 'apktool-3.0.1.jar',
        'https://github.com/iBotPeaches/Apktool/releases/download/v3.0.1/apktool_3.0.1.jar', TOOL_SHA)
    key = pinned_file(options.keystore or destination / 'public-upstream-debug.keystore',
        'https://raw.githubusercontent.com/mobile-dev-inc/Maestro/14a408335e17a090df1e26bdbeaf80d8122a8fd8/debug.keystore', KEY_SHA)
    java = str(Path(os.environ['JAVA_HOME']) / 'bin/java') if os.environ.get('JAVA_HOME') else 'java'
    tail_path = Path(__file__).with_name('native-click-log.smali')
    tail = tail_path.read_text()
    with (destination / 'native-click-build.log').open('w') as log:
        def run(command):
            subprocess.run(list(map(str, command)), stdout=log, stderr=subprocess.STDOUT, check=True, timeout=180)
        with tempfile.TemporaryDirectory(prefix='native-click-', dir=destination) as temp:
            work = Path(temp)
            decoded = work / 'decoded'
            run([java, '-jar', tool, 'decode', '--no-res', '--no-debug-info', '--frame-path', work / 'framework',
                 '-o', decoded, destination / 'server-original.apk'])
            source = (decoded / SOURCE).read_text()
            require(list((decoded / 'smali_classes6').rglob('*.smali')) == [decoded / SOURCE],
                    "UiDeviceExt no longer alone in its DEX")
            patched = patch(source, tail)
            (destination / 'UiDeviceExt.original.smali').write_text(source)
            (destination / 'UiDeviceExt.patched.smali').write_text(patched)
            build = work / 'assemble'
            build.mkdir()
            for name in ['apktool.yml', 'AndroidManifest.xml', 'resources.arsc']:
                shutil.copy2(decoded / name, build / name)
            target = build / SOURCE
            target.parent.mkdir(parents=True)
            target.write_text(patched)
            run([java, '-jar', tool, 'build', '--no-apk', '--frame-path', work / 'framework', build])
            dex = (build / 'build/apk/classes6.dex').read_bytes()
            require(sha(dex) == 'f3d7574eac98657754ebb9b93a73918811206baa2e1baa9ea9857a0dce722bf4',
                    "Assembled diagnostic DEX differs from verified prototype")
            unsigned = work / 'unsigned.apk'
            with zipfile.ZipFile(destination / 'server-original.apk') as a, zipfile.ZipFile(unsigned, 'w') as b:
                b.comment = a.comment
                for info in a.infolist():
                    b.writestr(info, dex if info.filename == 'classes6.dex' else a.read(info))
            output = destination / 'server-diagnostic.apk'
            run([options.apksigner, 'sign', '--ks', key, '--ks-key-alias', 'androiddebugkey', '--ks-pass', 'pass:android',
                 '--key-pass', 'pass:android', '--v4-signing-enabled', 'false', '--out', output, unsigned])
            certs = subprocess.check_output([str(options.apksigner), 'verify', '--verbose', '--print-certs', str(output)], text=True)
            require(f'certificate SHA-256 digest: {CERT_SHA}' in certs, "APK signing certificate differs")
            (destination / 'native-click-signature.log').write_text(certs)
            with zipfile.ZipFile(destination / 'server-original.apk') as a, zipfile.ZipFile(output) as b:
                changes = apk_changes(a, b)
            roundtrip = work / 'roundtrip'
            run([java, '-jar', tool, 'decode', '--no-res', '--no-debug-info', '--frame-path', work / 'framework', '-o', roundtrip, output])
            roundtrip_source = (roundtrip / SOURCE).read_text()
            (destination / 'UiDeviceExt.roundtrip.smali').write_text(roundtrip_source)
            normalized = lambda value: [line for line in value.splitlines() if line.strip()]
            require(normalized(roundtrip_source) == normalized(patched), "DEX assembly roundtrip instructions differ")
            patched_jar = destination / 'maestro-client-native-click.jar'
            with zipfile.ZipFile(jar) as a, zipfile.ZipFile(patched_jar, 'w') as b:
                b.comment = a.comment
                for info in a.infolist():
                    b.writestr(info, output.read_bytes() if info.filename == 'maestro-server.apk' else a.read(info))
            with zipfile.ZipFile(patched_jar) as b:
                after = entries(b)
                require(before.keys() == after.keys() and [n for n in before if before[n] != after[n]] == ['maestro-server.apk'],
                        "Other SDK JAR entries changed")
            result = {'version': 1, 'mode': 'input-trace-sdk', 'final_stability_credit': False,
                'builder_sha256': sha(Path(__file__).read_bytes()), 'tail_sha256': sha(tail_path.read_bytes()),
                'apktool_sha256': TOOL_SHA, 'public_key_sha256': KEY_SHA, 'certificate_sha256': CERT_SHA,
                'input_jar_sha256': original_jar_sha, 'output_jar_sha256': sha(patched_jar.read_bytes()),
                'input_apk_sha256': APK_SHA, 'output_apk_sha256': sha(output.read_bytes()),
                'sdk_app_sha256': APP_SHA, 'foreground_driver_sha256': DRIVER_SHA,
                'original_source_sha256': SMALI_SHA, 'patched_source_sha256': sha(patched.encode()),
                'patched_dex_sha256': sha(dex),
                'changed_apk_entries': changes, 'changed_jar_entries': ['maestro-server.apk'],
                'installation_modified': options.install, 'all_added_calls_after_click_returns': True}
            # The DEX is nested inside the APK, not an SDK JAR entry.
            with zipfile.ZipFile(destination / 'server-original.apk') as a:
                result['original_dex_sha256'] = sha(a.read('classes6.dex'))
            if options.install:
                with tempfile.NamedTemporaryFile(dir=jar.parent, suffix='.jar', delete=False) as stream:
                    temporary = Path(stream.name)
                try:
                    shutil.copyfile(patched_jar, temporary)
                    temporary.chmod(jar.stat().st_mode & 0o777)
                    os.replace(temporary, jar)
                finally:
                    temporary.unlink(missing_ok=True)
            manifest.write_text(json.dumps(result, indent=2) + '\n')
            print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
