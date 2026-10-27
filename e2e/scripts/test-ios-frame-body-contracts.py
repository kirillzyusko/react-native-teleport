"""Device-free source, raw evidence, path ownership and original-PNG controls."""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tempfile
from types import SimpleNamespace


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CHECK = load('body_negative_checker', 'check-ios-frame-bodies.py')
BODY = CHECK.BODY
COLLECT = CHECK.COLLECT
BUILDER = load('body_scope_builder', 'maestro-ios-input.py')
DEVICE = '00000000-0000-0000-0000-000000000001'
CONTAINER = '00000000-0000-0000-0000-000000000002'
TOKEN = '00000000-0000-0000-0000-000000000003'
PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
                    '0000000d49444154089963f8cfc0f01f00050001ffabce36890000000049454e44ae426082')


def text_of(bodies, screens):
    rows = []
    for r in screens:
        rows.append('[teleport-screen-trace] ' + json.dumps(r))
    for r in bodies:
        rows.append(f"2026-10-27 20:00:00.000 Df maestro-driver-iosUITests-Runner[{r['pid']}:1] (Foundation) " +
                    BODY.MARKER + json.dumps(r))
    return '\n'.join(rows)


def run(artifact, output):
    cases = []
    transport_cases = []
    fixture_file = Path(__file__).with_name('ios-hid') / 'FrameBodyTransportFixture.json'
    fixture_raw = fixture_file.read_bytes()
    fixture = json.loads(fixture_raw)

    def rejected(name, callback):
        try:
            callback()
        except (ValueError, RuntimeError, OSError, TypeError, KeyError):
            cases.append(name)
        else:
            raise AssertionError('Bad evidence accepted: ' + name)

    with tempfile.TemporaryDirectory(prefix='teleport-frame-body-contracts-') as tmp:
        tmp = Path(tmp)
        local = tmp / 'source-proof'
        local.mkdir()
        names = ['maestro-ios-input.json', 'ScreenTrace.swift', 'ScreenDiffHandler.original.swift',
                 'ScreenDiffHandler.patched.swift', 'ScreenshotHandler.original.swift',
                 'ScreenshotHandler.patched.swift', 'frame-body-ScreenDiffHandler.patched.swift', 'FrameBodyArchive.swift']
        for name in names:
            shutil.copyfile(artifact / name, local / name)
        metadata = BODY.source_audit(local)
        assert CHECK.SCREEN.source_audit(local) == []
        cases.append('exact_composed_source_and_physical_parity')
        for name in ['FrameBodyArchive.swift', 'frame-body-ScreenDiffHandler.patched.swift', 'ScreenDiffHandler.patched.swift']:
            file = local / name
            original = file.read_bytes()
            file.write_bytes(original + b'\n')
            rejected('source_tamper_' + name, lambda: BODY.source_audit(local))
            file.write_bytes(original)
        file = local / 'maestro-ios-input.json'
        original = file.read_bytes()
        for name, change in [('old_unarchived_artifact', lambda m: m.pop('frame_body_archive')),
                             ('wrong_bounds', lambda m: m['frame_body_archive']['limits'].update(pairs=1025)),
                             ('idle_RPC_profile', lambda m: m.update(idle_observation={'version': 1}))]:
            m = json.loads(original)
            change(m)
            file.write_text(json.dumps(m))
            rejected(name, lambda: BODY.source_audit(local))
        file.write_bytes(original)

        root = tmp / 'Devices' / DEVICE / 'data/Containers/Data/Application' / CONTAINER / 'tmp' / f'teleport-frame-bodies-123-{TOKEN}'
        root.mkdir(parents=True)
        container_file = root.parents[1] / '.com.apple.mobile_container_manager.metadata.plist'
        container_file.write_bytes(plistlib.dumps({'MCMMetadataIdentifier': COLLECT.BUNDLE}))
        common = {'version': 1, 'helperSHA': metadata['helper_sha256'], 'pid': 123,
                  'simulatorUDID': DEVICE, 'uptime': 2.15, 'wallTime': 1793000000.0}
        bodies = [{**common, 'phase': 'initialized', 'root': str(root), 'limits': BODY.PATCH.LIMITS}]
        screens = []
        for ordinal in [1, 2]:
            first = float(ordinal * 2)
            second = first + 0.1
            q = {**common, 'phase': 'queued', 'ordinal': ordinal, 'firstHash': BODY.sha(PNG),
                 'secondHash': BODY.sha(PNG), 'firstBytes': len(PNG), 'secondBytes': len(PNG),
                 'firstReturned': first, 'secondReturned': second, 'isScreenStatic': True,
                 'pendingPairs': 1, 'uptime': second + 0.01}
            s = {**common, 'phase': 'saved', 'ordinal': ordinal,
                 'firstHash': q['firstHash'], 'secondHash': q['secondHash'],
                 'firstBytes': len(PNG), 'secondBytes': len(PNG), 'uptime': second + 0.1,
                 'firstFile': f'pair-{ordinal:06d}-first.png', 'secondFile': f'pair-{ordinal:06d}-second.png'}
            bodies.extend([q, s])
            for side in ['first', 'second']:
                (root / s[side + 'File']).write_bytes(PNG)
            screens.append({'route': 'isScreenStatic', 'sequence': ordinal * 2, 'firstCaptured': first,
                            'secondCaptured': second, 'firstHash': q['firstHash'], 'secondHash': q['secondHash'],
                            'isScreenStatic': True})
        text = text_of(bodies, screens)
        contract = BODY.runtime_contract(BODY.parse_unified(text), screens, metadata, DEVICE)
        assert len(contract['pairs']) == 2 and contract['totalBytes'] == len(PNG) * 4
        cases.append('exact_raw_route_hash_clock_correspondence')
        archive = tmp / 'positive-output'
        manifest = COLLECT.collect(text, local, DEVICE, tmp / 'Devices', archive, body_text=text)
        assert manifest['errors'] == [], manifest
        names = ['manifest.json', *(f['file'] for f in manifest['files'])]
        result = CHECK.check(text, local, manifest, lambda n: (archive / n).read_bytes(), names, DEVICE, body_text=text)
        assert result['errors'] == [] and result['pairs'] == 2 and result['PNGs'] == 4, result
        cases.append('owned_container_collect_and_independent_PNG_check')
        virtual = '/var/mobile/Containers/Data/Application/' + CONTAINER + '/tmp/' + root.name
        assert COLLECT.selected_root(virtual, 123, DEVICE, tmp / 'Devices')[0] == root
        cases.append('exact_virtual_Simulator_prefix_mapping')

        def bad_raw(name, change):
            changed = copy.deepcopy(bodies)
            change(changed)
            rejected(name, lambda: BODY.runtime_contract(BODY.parse_unified(text_of(changed, screens)), screens, metadata, DEVICE))

        bad_raw('missing_body_markers', lambda r: r.clear())
        bad_raw('wrong_source_marker', lambda r: r[1].update(helperSHA='0' * 64))
        bad_raw('wrong_device', lambda r: r[1].update(simulatorUDID=CONTAINER))
        bad_raw('wrong_typed_PID', lambda r: r[1].update(pid=True))
        bad_raw('unknown_or_error_phase', lambda r: r[1].update(phase='write.error'))
        bad_raw('duplicate_initialized', lambda r: r.append(copy.deepcopy(r[0])))
        bad_raw('missing_saved_pair', lambda r: r.pop())
        bad_raw('duplicate_saved_pair', lambda r: r.append(copy.deepcopy(r[2])))
        bad_raw('wrong_ordinal', lambda r: r[1].update(ordinal=3))
        bad_raw('wrong_ordinal_type', lambda r: r[1].update(ordinal=True))
        bad_raw('wrong_version_type', lambda r: r[1].update(version=True))
        bad_raw('pending_bound', lambda r: r[1].update(pendingPairs=9))
        bad_raw('PNG_size_bound', lambda r: r[1].update(firstBytes=BODY.PATCH.LIMITS['pngBytes'] + 1))
        bad_raw('wrong_Boolean_type', lambda r: r[1].update(isScreenStatic=1))
        bad_raw('wrong_Boolean_value', lambda r: r[1].update(isScreenStatic=False))
        bad_raw('wrong_saved_hash', lambda r: r[2].update(firstHash='0' * 64))
        bad_raw('unsafe_filename', lambda r: r[2].update(firstFile='../other.png'))
        bad_raw('wrong_capture_return_clock', lambda r: r[1].update(firstReturned=1.99))
        bad_raw('queued_before_capture_return', lambda r: r[1].update(uptime=1.0))
        bad_raw('saved_before_queued', lambda r: r[2].update(uptime=1.0))
        bad_raw('nonfinite_clock', lambda r: r[1].update(wallTime=float('nan')))
        rejected('actual_log_PID_mismatch', lambda: BODY.parse_unified(text.replace('Runner[123:1]', 'Runner[124:1]')))

        for name, raw in [('foreign_device_root', str(root).replace(DEVICE, CONTAINER)),
                          ('path_escape', str(root) + '/../other'),
                          ('foreign_PID_root', str(root).replace('bodies-123-', 'bodies-124-'))]:
            rejected(name, lambda raw=raw: COLLECT.selected_root(raw, 123, DEVICE, tmp / 'Devices'))
        container_file.write_bytes(plistlib.dumps({'MCMMetadataIdentifier': 'another.app'}))
        rejected('foreign_app_container', lambda: COLLECT.selected_root(str(root), 123, DEVICE, tmp / 'Devices'))
        container_file.write_bytes(plistlib.dumps({'MCMMetadataIdentifier': COLLECT.BUNDLE}))
        linked = root.parent / f'teleport-frame-bodies-123-{DEVICE}'
        linked.symlink_to(root, target_is_directory=True)
        rejected('linked_archive_root', lambda: COLLECT.selected_root(str(linked), 123, DEVICE, tmp / 'Devices'))
        linked.unlink()
        png = root / 'pair-000001-first.png'
        png.unlink()
        png.symlink_to(archive / '123/pair-000001-first.png')
        rejected('linked_PNG_file', lambda: COLLECT.regular_bytes(png, BODY.PATCH.LIMITS['pngBytes']))
        png.unlink()
        png.write_bytes(PNG)
        rejected('bounded_file_read', lambda: COLLECT.regular_bytes(png, 1))
        rejected('existing_output_preserved', lambda: COLLECT.collect(text, local, DEVICE, tmp / 'Devices', archive, body_text=text))
        bad_png = PNG[:-1]
        rejected('PNG_truncation', lambda: BODY.png_info(bad_png))
        rejected('PNG_CRC', lambda: BODY.png_info(PNG[:30] + b'\x00' + PNG[31:]))
        rejected('PNG_trailing_data', lambda: BODY.png_info(PNG + b'x'))
        bad_result = CHECK.check(text, local, manifest, lambda n: b'x', names, DEVICE, body_text=text)
        assert bad_result['errors']
        cases.append('independent_archive_bytes_hash_mismatch')
        bad_result = CHECK.check(text, local, manifest, lambda n: (archive / n).read_bytes(), names + ['unexpected.png'], DEVICE, body_text=text)
        assert bad_result['errors']
        cases.append('unexpected_archive_member')
        png.unlink()
        failure = COLLECT.collect(text, local, DEVICE, tmp / 'Devices', tmp / 'missing-source-output', body_text=text)
        assert failure['errors'] and (tmp / 'missing-source-output/manifest.json').is_file()
        cases.append('collection_error_receipt_preserved')

        # Scope rejection occurs before source/artifact/JAR reads or device APIs.
        for name, overrides in [('wrong_backend', {'backend': 'recap'}),
                                ('missing_frame', {'trace_frames': False}),
                                ('idle_RPC', {'observe_idle': True})]:
            a = dict(source=tmp / 'absent-source', output=tmp / 'absent-output', derived=tmp / 'unused',
                     archive_frame_bodies=True, backend='indigo', trace_frames=True,
                     observe_idle=False, observe_static_idle=False)
            a.update(overrides)
            rejected('build_scope_' + name, lambda: BUILDER.build(SimpleNamespace(**a)))
            assert not a['output'].exists() and not a['source'].exists()
        rejected('install_scope_before_artifact_access', lambda: BUILDER.install(SimpleNamespace(
            expected_frame_bodies=True, expected_backend='recap', expected_frame_trace=True,
            expected_idle_observation=False, expected_static_idle_observation=False)))
        for enabled in [True, False]:
            m = json.loads(original)
            if not enabled:
                m.pop('frame_body_archive')
            file.write_text(json.dumps(m))
            rejected('install_exact_body_optin_' + str(enabled), lambda: BUILDER.install(SimpleNamespace(
                jar=tmp / 'absent.jar', artifact=local, expected_lead_in='0', expected_backend='indigo',
                expected_frame_trace=True, expected_frame_bodies=not enabled)))
        file.write_bytes(original)

        # Real captured records exercise the exact failed stdout and complete
        # unified transport without reconstructing or qualifying missing PNGs.
        root = BODY.parse_unified(fixture['unifiedInitialized'])[0]
        assert root == BODY.parse(fixture['xctestInitialized'])[0]
        transport_cases.append('actual_compact_root_matches_independent_XCTest_record')
        saved = BODY.parse_unified('\n'.join(fixture['unifiedSaved']))
        assert sorted(r['ordinal'] for r in saved) == [87, 321]
        transport_cases.append('actual_unified_saved_records_complete')
        assert len(fixture['unifiedInitialized'].split(BODY.MARKER, 1)[1]) > 512
        transport_cases.append('long_complete_record_is_not_truncation')
        before = len(cases)
        for line in fixture['interleavedXCTest']:
            rejected('temporary_legacy_negative', lambda line=line: BODY.parse(line))
            rejected('temporary_unified_negative', lambda line=line: BODY.parse_unified(line))
        del cases[before:]
        transport_cases.extend(['legacy_interleaved_stdout_still_rejected', 'malformed_unified_never_ignored'])
        line = fixture['unifiedSaved'][0]
        before = len(cases)
        for label, changed in [
            ('wrong_unified_process', line.replace('maestro-driver-iosUITests-Runner', 'another-app')),
            ('wrong_unified_PID', line.replace('Runner[9881:', 'Runner[9882:')),
            ('duplicate_marker', line + BODY.MARKER + '{}'),
            ('truncated_unified_JSON', line[:-1])
        ]:
            rejected(label, lambda changed=changed: BODY.parse_unified(changed))
            transport_cases.append(label)
        del cases[before:]
        before = len(cases)
        rejected('temporary_stdout_transport', lambda: BODY.parse_unified(fixture['xctestInitialized']))
        prefix = line.split(BODY.MARKER, 1)[0]
        rejected('temporary_non_object', lambda: BODY.parse_unified(prefix + BODY.MARKER + '[]'))
        del cases[before:]
        transport_cases.extend(['XCTest_transport_not_accepted_as_unified', 'non_object_unified_JSON'])
        import re
        hex_line = re.sub(r'Runner\[9881:[0-9a-fA-F]+\]', 'Runner[9881:ab1f]', line)
        assert BODY.parse_unified(hex_line)[0] == saved[0]
        transport_cases.append('unified_hex_thread_identity')
        value = {'pid': 123, 'value': 'π/\n\\134'}
        compact = json.dumps(value).replace('\\', '\\134')
        generated = '2026-10-27 20:00:00.000 Df maestro-driver-iosUITests-Runner[123:ab1f] (Foundation) ' + BODY.MARKER + compact
        assert BODY.parse_unified(generated)[0] == value
        transport_cases.append('exactly_one_presentation_escape_layer')
        for name, change in [
            ('missing_transport_identity', lambda m: m.pop('bodySource')),
            ('wrong_unified_source_hash', lambda m: m['bodySource'].update(bodyLogSHA256='0' * 64)),
            ('wrong_XCTest_source_hash', lambda m: m['bodySource'].update(xctestSHA256='0' * 64)),
            ('wrong_collector_source', lambda m: m.update(collectorSourceSHA256='0' * 64))
        ]:
            changed = copy.deepcopy(manifest)
            change(changed)
            assert CHECK.check(text, local, changed, lambda n: (archive / n).read_bytes(), names, DEVICE,
                               body_text=text)['errors']
            transport_cases.append(name)
        before = len(cases)
        rejected('temporary_explicit_source_required', lambda: COLLECT.collect(text, local, DEVICE,
                 tmp / 'Devices', tmp / 'no-body-source'))
        del cases[before:]
        assert not (tmp / 'no-body-source').exists()
        transport_cases.append('explicit_body_source_required_without_fallback')
    result = {'version': 1, 'helperSHA256': BODY.sha(BODY.PATCH.HELPER.read_bytes()),
              'cases': cases, 'caseCount': len(cases), 'transportCases': transport_cases, 'transportCaseCount': len(transport_cases),
              'transportFixtureSHA256': BODY.sha(fixture_raw),
              'testSourceSHA256': BODY.sha(Path(__file__).read_bytes()), 'deviceAPICalls': 0, 'final_stability_credit': False}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n')
    (output.parent / 'transport-fixture.json').write_bytes(fixture_raw)
    (output.parent / 'contracts-source.py').write_bytes(Path(__file__).read_bytes())
    live_output = output.parent / 'live'
    live_output.mkdir(exist_ok=True)
    subprocess.run([sys.executable, '-B', str(Path(__file__).with_name('test-ios-frame-body-live.py')),
                    '--artifact', str(artifact.resolve()), '--output', str(live_output / 'report.json')], check=True)
    env = dict(os.environ, TELEPORT_FRAME_BODY_FIXTURE_ARTIFACT=str(artifact.resolve()),
               TELEPORT_FRAME_BODY_FIXTURE_RECEIPT=str((live_output / 'node-integration.json').resolve()))
    with (live_output / 'node.tap').open('w') as stream:
        subprocess.run(['node', '--test', str(Path(__file__).with_name('ios-frame-body-live.test.mjs'))],
                       env=env, stdout=stream, stderr=subprocess.STDOUT, check=True)
    (live_output / 'node-tests-source.mjs').write_bytes(Path(__file__).with_name('ios-frame-body-live.test.mjs').read_bytes())
    (live_output / 'wrapper-source.mjs').write_bytes(Path(__file__).with_name('native-diagnostics.mjs').read_bytes())
    print(json.dumps(result))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.artifact, args.output)
