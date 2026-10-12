/* global process */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256, MARKER } from '../../scripts/ci/jules-verdict-core.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const script=path.resolve(here,'../../scripts/ci/verify-jules-run.mjs');
const mock=path.resolve(here,'jules-verdict-api-fixture.mjs');
const head='a'.repeat(40);
const event={action:'completed',workflow_run:{
  id:12,run_attempt:1,workflow_id:7,name:'Jules PR Review',
  path:'.github/workflows/jules-pr-review.yml',event:'pull_request',
  repository:{full_name:'Ianyliu/diagnostic-odyssey'},head_sha:head,
  pull_requests:[{number:102}],
}};
function setup(scenario, brokenFile=false) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jules-ci-fixture-'));
  const eventPath=path.join(dir,'event.json'),statePath=path.join(dir,'state.json');
  const auditPath=brokenFile?path.join(dir,'missing-directory','audit.json'):
    path.join(dir,'audit.json');
  fs.writeFileSync(eventPath,JSON.stringify(event));
  fs.writeFileSync(statePath,JSON.stringify({scenario,calls:[],statuses:[],audit_comments:[]}));
  const env={...process.env,
    GITHUB_REPOSITORY:'Ianyliu/diagnostic-odyssey',
    GITHUB_EVENT_PATH:eventPath,GITHUB_RUN_ID:'999',
    GITHUB_SERVER_URL:'https://github.com',GITHUB_API_URL:'https://api.github.com',
    GH_TOKEN:'unit-test-only',MOCK_STATE_PATH:statePath,JULES_AUDIT_PATH:auditPath,
    ARCHIVE_ID:'321',ARCHIVE_DIGEST:'sha256:'+'c'.repeat(64),
    ARCHIVE_OUTCOME:'success',
  };
  return {dir,statePath,auditPath,env,
    state:()=>JSON.parse(fs.readFileSync(statePath,'utf8')),
    record:()=>JSON.parse(fs.readFileSync(auditPath,'utf8')),
    run:(mode,overrides={})=>spawnSync(process.execPath,['--import',mock,script,mode],{
      env:{...env,...overrides},encoding:'utf8',timeout:10000,
    }),
    cleanup:()=>fs.rmSync(dir,{recursive:true,force:true}),
  };
}
test('APPROVE: capture comment and ZIP-artifact confirmation precede any status',()=>{
  const x=setup('approve');
  try {
    const c=x.run('collect');assert.equal(c.status,0,c.stderr);
    let s=x.state();assert.equal(s.statuses.length,0);
    assert.equal(s.audit_comments.length,1);
    assert.ok(s.audit_comments[0].includes('Captured review-body preimage'));
    assert.ok(!s.audit_comments[0].includes(MARKER));
    const r=x.record();
    assert.equal(r.provisional.approved,true);
    assert.equal(r.capture.sources[0].body_sha256,sha256(r.capture.sources[0].body));
    assert.equal(r.capture.reviewer_head,head);
    assert.ok(r.payload_sha256);
    const f=x.run('finalize');assert.equal(f.status,0,f.stderr);
    s=x.state();
    assert.equal(s.statuses.at(-1).state,'success');
    assert.equal(s.audit_comments.length,2);
    assert.ok(s.audit_comments[1].includes('finalization receipt'));
    assert.ok(s.audit_comments[1].includes('Archive ZIP digest'));
    assert.ok(s.calls.lastIndexOf('POST /repos/Ianyliu/diagnostic-odyssey/issues/102/comments') <
      s.calls.indexOf('POST /repos/Ianyliu/diagnostic-odyssey/statuses/'+head));
    assert.ok(s.calls.indexOf('GET /repos/Ianyliu/diagnostic-odyssey/actions/runs/999/artifacts') <
      s.calls.indexOf('POST /repos/Ianyliu/diagnostic-odyssey/statuses/'+head));
  } finally{x.cleanup();}
});
const negative=[
  ['block',true],['comment',true],['invalid-verdict',true],['timeout',true],
  ['log-error',true],['overwritten',true],['ambiguous-author',false],
  ['edited-after-capture',false],['missing-artifact',false],
  ['audit-post-failure',false],['final-comment-failure',false],
];
for(const [scenario] of negative){
  test('archived '+scenario+' cannot authorize status success',()=>{
    const x=setup(scenario);
    try{
      const c=x.run('collect');assert.equal(c.status,0,c.stderr);
      const record=x.record();
      if(['block','comment','invalid-verdict','timeout','overwritten','log-error'].includes(scenario)){
        assert.ok(record.capture.sources.length>0);
        assert.equal(record.capture.sources[0].body_sha256,
          sha256(record.capture.sources[0].body));
        assert.ok(x.state().audit_comments[0].includes('preimage'));
      }
      const f=x.run('finalize');
      assert.notEqual(f.status,0,'negative scenario must not finish as approved');
      assert.equal(x.state().statuses.at(-1).state,'failure');
    }finally{x.cleanup();}
  });
}
for(const scenario of ['newer-run','newer-attempt','stale-head']){
  test('stale callback '+scenario+' never overwrites a newer effective status',()=>{
    const x=setup(scenario);
    try{
      assert.equal(x.run('collect').status,0);
      const st=x.state();
      st.statuses=[{state:'success',context:'jules/verdict-gate'}];
      fs.writeFileSync(x.statePath,JSON.stringify(st));
      x.run('finalize');
      assert.equal(x.state().statuses.length,1);
    }finally{x.cleanup();}
  });
}
test('failed upload despite prior successful status produces failure (no new success)',()=>{
  const x=setup('approve');
  try{
    assert.equal(x.run('collect').status,0);
    const state=x.state();
    state.statuses=[{state:'success',context:'jules/verdict-gate'}];
    fs.writeFileSync(x.statePath,JSON.stringify(state));
    assert.notEqual(x.run('finalize',{ARCHIVE_OUTCOME:'failure'}).status,0);
    assert.deepEqual(x.state().statuses.map(s=>s.state),['success','failure']);
  }finally{x.cleanup();}
});
test('filesystem failure is captured as failure status if GitHub remains available',()=>{
  const x=setup('approve',true);
  try{
    assert.notEqual(x.run('collect').status,0);
    assert.notEqual(x.run('finalize',{ARCHIVE_OUTCOME:'failure'}).status,0);
    assert.equal(x.state().statuses.at(-1).state,'failure');
  }finally{x.cleanup();}
});
test('status API error cannot be called durable approval',()=>{
  const x=setup('status-write-failure');
  try{
    assert.equal(x.run('collect').status,0);
    assert.notEqual(x.run('finalize').status,0);
    assert.equal(x.state().statuses.length,0);
  }finally{x.cleanup();}
});
test('malicious PR description is never interpreted as a reviewer verdict',()=>{
  const x=setup('approve');
  try{
    assert.equal(x.run('collect').status,0);
    assert.equal(x.run('finalize').status,0);
    assert.equal(x.state().statuses.at(-1).state,'success');
  }finally{x.cleanup();}
});

test('archive digest or ID mismatch is never accepted',()=>{
  for (const env of [{ARCHIVE_DIGEST:'sha256:'+'f'.repeat(64)},{ARCHIVE_ID:'9876'}]) {
    const x=setup('approve');
    try {
      assert.equal(x.run('collect').status,0);
      assert.notEqual(x.run('finalize',env).status,0);
      assert.equal(x.state().statuses.at(-1).state,'failure');
    } finally { x.cleanup(); }
  }
});
test('existing spoofed green is not accepted as review evidence for BLOCK',()=>{
  const x=setup('block');
  try {
    assert.equal(x.run('collect').status,0);
    const st=x.state();
    st.statuses.push({state:'success',context:'jules/verdict-gate',actor:'untrusted-writer'});
    fs.writeFileSync(x.statePath,JSON.stringify(st));
    assert.notEqual(x.run('finalize').status,0);
    assert.equal(x.state().statuses.at(-1).state,'failure');
    // Does not prevent a future third-party writer from spoofing the same context: F1.
  } finally { x.cleanup(); }
});
