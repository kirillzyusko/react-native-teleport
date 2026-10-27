"""Generated filesystem controls for live export; no Simulator or device APIs."""
import argparse
import copy
import importlib.util
import io
import json
from pathlib import Path
import plistlib
import shutil
import tempfile

spec = importlib.util.spec_from_file_location('live_export_actual_source', Path(__file__).with_name('ios-frame-body-live.py'))
LIVE = importlib.util.module_from_spec(spec)
spec.loader.exec_module(LIVE)
CHECK = LIVE.load('live_export_independent_checker', 'check-ios-frame-bodies.py')
BODY = LIVE.BODY
DEVICE = '00000000-0000-0000-0000-000000000001'
CONTAINER = '00000000-0000-0000-0000-000000000002'
TOKEN = '00000000-0000-0000-0000-000000000003'
PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
                    '0000000d49444154089963f8cfc0f01f00050001ffabce36890000000049454e44ae426082')


def run(artifact, output):
    cases = []
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='teleport-live-body-controls-') as tmp:
        tmp = Path(tmp)
        number = 0
        def fixture():
            nonlocal number
            number += 1
            folder = tmp / str(number)
            root = folder / 'Devices' / DEVICE / 'data/Containers/Data/Application' / CONTAINER / 'tmp' / f'teleport-frame-bodies-123-{TOKEN}'
            root.mkdir(parents=True)
            container = root.parents[1]
            (container / '.com.apple.mobile_container_manager.metadata.plist').write_bytes(plistlib.dumps({'MCMMetadataIdentifier': LIVE.COLLECT.BUNDLE}))
            common = {'version': 1, 'helperSHA': BODY.sha(BODY.PATCH.HELPER.read_bytes()),
                      'pid': 123, 'simulatorUDID': DEVICE, 'uptime': 1.0, 'wallTime': 1793000000.0}
            rows = []
            screens = []
            for ordinal in [1, 2]:
                q = {**common, 'phase': 'queued', 'ordinal': ordinal, 'firstHash': BODY.sha(PNG),
                     'secondHash': BODY.sha(PNG), 'firstBytes': len(PNG), 'secondBytes': len(PNG),
                     'firstReturned': ordinal * 2.0, 'secondReturned': ordinal * 2.0 + .1,
                     'isScreenStatic': True, 'pendingPairs': 1, 'uptime': ordinal * 2.0 + .2}
                if ordinal == 1:
                    rows.extend([q, {**common, 'phase': 'initialized', 'root': str(root), 'limits': BODY.PATCH.LIMITS}])
                else:
                    rows.append(q)
                saved = {**common, 'phase': 'saved', 'ordinal': ordinal, 'uptime': ordinal * 2.0 + .3}
                for side in ['first', 'second']:
                    saved.update({side+'File': f'pair-{ordinal:06d}-{side}.png', side+'Hash': BODY.sha(PNG), side+'Bytes': len(PNG)})
                    (root / saved[side+'File']).write_bytes(PNG)
                rows.append(saved)
                screens.append({'route': 'isScreenStatic', 'sequence': ordinal, 'firstCaptured': q['firstReturned'],
                    'secondCaptured': q['secondReturned'], 'firstHash': q['firstHash'], 'secondHash': q['secondHash'], 'isScreenStatic': True})
            return folder, root, rows, screens
        def encoded(rows):
            return ''.join(f"2026-10-27 22:00:00.000 Df maestro-driver-iosUITests-Runner[{r['pid']}:ab1f] (Foundation) " + BODY.MARKER + json.dumps(r) + '\n' for r in rows)
        def screen_text(screens):
            return ''.join('[teleport-screen-trace] ' + json.dumps(r) + '\n' for r in screens)
        def export(folder, rows, delete_on_EOF=None, raw=None):
            class Source(io.BytesIO):
                def readline(self, size=-1):
                    line = super().readline(size)
                    if not line and delete_on_EOF and delete_on_EOF.exists():
                        shutil.rmtree(delete_on_EOF)
                    return line
            return LIVE.stream(artifact, DEVICE, folder/'Devices', folder/'stage', Source(raw if raw is not None else encoded(rows).encode()))
        def process(manifest):
            return {'version': 1, 'device': DEVICE, 'exit': 0, 'signal': None, 'errors': [],
                    'inputEnded': True, 'deviceAPICalls': 0, 'inputBufferBytes': 8*1024*1024,
                    'nodeVersion': 'v20.19.4',
                    'parentCommand': ['node', 'native-diagnostics.mjs', 'ios', DEVICE, '--', 'fixture-command'],
                    'wrapperSourceSHA256': BODY.sha(Path(__file__).with_name('native-diagnostics.mjs').read_bytes()),
                    'workerFinished': True, 'copiedPNGsObserved': len(manifest['files']),
                    'workerSourceSHA256': LIVE.source_hash(), 'adapterSourceSHA256': LIVE.adapter_hash(),
                    'pid': manifest['liveExport']['workerPID'], 'parentPID': manifest['liveExport']['parentPID']}
        def checked(folder, rows, screens, manifest, proc):
            text, body = screen_text(screens), encoded(rows)
            final = LIVE.finalize(text, artifact, DEVICE, folder/'final', body, folder/'stage', proc)
            names = ['manifest.json', *(f['file'] for f in final['files'])]
            result = CHECK.check(text, artifact, final, lambda n:(folder/'final'/n).read_bytes(), names, DEVICE,
                                 body_text=body, live_process=proc)
            return final, result
        folder, root, rows, screens = fixture()
        manifest = export(folder, rows, delete_on_EOF=root.parents[1])
        assert not root.parents[1].exists() and not manifest['errors'], manifest
        proc = process(manifest)
        final, checked_result = checked(folder, rows, screens, manifest, proc)
        assert not final['errors'] and not checked_result['errors'], (final, checked_result)
        assert checked_result['pairs'] == 2 and checked_result['PNGs'] == 4
        shutil.copytree(folder/'final', output.parent/'positive-archive')
        cases.append('actual_export_then_source_container_deleted_then_strict_finalize_and_check')
        def rejected_stream(name, mutation=None, filesystem=None, raw=None):
            folder, root, rows, screens = fixture()
            if mutation: mutation(rows)
            if filesystem: filesystem(root)
            result = export(folder, rows, raw=raw)
            assert result['errors'], name
            cases.append(name)
        rejected_stream('foreign_MCM_bundle', filesystem=lambda r:(r.parents[1]/'.com.apple.mobile_container_manager.metadata.plist').write_bytes(plistlib.dumps({'MCMMetadataIdentifier':'foreign'})))
        rejected_stream('source_container_missing_before_copy', filesystem=lambda r:shutil.rmtree(r.parents[1]))
        def linked(root):
            target = root/'pair-000001-first.png';target.unlink();target.symlink_to(root/'pair-000001-second.png')
        rejected_stream('source_PNG_link', filesystem=linked)
        for name, mutate in [
            ('wrong_device', lambda r:r[0].update(simulatorUDID='foreign')),
            ('wrong_helper', lambda r:r[0].update(helperSHA='0'*64)),
            ('duplicate_initialized', lambda r:r.insert(2,copy.deepcopy(r[1]))),
            ('missing_saved', lambda r:r.pop()),
            ('duplicate_saved', lambda r:r.append(copy.deepcopy(r[-1]))),
            ('unsafe_saved_name', lambda r:r[2].update(firstFile='../escape.png')),
            ('wrong_saved_hash', lambda r:r[2].update(firstHash='0'*64)),
            ('wrong_saved_size', lambda r:r[2].update(firstBytes=1)),
            ('pending_bound', lambda r:r[0].update(pendingPairs=9)),
            ('PNG_bound', lambda r:r[0].update(firstBytes=BODY.PATCH.LIMITS['pngBytes']+1)),
            ('ordinal_type', lambda r:r[0].update(ordinal=True)),
            ('duplicate_ordinal', lambda r:r[3].update(ordinal=1)),
            ('producer_write_error', lambda r:r[2].update(phase='write.error')),
            ('clock_type', lambda r:r[0].update(uptime='1')),
        ]: rejected_stream(name,mutation=mutate)
        rejected_stream('PNG_byte_hash_mismatch',filesystem=lambda r:(r/'pair-000001-first.png').write_bytes(PNG+b'x'))
        rejected_stream('partial_body_log_line',raw=(encoded([rows[0]])[:-1]).encode())
        rejected_stream('log_line_bound',raw=b'x'*(LIVE.LINE_BYTES+1))
        folder, root, rows, screens = fixture()
        rows = [copy.deepcopy(rows[0]) for _ in range(9)]
        for i, row in enumerate(rows, 1):
            row.update(ordinal=i, firstBytes=BODY.PATCH.LIMITS['pngBytes'], secondBytes=BODY.PATCH.LIMITS['pngBytes'])
        manifest = export(folder, rows)
        assert any('total PNG bound' in e for e in manifest['errors']);cases.append('total_PNG_bound')
        folder, root, rows, screens = fixture()
        rows = [copy.deepcopy(rows[0]) for _ in range(19)]
        for i, row in enumerate(rows, 1):row.update(ordinal=i, padding='x'*950000)
        manifest = export(folder, rows)
        assert any('metadata bound' in e for e in manifest['errors']);cases.append('total_body_metadata_bound')
        folder, root, rows, screens = fixture()
        manifest = export(folder, rows, raw=(encoded(rows)+'unrelated shutdown tail').encode())
        assert not manifest['errors'];cases.append('unrelated_non_body_EOF_does_not_drop_any_body_record')
        folder, root, rows, screens = fixture()
        original_reader = LIVE.COLLECT.regular_bytes
        def changed_source(path, maximum):
            raw = original_reader(path, maximum)
            if path.suffix == '.png':
                replacement=path.with_suffix('.replacement');replacement.write_bytes(raw);replacement.replace(path)
            return raw
        try:
            LIVE.COLLECT.regular_bytes=changed_source;manifest=export(folder,rows)
            assert any('identity changed' in e for e in manifest['errors'])
        finally:LIVE.COLLECT.regular_bytes=original_reader
        cases.append('source_inode_replacement_during_copy')
        folder, root, rows, screens = fixture();stage=folder/'stage';stage.mkdir();(stage/'preserve').write_text('owned')
        try:export(folder, rows)
        except ValueError:pass
        else:raise AssertionError('existing stage overwritten')
        assert (stage/'preserve').read_text()=='owned';cases.append('existing_stage_refused')
        for name, change in [
            ('process_exit_failure',lambda p:p.update(exit=1)),
            ('process_PID_mismatch',lambda p:p.update(pid=p['pid']+1)),
            ('process_parent_mismatch',lambda p:p.update(parentPID=p['parentPID']+1)),
            ('worker_source_mismatch',lambda p:p.update(workerSourceSHA256='0'*64)),
            ('adapter_source_mismatch',lambda p:p.update(adapterSourceSHA256='0'*64)),
            ('missing_EOF',lambda p:p.pop('inputEnded')),
            ('input_buffer_error',lambda p:p.update(errors=['overflow'])),
            ('wrong_Node_version',lambda p:p.update(nodeVersion='v22.0.0')),
            ('missing_worker_completion',lambda p:p.pop('workerFinished')),
            ('wrong_observed_copy_count',lambda p:p.update(copiedPNGsObserved=2)),
            ('wrong_parent_command',lambda p:p.update(parentCommand=['foreign'])),
            ('wrong_wrapper_source',lambda p:p.update(wrapperSourceSHA256='0'*64)),
        ]:
            folder, root, rows, screens = fixture();manifest=export(folder,rows);proc=process(manifest);change(proc)
            final, result=checked(folder,rows,screens,manifest,proc);assert final['errors'] and result['errors'],name;cases.append(name)
        folder, root, rows, screens = fixture();manifest=export(folder,rows);proc=process(manifest);rows[0]['wallTime']+=1
        final,result=checked(folder,rows,screens,manifest,proc);assert final['errors'];cases.append('live_rows_must_equal_final_raw_log')
        folder, root, rows, screens = fixture();manifest=export(folder,rows);proc=process(manifest);(folder/'stage/123/pair-000001-first.png').write_bytes(PNG+b'x')
        final,result=checked(folder,rows,screens,manifest,proc);assert final['errors'];cases.append('staged_PNG_tamper')
        folder, root, rows, screens = fixture();manifest=export(folder,rows);proc=process(manifest);(folder/'stage/unexpected').write_text('foreign')
        final,result=checked(folder,rows,screens,manifest,proc);assert final['errors'];cases.append('unexpected_staged_file')
        for name, mutation in [
            ('copy_receipt_missing',lambda m:m['liveExport']['copyReceipts'].pop()),
            ('copy_clock_type',lambda m:m['liveExport']['copyReceipts'][0].update(copiedMonotonicNs=True)),
            ('copy_inode_invalid',lambda m:m['liveExport']['copyReceipts'][0]['sourceFileIdentity'].update(inode=0)),
            ('live_line_digest_tamper',lambda m:m['liveExport']['lineSHA256'].__setitem__(0,'0'*64)),
            ('live_device_tamper',lambda m:m.update(deviceUDID='foreign')),
        ]:
            folder,root,rows,screens=fixture();manifest=export(folder,rows);proc=process(manifest);mutation(manifest)
            (folder/'stage/manifest.json').write_text(json.dumps(manifest))
            final,result=checked(folder,rows,screens,manifest,proc);assert final['errors'],name;cases.append(name)
        for name, mutation in [
            ('unexpected_staged_directory',lambda p:(p/'foreign').mkdir()),
            ('unexpected_staged_link',lambda p:(p/'foreign').symlink_to(p/'absent')),
        ]:
            folder,root,rows,screens=fixture();manifest=export(folder,rows);proc=process(manifest);mutation(folder/'stage')
            final,result=checked(folder,rows,screens,manifest,proc);assert final['errors'],name;cases.append(name)
    report={'version':1,'cases':cases,'caseCount':len(cases),'workerSourceSHA256':LIVE.source_hash(),
            'adapterSourceSHA256':LIVE.adapter_hash(),'testSourceSHA256':BODY.sha(Path(__file__).read_bytes()),
            'productionLimits':BODY.PATCH.LIMITS,'deviceAPICalls':0,
            'scope':'Generated filesystem fixtures with actual PNG bytes and actual exporter/checker code. No real Simulator execution or official runtime evidence.',
            'final_stability_credit':False}
    output.write_text(json.dumps(report,indent=2)+'\n')
    (output.parent/'live-source.py').write_bytes(Path(__file__).with_name('ios-frame-body-live.py').read_bytes())
    (output.parent/'adapter-source.mjs').write_bytes(Path(__file__).with_name('ios-frame-body-live.mjs').read_bytes())
    (output.parent/'tests-source.py').write_bytes(Path(__file__).read_bytes())
    print(json.dumps(report))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--artifact',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();run(args.artifact,args.output)
