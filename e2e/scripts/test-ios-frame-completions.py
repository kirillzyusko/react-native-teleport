"""Actual producer body and event-driven filesystem controls; no devices or Maestro."""
import argparse
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tempfile
from unittest.mock import patch


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CAP = load('test_completion_capture', 'ios-frame-completions.py')
CHECK = load('test_completion_independent', 'check-ios-frame-completions.py')
LIVE = load('test_completion_unchanged_stream', 'ios-frame-body-live.py')
BODY = CAP.BODY
PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
                    '0000000d49444154089963f8cfc0f01f00050001ffabce36890000000049454e44ae426082')
DEVICE = '00000000-0000-0000-0000-000000000001'
CONTAINER = '00000000-0000-0000-0000-000000000002'
TOKEN = '00000000-0000-0000-0000-000000000003'

SWIFT = r'''
extension TeleportFrameBodyArchive.Store {
    func drainForFixture() { queue.sync {} }
    func recordForFixture(_ values: [String: Any]) { preserveCompletion(values) }
}
@main struct CompletionFixture {
    static func main() throws {
        let mode = CommandLine.arguments[1]
        let root = URL(fileURLWithPath: CommandLine.arguments[2])
        let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==")!
        let hash = SHA256.hash(data: png).map { String(format: "%02x", $0) }.joined()
        let name = "pair-000001-completion.json"
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        if mode == "collision" { try Data("owned sentinel".utf8).write(to: root.appendingPathComponent(name)) }
        let destination = mode == "filesystem" ? root.appendingPathComponent("absent") : root
        let store = ["off", "enabled"].contains(mode)
            ? TeleportFrameBodyArchive.Store(root: root)
            : TeleportFrameBodyArchive.Store(root: destination, completionFiles: true)
        if ["nan", "oversized", "invalid-clock", "filesystem"].contains(mode) {
            var fields: [String: Any] = ["ordinal": 1, "firstReturned": 1.1, "secondReturned": 1.2]
            if mode == "nan" { fields["firstReturned"] = Double.nan }
            if mode == "invalid-clock" { fields["secondReturned"] = 0.5 }
            if mode == "oversized" { fields["padding"] = String(repeating: "x", count: 4096) }
            store.recordForFixture(fields)
        } else {
            store.submit(first: png, second: png, firstHash: hash, secondHash: hash,
                         firstReturned: 1.1, secondReturned: 1.2, isScreenStatic: true)
            store.drainForFixture()
        }
        let names = try FileManager.default.contentsOfDirectory(atPath: root.path).sorted()
        print(String(data: try JSONSerialization.data(withJSONObject: ["mode": mode, "files": names], options: .sortedKeys), encoding: .utf8)!)
    }
}
'''


