/* global process, fetch, URL, console */
import fs from 'node:fs';
import { collectEvidence, assessEvidence, auditMarkdown, CONTEXT, sha256,
  sameReviewerWorkflow, finalizeDisposition, callbackIsCurrent } from './jules-verdict-core.mjs';

const mode = process.argv[2];
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const [owner, name] = (repo || '').split('/');
const root = (process.env.GITHUB_API_URL || 'https://api.github.com') +
  '/repos/' + owner + '/' + name;
const auditPath = process.env.JULES_AUDIT_PATH || '/tmp/jules-verdict-gate.json';
const stub = event.workflow_run;
const gateId = Number(process.env.GITHUB_RUN_ID);
const archiveName = 'jules-attempt-' + stub?.id + '-' + stub?.run_attempt + '-' + gateId;

async function request(path, options = {}) {
  const response = await fetch(root + path, {
    ...options, redirect: 'manual',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error('GitHub HTTP ' + response.status + ' for ' + path.split('?')[0]);
  return response.json();
}
async function jobLog(jobId) {
  const first = await fetch(root + '/actions/jobs/' + jobId + '/logs', {
    redirect: 'manual', headers: { Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json' },
  });
  if (![301,302,303,307,308].includes(first.status)) throw new Error('Unexpected log redirect');
  const target = new URL(first.headers.get('location'));
  if (target.protocol !== 'https:' || !(
    /(^|\.)githubusercontent\.com$/.test(target.hostname) ||
    /(^|\.)blob\.core\.windows\.net$/.test(target.hostname))) {
    throw new Error('Untrusted log redirect URL');
  }
  const response = await fetch(target, { redirect: 'error' }); // never forward the token
  if (!response.ok) throw new Error('Log download HTTP ' + response.status);
  const value = await response.text();
  if (value.length > 2000000) throw new Error('Log exceeds safety bound');
  return value;
}
async function allComments(prNumber) {
  const all = [];
  for (let page=1; page<=20; page++) {
    const part = await request('/issues/' + prNumber + '/comments?per_page=100&page=' + page);
    if (!Array.isArray(part)) throw new Error('Invalid PR comment page');
    all.push(...part);
    if (part.length<100) return all;
  }
  throw new Error('Comment pagination bound exceeded');
}
async function latestRun(run) {
  const page = await request('/actions/workflows/' + run.workflow_id +
    '/runs?event=pull_request&head_sha=' + run.head_sha + '&per_page=100');
  if (!Array.isArray(page.workflow_runs) || page.total_count > 100) {
    throw new Error('Incomplete reviewer-run pagination');
  }
  return page.workflow_runs.filter(r => r.head_sha === run.head_sha &&
    r.event === 'pull_request').sort((a,b) =>
    Date.parse(b.created_at)-Date.parse(a.created_at) || b.id-a.id)[0];
}
async function status(sha, state, reason) {
  await request('/statuses/' + sha, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: CONTEXT, state,
      description: reason.slice(0, 135),
      target_url: process.env.GITHUB_SERVER_URL + '/' + repo +
        '/actions/runs/' + gateId }),
  });
}
function writeCapture(record) {
  const payload = JSON.stringify(record);
  const wrapped = { ...record, payload_sha256: sha256(payload) };
  const tmp = auditPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(wrapped, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 });
  fs.renameSync(tmp, auditPath);
}
async function collect() {
  if (!stub || event.action !== 'completed' ||
      stub.event !== 'pull_request' ||
      stub.path !== '.github/workflows/jules-pr-review.yml' ||
      stub.repository?.full_name !== repo ||
      !/^[a-f0-9]{40}$/.test(stub.head_sha || '')) {
    throw new Error('Invalid reviewer event; no verdict permitted');
  }
  let prNumber = stub.pull_requests?.length === 1 ? stub.pull_requests[0].number : null;
  let run = stub, pr = null, jobs = null, log = null, comments = null;
  const errors = [];
  let provisional = { approved: false, reason: 'Evidence incomplete' };
  try {
    run = await request('/actions/runs/' + stub.id);
    if (run.id !== stub.id || run.run_attempt !== stub.run_attempt ||
        run.head_sha !== stub.head_sha) throw new Error('Run/attempt mismatch');
    if (!prNumber || run.pull_requests?.length !== 1 ||
        run.pull_requests[0].number !== prNumber) throw new Error('Missing unique PR identity');
    const values = await Promise.allSettled([
      request('/pulls/' + prNumber),
      request('/actions/runs/' + run.id + '/jobs?per_page=100'),
      allComments(prNumber),
      request('/contents/.github/workflows/jules-pr-review.yml?ref=' + run.head_sha),
      request('/contents/.github/workflows/jules-pr-review.yml?ref=main'),
      latestRun(run),
    ]);
    const [prv, jobv, commentv, headv, mainv, newestv] = values.map((r,i) => {
      if (r.status === 'rejected') {
        errors.push(['pr','jobs','comments','head-workflow','main-workflow','latest'][i] +
          ': ' + String(r.reason?.message || r.reason).slice(0,160));
        return null;
      }
      return r.value;
    });
    pr=prv; comments=commentv;
    if (jobv && Array.isArray(jobv.jobs) && jobv.total_count<=100) jobs=jobv.jobs;
    else errors.push('Incomplete reviewer jobs');
    const reviewJob = jobs?.filter(j => j.name === 'review') || [];
    if (reviewJob.length === 1) {
      try { log = await jobLog(reviewJob[0].id); }
      catch (e) { errors.push('log: ' + String(e.message).slice(0,160)); }
    } else errors.push('Expected one reviewer job');
    if (!sameReviewerWorkflow(headv,mainv)) errors.push('Reviewer workflow source differs');
    if (!newestv || newestv.id !== run.id ||
        newestv.run_attempt !== run.run_attempt) errors.push('Superseded run/attempt');
    if (errors.length===0) {
      provisional=assessEvidence({repo,run,pr,jobs,log,comments});
    } else provisional={approved:false,reason:'Verification input failure: '+errors.join('; ').slice(0,200)};
  } catch(e) { errors.push(String(e.message || e).slice(0,200)); }
  const capturedAt = new Date().toISOString();
  const capture = collectEvidence({repo,run,pr,jobs,log,comments,capturedAt,errors});
  const record = {
    schema: 'jules-stage-a-audit/v2', repository:repo, pr_number:prNumber,
    reviewer_run_id:stub.id, reviewer_attempt:stub.run_attempt,
    reviewer_head:stub.head_sha, gate_run_id:gateId,
    expected_artifact_name:archiveName, provisional, capture,
    archive_comment_id:null, archive_comment_error:null,
  };
  // A separate append-only comment preserves the exact source text immediately,
  // including negative reviews, before the uploader or final status runs.
  if (prNumber) {
    try {
      const markdown = auditMarkdown({
        run,prNumber,decision:provisional,capture,
        artifactUrl:process.env.GITHUB_SERVER_URL+'/'+repo+'/actions/runs/'+gateId,
      });
      if (markdown.length > 65000) throw new Error('Audit comment exceeds GitHub size bound');
      const c = await request('/issues/'+prNumber+'/comments', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({body:markdown}),
      });
      record.archive_comment_id = c.id;
    } catch(e) {
      record.archive_comment_error=String(e.message || e).slice(0,200);
      record.provisional={approved:false,reason:'Evidence capture comment failed'};
    }
  } else {
    record.provisional={approved:false,reason:'No attributable PR to archive'};
  }
  writeCapture(record); // fail if file cannot be persisted; artifact upload will also fail
  console.log('Captured reviewer evidence, body sources='+capture.sources.length+
    ', eligible='+record.provisional.approved+'; archive will precede any success status');
}
async function finish() {
  if (!stub || !/^[a-f0-9]{40}$/.test(stub.head_sha || '')) {
    throw new Error('Cannot safely identify review HEAD');
  }
  let record = null, outcome = {approved:false,reason:'No stored review capture'};
  try { record=JSON.parse(fs.readFileSync(auditPath,'utf8')); }
  catch(e) { console.error('Missing local audit: '+String(e.message).slice(0,150)); }
  try {
    if (!record || record.reviewer_run_id !== stub.id ||
        record.reviewer_attempt !== stub.run_attempt ||
        record.reviewer_head !== stub.head_sha || record.gate_run_id !== gateId ||
        record.payload_sha256 !== sha256(JSON.stringify(
          Object.fromEntries(Object.entries(record).filter(([k])=>k!=='payload_sha256'))))) {
      throw new Error('Missing, corrupt, or wrong-attempt capture');
    }
    const [run,pr,newest,artifacts,headWorkflow,mainWorkflow] = await Promise.all([
      request('/actions/runs/'+stub.id),
      request('/pulls/'+record.pr_number),
      latestRun(stub),
      request('/actions/runs/'+gateId+'/artifacts?per_page=100'),
      request('/contents/.github/workflows/jules-pr-review.yml?ref='+stub.head_sha),
      request('/contents/.github/workflows/jules-pr-review.yml?ref=main'),
    ]);
    if (!callbackIsCurrent({pr,run,newest})) {
      console.log('Superseded or stale completion: do not overwrite current status');
      return;
    }
    if (artifacts.total_count>100 || !Array.isArray(artifacts.artifacts)) {
      throw new Error('Incomplete archive listing');
    }
    const uploadId=process.env.ARCHIVE_ID;
    const archive=artifacts.artifacts.find(a=>String(a.id)===uploadId);
    const currentComment=record.provisional?.comment_id ?
      await request('/issues/comments/'+record.provisional.comment_id) : null;
    outcome=finalizeDisposition({record,pr,run,newest,archive,
      artifactId:uploadId,artifactDigest:process.env.ARCHIVE_DIGEST,
      currentComment,headWorkflow,currentMainWorkflow:mainWorkflow});
    if (process.env.ARCHIVE_OUTCOME !== 'success') {
      outcome={approved:false,reason:'Artifact upload step did not succeed'};
    }
    // Close the last read/write race as much as native GitHub API permits.
    const [pr2,run2,newest2]=await Promise.all([
      request('/pulls/'+record.pr_number),request('/actions/runs/'+stub.id),
      latestRun(stub),
    ]);
    if (!callbackIsCurrent({pr:pr2,run:run2,newest:newest2})) {
      console.log('Execution superseded just before final status: skip stale callback');
      return;
    }
  } catch(e) {
    outcome={approved:false,reason:'Finalization failure: '+String(e.message || e).slice(0,100)};
    // Attempt to avoid overwriting a newer status even on exception.
    try {
      const run=await request('/actions/runs/'+stub.id);
      const prNumber=record?.pr_number || (stub.pull_requests?.length===1 ?
        stub.pull_requests[0].number : null);
      if (!prNumber) throw new Error('PR mapping unavailable');
      const [pr,newest]=await Promise.all([request('/pulls/'+prNumber),latestRun(stub)]);
      if (!callbackIsCurrent({pr,run,newest})) {
        console.log('Error on stale callback: no status published');
        return;
      }
    } catch(_err) {
      console.error('Cannot establish live callback ordering; no status published');
      throw new Error(outcome.reason);
    }
  }
  // This context is expressly NOT an independent, authoritative merge check.
  await status(stub.head_sha,outcome.approved?'success':'failure',outcome.reason);
  if (!outcome.approved) throw new Error(outcome.reason);
  console.log('Stage A archived assessment (NON-AUTHORITATIVE), artifact='+process.env.ARCHIVE_ID);
}
async function main() {
  if (!token || !owner || !name || !Number.isSafeInteger(gateId)) throw new Error('Missing API configuration');
  if (mode==='collect') return collect();
  if (mode==='finalize') return finish();
  throw new Error('Expected collect or finalize mode');
}
main().catch(e=>{console.error(String(e.message || e));process.exitCode=1;});