def run(artifact, output):
    output.mkdir(parents=True, exist_ok=False)
    scope = {'candidate': json.loads((artifact/'maestro-ios-input.json').read_text())['candidate_sha'],
             'run': 1234567, 'attempt': 1, 'profile': 'indigo-visual-touch-trace', 'device': DEVICE}
    CAP.source_check(artifact, scope)
    cases, processes = [], []
    raw = BODY.PATCH.helper_bytes().decode().splitlines(keepends=True)
    assert raw[0].strip() == '#if targetEnvironment(simulator)' and raw[-1].strip() == '#endif'
    actual = ''.join(raw[1:-1])
    assert '.wait(' not in actual and 'queue.sync' not in actual and '.screenshot(' not in actual
    def invoke(command, stdout, stderr, *, environment=None, input_data=None, expected_exit=0):
        child = subprocess.Popen(command, stdout=stdout, stderr=stderr,
                                 stdin=subprocess.PIPE if input_data is not None else None,
                                 env={**os.environ, 'SIMULATOR_UDID': DEVICE, **(environment or {})})
        processes.append({'pid': child.pid, 'parent': os.getpid(), 'command': command,
                          'owner': 'This task compiled completion filesystem control', 'device': None,
                          'port': None, 'normal_stop': 'Normal bounded compiler/fixture completion',
                          'expectedExit': expected_exit})
        processes[-1]['actualPS']=subprocess.run(['ps','-ww','-p',str(child.pid),'-o','pid=,ppid=,uid=,command='],capture_output=True,text=True).stdout
        (output/'processes.json').write_text(json.dumps(processes,indent=2)+'\n')
        try:
            result = child.communicate(input=input_data,timeout=60)
        except subprocess.TimeoutExpired:
            identity=subprocess.run(['ps','-ww','-p',str(child.pid),'-o','pid=,ppid=,uid=,command='],capture_output=True,text=True).stdout
            processes[-1]['timeoutRevalidation']=identity
            fields=identity.strip().split(None,3)
            if len(fields)==4 and int(fields[0])==child.pid and int(fields[1])==os.getpid() and fields[3]==' '.join(command):
                child.terminate();result=child.communicate(timeout=10)
            else:
                raise RuntimeError('Timed-out control process ownership could not be revalidated')
        processes[-1]['exit']=child.returncode
        processes[-1]['postExitPS']=subprocess.run(['ps','-p',str(child.pid),'-o','pid=,command='],capture_output=True,text=True).stdout
        for suffix,raw_output in zip(['stdout','stderr'],result):
            if raw_output is not None:
                (output/f'process-{len(processes):03d}.{suffix}').write_bytes(raw_output)
        (output/'processes.json').write_text(json.dumps(processes,indent=2)+'\n')
        assert child.returncode == expected_exit, (command, child.returncode, expected_exit)
        return result
    binaries={}
    for enabled in [False,True]:
        name='producer-on' if enabled else 'producer-off'
        source=output/(name+'.swift')
        source.write_text(''.join(BODY.PATCH.helper_bytes(completions=enabled).decode().splitlines(keepends=True)[1:-1])+'\n'+SWIFT)
        binaries[enabled]=output/name
        with (output/(name+'-compile.log')).open('w') as log:
            invoke(['xcrun','swiftc','-swift-version','5','-parse-as-library','-module-cache-path',
                    'example/ios/build/ModuleCache.noindex',str(source),'-o',str(binaries[enabled])],log,subprocess.STDOUT)
    for mode in ['off','enabled','collision','nan','invalid-clock','oversized','filesystem']:
        root=output/('producer-'+mode+'-data')
        stdout,stderr=invoke([str(binaries[mode!='off']),mode,str(root)],subprocess.PIPE,subprocess.PIPE)
        (output/(mode+'.stdout')).write_bytes(stdout);(output/(mode+'.stderr')).write_bytes(stderr)
        logs=stderr.decode();files=json.loads(stdout)['files']
        if mode=='off':
            assert files==['pair-000001-first.png','pair-000001-second.png'] and '[teleport-frame-completions]' not in logs
        elif mode=='enabled':
            record=CAP.strict_json((root/'pair-000001-completion.json').read_bytes())
            assert record['phase']=='durable-completion' and record['ordinal']==1 and len(record)==len(CAP.RECORD_KEYS)
            assert set(record)==CAP.RECORD_KEYS and record['firstReturned']==1.1 and record['secondReturned']==1.2
            queued=json.loads(next(line.split(BODY.MARKER,1)[1] for line in logs.splitlines()
                                   if BODY.MARKER in line and '"phase":"queued"' in line))
            CAP.validate_completion(record,queued)
            assert (root/'pair-000001-first.png').read_bytes()==(root/'pair-000001-second.png').read_bytes()
            assert '"phase":"saved"' in logs and '[teleport-frame-completions]' not in logs
        elif mode=='collision':
            assert (root/'pair-000001-completion.json').read_bytes()==b'owned sentinel'
            assert '"phase":"saved"' in logs and '[teleport-frame-completions]' in logs
            assert (root/'pair-000001-first.png').exists() and (root/'pair-000001-second.png').exists()
        else:
            assert not files and '[teleport-frame-completions]' in logs
        cases.append('actual_producer_'+mode)
    methods = load('additional_completion_actual_methods', 'test-ios-frame-body-methods.py')
    methods.run(artifact, output/'original-handler-methods-on', completions=True)
    cases.append('actual_composed_handlers_keep_original_captures_encodes_and_responses')
    with tempfile.TemporaryDirectory(prefix='teleport-completion-controls-') as temporary:
        tmp=Path(temporary);index=0
        def fixture():
            nonlocal index
            index+=1;folder=tmp/str(index)
            container=folder/'Devices'/DEVICE/'data/Containers/Data/Application'/CONTAINER
            root=container/'tmp'/f'teleport-frame-bodies-123-{TOKEN}';root.mkdir(parents=True)
            (container/'.com.apple.mobile_container_manager.metadata.plist').write_bytes(plistlib.dumps({'MCMMetadataIdentifier':CAP.COLLECT.BUNDLE}))
            rows=[]
            for n in [1,2]:
                q={'version':1,'phase':'queued','helperSHA':BODY.sha(BODY.PATCH.HELPER.read_bytes()),
                   'pid':123,'simulatorUDID':DEVICE,'wallTime':1793000000.0+n,'uptime':10.0*n+2,
                   'ordinal':n,'firstHash':BODY.sha(PNG),'secondHash':BODY.sha(PNG),
                   'firstBytes':len(PNG),'secondBytes':len(PNG),'firstReturned':10.0*n,
                   'secondReturned':10.0*n+1,'isScreenStatic':True,'pendingPairs':1}
                rows.append(q)
                if n==1:rows.append({**q,'phase':'initialized','root':str(root),'limits':BODY.PATCH.LIMITS})
                done={k:q[k] for k in ['version','helperSHA','pid','simulatorUDID','ordinal','firstHash','secondHash',
                                      'firstBytes','secondBytes','firstReturned','secondReturned','isScreenStatic']}
                done.update(phase='durable-completion',uptime=q['uptime']+.1,wallTime=q['wallTime']+.1,
                            firstFile=f'pair-{n:06d}-first.png',secondFile=f'pair-{n:06d}-second.png')
                (root/f'pair-{n:06d}-completion.json').write_text(json.dumps(done))
                for side in ['first','second']:(root/done[side+'File']).write_bytes(PNG)
                rows.append({**done,'phase':'saved'})
            return folder,root,rows
        def encoded(rows):
            return ''.join(f"2026-10-28 12:00:00.000 Df maestro-driver-iosUITests-Runner[{r['pid']}:ab1f] (Foundation) "+BODY.MARKER+json.dumps(r)+'\n' for r in rows)
        def capture(folder,rows,delete_at_EOF=None,raw_input=None):
            class Source(io.BytesIO):
                reads=0
                def readline(self,size=-1):
                    self.reads+=1
                    raw=super().readline(size)
                    if not raw and delete_at_EOF and delete_at_EOF.exists():shutil.rmtree(delete_at_EOF)
                    return raw
            cap=CAP.Capture(artifact,scope,folder/'Devices',folder/'supplementary')
            source=Source(raw_input if raw_input is not None else encoded(rows).encode())
            reader=CAP.ExistingInput(source,cap)
            original=LIVE.stream(artifact,DEVICE,folder/'Devices',folder/'original',reader)
            report=cap.finish(reader.ended)
            assert source.reads==len(source.getvalue().splitlines())+1 if reader.ended else source.reads<=len(source.getvalue().splitlines())+1
            return original,report
        def proc(report,original):
            failed=bool(original['errors'])
            return {'pid':report['workerPID'],'parentPID':report['parentPID'],'exit':int(failed),'signal':None,
                    'errors':['original failed'] if failed else [],'inputEnded':True,'deviceAPICalls':0,
                    'parentCommand':['node','native-diagnostics.mjs','ios',DEVICE,'--','owned-fixture'],
                    'wrapperSourceSHA256':BODY.sha(Path(__file__).with_name('native-diagnostics.mjs').read_bytes()),
                    'inputBufferBytes':8*1024*1024,
                    'workerFinished':not failed,'copiedPNGsObserved':len(original['files']),
                    'nodeVersion':'v20.19.4','workerSourceSHA256':LIVE.source_hash(),'adapterSourceSHA256':LIVE.adapter_hash()}
        def checked(folder,rows,report,process,body_text=None):
            archive=folder/'supplementary'
            names=[str(f.relative_to(archive)) for f in archive.rglob('*') if f.is_file()]
            dirs=[str(f.relative_to(archive)) for f in archive.rglob('*') if f.is_dir()]
            return CHECK.check(artifact,body_text if body_text is not None else encoded(rows),scope,report,process,lambda n:(archive/n).read_bytes(),names,directories=dirs)
        for name,drop in [('CLI_enabled_complete',False),('CLI_enabled_lost_saved_original_exit1',True)]:
            folder,root,rows=fixture()
            if drop:rows=[r for r in rows if not (r['phase']=='saved' and r['ordinal']==1)]
            environment={'MAESTRO_IOS_ARCHIVE_FRAMES':'true','MAESTRO_IOS_DURABLE_COMPLETIONS':'true',
                         'MAESTRO_IOS_PROFILE':scope['profile'],'GITHUB_SHA':scope['candidate'],
                         'GITHUB_RUN_ID':str(scope['run']),'GITHUB_RUN_ATTEMPT':'1'}
            invoke([sys.executable,'-B',str(Path(__file__).with_name('ios-frame-body-live.py')),
                    '--artifact',str(artifact),'--device',DEVICE,'--devices-root',str(folder/'Devices'),
                    '--output',str(folder/'live')],subprocess.PIPE,subprocess.PIPE,
                   environment=environment,input_data=encoded(rows).encode(),expected_exit=int(drop))
            original=json.loads((folder/'live/manifest.json').read_text())
            supplementary=json.loads((folder/'live-completions/manifest.json').read_text())
            assert bool(original['errors']) is drop and supplementary['errors']==[] and len(supplementary['completions'])==2
            assert supplementary['workerPID']==processes[-1]['pid'] and supplementary['parentPID']==os.getpid()
            (output/(name+'-original.json')).write_text(json.dumps(original,indent=2)+'\n')
            (output/(name+'-additional.json')).write_text(json.dumps(supplementary,indent=2)+'\n')
            cases.append(name)
        folder,root,rows=fixture()
        invoke([sys.executable,'-B',str(Path(__file__).with_name('ios-frame-body-live.py')),
                '--artifact',str(artifact),'--device',DEVICE,'--devices-root',str(folder/'Devices'),
                '--output',str(folder/'live')],subprocess.PIPE,subprocess.PIPE,
               environment={'MAESTRO_IOS_DURABLE_COMPLETIONS':'false'},input_data=encoded(rows).encode())
        assert not (folder/'live-completions').exists()
        cases.append('CLI_default_OFF_creates_no_additional_archive')
        for name,drop in [('all_original_logs',False),('lost_saved_log_keeps_original_FAILED',True)]:
            folder,root,rows=fixture()
            if drop:rows=[r for r in rows if not (r['phase']=='saved' and r['ordinal']==1)]
            original,report=capture(folder,rows,delete_at_EOF=root.parents[1])
            assert not report['errors'] and len(report['completions'])==2,report
            assert bool(original['errors']) is drop,original
            result=checked(folder,rows,report,proc(report,original))
            assert result['PNGs']==4 and result['originalSavedCoverageComplete'] is not drop
            assert result['originalWorkerSucceeded'] is not drop
            if drop:
                try:
                    BODY.runtime_contract(rows,[],BODY.source_audit(artifact),DEVICE)
                except ValueError as error:
                    assert str(error)=='Missing/duplicate/incomplete body pairs'
                else:
                    raise AssertionError('Original independent body gate accepted the lost saved log')
                shutil.copytree(folder/'supplementary',output/'lost-saved-positive-archive')
                (output/'lost-saved-original-manifest.json').write_text(json.dumps(original,indent=2)+'\n')
                (output/'lost-saved-additional-check.json').write_text(json.dumps(result,indent=2)+'\n')
            cases.append(name)
        def rejected_capture(name,mutation):
            folder,root,rows=fixture();mutation(root,rows)
            original,report=capture(folder,rows)
            assert report['errors'],name
            cases.append(name)
        def alter(root,key,value):
            file=root/'pair-000001-completion.json';d=json.loads(file.read_text());d[key]=value;file.write_text(json.dumps(d))
        for key,value in [('helperSHA','0'*64),('simulatorUDID','foreign'),('pid',124),('ordinal',True),
                          ('firstHash','0'*64),('secondBytes',1),('firstReturned',99),('isScreenStatic',False),
                          ('uptime',0),('wallTime',False),('firstFile','../escape.png'),('version',True),('foreign',1)]:
            rejected_capture('producer_'+key,lambda root,rows,k=key,v=value:alter(root,k,v))
        rejected_capture('missing_completion',lambda root,rows:(root/'pair-000001-completion.json').unlink())
        rejected_capture('missing_original_PNG',lambda root,rows:(root/'pair-000001-first.png').unlink())
        rejected_capture('oversized_completion',lambda root,rows:(root/'pair-000001-completion.json').write_bytes(b'x'*4097))
        rejected_capture('invalid_UTF8',lambda root,rows:(root/'pair-000001-completion.json').write_bytes(b'\xff'))
        rejected_capture('JSON_duplicate_key',lambda root,rows:(root/'pair-000001-completion.json').write_bytes(b'{"version":1,"version":1}'))
        rejected_capture('JSON_nonfinite',lambda root,rows:alter(root,'uptime',float('nan')))
        rejected_capture('wrong_PNG_bytes',lambda root,rows:(root/'pair-000001-first.png').write_bytes(PNG+b'x'))
        rejected_capture('corrupt_PNG_CRC',lambda root,rows:(root/'pair-000001-first.png').write_bytes(PNG[:-5]+b'xxxxx'))
        def linked(root,rows):
            file=root/'pair-000001-completion.json';file.unlink();file.symlink_to(root/'pair-000002-completion.json')
        rejected_capture('completion_symlink',linked)
        def hardlink(root,rows):os.link(root/'pair-000001-first.png',root/'hardlink.png')
        rejected_capture('PNG_hardlink',hardlink)
        rejected_capture('completion_hardlink',lambda root,rows:os.link(root/'pair-000001-completion.json',root/'extra-completion'))
        rejected_capture('nonregular_completion',lambda root,rows:((root/'pair-000001-completion.json').unlink(),(root/'pair-000001-completion.json').mkdir()))
        rejected_capture('foreign_MCM',lambda root,rows:(root.parents[1]/'.com.apple.mobile_container_manager.metadata.plist').write_bytes(plistlib.dumps({'MCMMetadataIdentifier':'foreign'})))
        rejected_capture('duplicate_root',lambda root,rows:rows.insert(2,copy.deepcopy(rows[1])))
        rejected_capture('missing_queued',lambda root,rows:rows.pop(0))
        rejected_capture('wrong_queued_clock',lambda root,rows:rows[0].update(firstReturned=99))
        folder,root,rows=fixture();changed=[False];original_read=os.read
        selected=(root/'pair-000001-completion.json').stat().st_ino
        def replace_during_read(fd,count):
            raw=original_read(fd,count)
            if raw and not changed[0] and os.fstat(fd).st_ino==selected:
                target=root/'pair-000001-completion.json';replacement=root/'replacement'
                replacement.write_bytes(target.read_bytes());replacement.replace(target);changed[0]=True
            return raw
        with patch.object(CAP.os,'read',replace_during_read):original,report=capture(folder,rows)
        assert changed[0] and report['errors'] and not original['errors']
        cases.append('changed_descriptor_rejected_without_original_gate_change')
        folder,root,rows=fixture()
        raw=encoded(rows).encode()+b'[teleport-frame-completions] {"phase":"write.error"}\n'
        original,report=capture(folder,rows,raw_input=raw)
        assert report['errors'] and not original['errors'] and report['producerErrorLines']
        cases.append('new_producer_error_is_fatal_and_preserves_original_worker_result')
        folder,root,rows=fixture()
        raw=encoded(rows).replace('"ordinal": 1','"ordinal": 1, "ordinal": 1',1).encode()
        original,report=capture(folder,rows,raw_input=raw)
        assert report['errors'] and not original['errors']
        cases.append('duplicate_raw_key_rejected_by_additional_gate')
        folder,root,rows=fixture()
        raw=encoded(rows).encode()+(b'x'*(1024*1024-1)+b'\n')*17
        original,report=capture(folder,rows,raw_input=raw)
        assert not original['errors'] and not report['errors']
        assert checked(folder,rows,report,proc(report,original),raw.decode())['PNGs']==4
        cases.append('large_unrelated_unified_log_does_not_consume_body_metadata_budget')
        folder,root,rows=fixture();extra=[]
        for n in range(3,23):
            q=copy.deepcopy(rows[3]);q.update(ordinal=n,padding='x'*950000);extra.append(q)
        original,report=capture(folder,rows,raw_input=encoded(rows+extra).encode())
        assert original['errors'] and any('body metadata bound' in e for e in report['errors'])
        cases.append('original_body_metadata_channel_budget_still_rejected')
        folder,root,rows=fixture();original,report=capture(folder,rows);process=proc(report,original)
        for name,mutation in [
            ('manifest_scope',lambda d:d['scope'].update(run=9)),
            ('manifest_bool_attempt',lambda d:d['scope'].update(attempt=True)),
            ('manifest_bool_version',lambda d:d.update(version=True)),
            ('manifest_bool_device_calls',lambda d:d.update(deviceAPICalls=False)),
            ('manifest_source',lambda d:d.update(collectorSourceSHA256='0'*64)),
            ('manifest_errors',lambda d:d.update(errors=['failed'])),
            ('manifest_EOF',lambda d:d.update(inputEnded=False)),
            ('raw_line_hash',lambda d:d['bodyLineSHA256'].__setitem__(0,'0'*64)),
            ('receipt_inode',lambda d:d['members'][0]['source']['identity'].update(inode=0)),
            ('receipt_link',lambda d:d['members'][0]['source']['identity'].update(links=2)),
            ('receipt_clock',lambda d:d['members'][0].update(copiedNs=True)),
            ('receipt_root',lambda d:d['members'][0]['root'].update(container=TOKEN)),
            ('missing_member_receipt',lambda d:d['members'].pop()),
            ('completion_value',lambda d:d['completions'][0].update(firstReturned=999)),
        ]:
            bad=copy.deepcopy(report);mutation(bad)
            try:checked(folder,rows,bad,process)
            except (ValueError,KeyError,TypeError):pass
            else:raise AssertionError(name)
            cases.append('independent_'+name)
        for name,change in [('scope_candidate',{'candidate':'0'*40}),('scope_attempt',{'attempt':2}),('scope_run',{'run':0})]:
            bad={**scope,**change}
            try:CHECK.check(artifact,encoded(rows),bad,report,process,lambda n:(_ for _ in ()).throw(AssertionError('archive accessed')),[],directories=[])
            except ValueError:pass
            else:raise AssertionError(name)
            cases.append(name+'_before_archive_read')
        archive=folder/'supplementary';(archive/'unexpected').write_text('owned control')
        try:checked(folder,rows,report,process)
        except ValueError:pass
        else:raise AssertionError('extra archive member')
        cases.append('independent_extra_archive_member')
        (archive/'unexpected').unlink();(archive/'empty-extra').mkdir()
        try:checked(folder,rows,report,process)
        except ValueError:pass
        else:raise AssertionError('extra archive directory')
        cases.append('independent_extra_archive_directory')
    result={'version':1,'caseCount':len(cases),'cases':cases,'collectorSourceSHA256':CAP.source_hash(),
            'checkerSourceSHA256':BODY.sha(Path(__file__).with_name('check-ios-frame-completions.py').read_bytes()),
            'testSourceSHA256':BODY.sha(Path(__file__).read_bytes()),'producerHelperSHA256':BODY.sha(BODY.PATCH.HELPER.read_bytes()),
            'deviceAPICalls':0,'extraScreenshotOrEncodingCalls':0,'scope':'Actual producer body plus original worker and independent byte/raw/descriptor controls on generated filesystem fixtures only.',
            'final_stability_credit':False}
    (output/'report.json').write_text(json.dumps(result,indent=2)+'\n')
    for name in ['ios-frame-completions.py','check-ios-frame-completions.py','test-ios-frame-completions.py']:
        (output/name).write_bytes(Path(__file__).with_name(name).read_bytes())
    print(json.dumps(result))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--artifact',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();run(args.artifact,args.output)
