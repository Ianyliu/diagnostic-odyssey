import fs from 'node:fs';
import { assessEvidence, auditMarkdown, CONTEXT, sameReviewerWorkflow } from './jules-verdict-core.mjs';

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const apiRoot = process.env.GITHUB_API_URL || 'https://api.github.com';
const [owner, name] = (repo || '').split('/');
const root = apiRoot + '/repos/' + owner + '/' + name;
const auditPath = '/tmp/jules-verdict-gate.json';

async function request(path, options = {}) {
  const response = await fetch(path.startsWith('https://') ? path : root + path, {
    ...options, redirect: 'manual',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error('GitHub API HTTP ' + response.status + ' for ' + path.split('?')[0]);
  return response.json();
}

async function jobLog(jobId) {
  // GitHub returns a temporary signed URL. NEVER forward GITHUB_TOKEN to that host.
  const first = await fetch(root + '/actions/jobs/' + jobId + '/logs', {
    redirect: 'manual',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
  });
  if (![301, 302, 303, 307, 308].includes(first.status)) {
    throw new Error('Unexpected reviewer log redirect/status ' + first.status);
  }
  const target = new URL(first.headers.get('location'));
  if (target.protocol !== 'https:' ||
      !(/(^|\.)githubusercontent\.com$/.test(target.hostname) ||
        /(^|\.)blob\.core\.windows\.net$/.test(target.hostname))) {
    throw new Error('Rejected unexpected external log URL host');
  }
  const response = await fetch(target, { redirect: 'error' }); // no token
  if (!response.ok) throw new Error('Reviewer log download failed: ' + response.status);
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error('Reviewer log unexpectedly large');
  return body;
}

async function allComments(prNumber) {
  const comments = [];
  for (let page = 1; page <= 20; page++) {
    const part = await request('/issues/' + prNumber + '/comments?per_page=100&page=' + page);
    if (!Array.isArray(part)) throw new Error('Invalid issue comment response');
    comments.push(...part);
    if (part.length < 100) return comments;
  }
  throw new Error('Comment pagination exceeds bounded audit limit');
}

async function postStatus(sha, state, description) {
  await request('/statuses/' + sha, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state, context: CONTEXT, description: description.slice(0, 140),
      target_url: process.env.GITHUB_SERVER_URL + '/' + repo +
        '/actions/runs/' + process.env.GITHUB_RUN_ID,
    }),
  });
}

async function main() {
  if (!token || !owner || !name) throw new Error('Missing GitHub API configuration');
  if (process.env.GITHUB_EVENT_NAME === 'pull_request_target') {
    // Base-branch workflow only; no checkout/interpretation of PR source or description.
    const p = event.pull_request;
    if (!p || !/^[a-f0-9]{40}$/.test(p.head?.sha || '')) throw new Error('Invalid PR HEAD');
    await postStatus(p.head.sha, 'pending', 'Awaiting exact-head attributable Jules approval');
    return;
  }
  if (process.env.GITHUB_EVENT_NAME !== 'workflow_run' ||
      event.workflow_run?.name !== 'Jules PR Review' ||
      event.workflow_run?.path !== '.github/workflows/jules-pr-review.yml' ||
      event.workflow_run?.event !== 'pull_request' ||
      event.workflow_run?.repository?.full_name !== repo ||
      !/^[a-f0-9]{40}$/.test(event.workflow_run?.head_sha || '')) {
    throw new Error('Unrecognized reviewer workflow event');
  }
  const stub = event.workflow_run;
  if (event.action !== 'completed') {
    const prNumber = stub.pull_requests?.length === 1 && stub.pull_requests[0].number;
    if (!prNumber) return; // absent mapping cannot create success
    const pr = await request('/pulls/' + prNumber);
    if (pr.head?.sha === stub.head_sha && pr.state === 'open') {
      await postStatus(stub.head_sha, 'pending', 'Reviewer run underway; approval not yet established');
    }
    return;
  }

  let decision = { approved: false, reason: 'Verifier did not complete' };
  let prNumber = stub.pull_requests?.length === 1 ? stub.pull_requests[0].number : null;
  let canonical = stub;
  try {
    canonical = await request('/actions/runs/' + stub.id);
    if (canonical.id !== stub.id || canonical.run_attempt !== stub.run_attempt ||
        canonical.head_sha !== stub.head_sha) {
      throw new Error('Reviewer run identity changed');
    }
    if (!prNumber || canonical.pull_requests?.length !== 1 ||
        canonical.pull_requests[0].number !== prNumber) {
      throw new Error('Missing unique GitHub-attested PR mapping');
    }
    const [pr, jobs, latest, headWorkflow, mainWorkflow] = await Promise.all([
      request('/pulls/' + prNumber),
      request('/actions/runs/' + stub.id + '/jobs?per_page=100'),
      request('/actions/workflows/' + canonical.workflow_id +
        '/runs?event=pull_request&head_sha=' + canonical.head_sha + '&per_page=100'),
      request('/contents/.github/workflows/jules-pr-review.yml?ref=' + canonical.head_sha),
      request('/contents/.github/workflows/jules-pr-review.yml?ref=main'),
    ]);
    if (!sameReviewerWorkflow(headWorkflow, mainWorkflow)) {
      throw new Error('Reviewer workflow source differs from trusted current main');
    }
    if (jobs.total_count > 100 || !Array.isArray(jobs.jobs) ||
        !Array.isArray(latest.workflow_runs)) throw new Error('Incomplete workflow job/run pages');
    const newest = latest.workflow_runs
      .filter(r => r.head_sha === canonical.head_sha && r.event === 'pull_request')
      .sort((a, b) => (Date.parse(b.created_at) - Date.parse(a.created_at)) || b.id - a.id)[0];
    if (!newest || newest.id !== canonical.id) throw new Error('Superseded by newer same-head review run');
    const job = jobs.jobs.filter(j => j.name === 'review');
    if (job.length !== 1) throw new Error('Missing/duplicate reviewer job');
    const [log, comments] = await Promise.all([jobLog(job[0].id), allComments(prNumber)]);
    decision = assessEvidence({ repo, run: canonical, pr, jobs: jobs.jobs, log, comments });
  } catch (e) {
    decision = { approved: false, reason: 'Verifier/API failure: ' + String(e.message || e).slice(0, 250) };
  }

  const record = {
    schema: 'jules-verdict-attempt/v1', repo, pr_number: prNumber,
    reviewer_run_id: canonical.id, reviewer_attempt: canonical.run_attempt,
    reviewer_head: canonical.head_sha, gate_run_id: process.env.GITHUB_RUN_ID,
    approved: decision.approved, reason: decision.reason,
    session_id: decision.session_id || null, comment_id: decision.comment_id || null,
    comment_updated_at: decision.comment_updated_at || null,
    body_sha256: decision.body_sha256 || null,
    // Exact preimage is retained in the run artifact, even if upstream edits its comment.
    reviewer_body: decision.body || null,
  };
  fs.writeFileSync(auditPath, JSON.stringify(record, null, 2) + '\n');
  if (prNumber) {
    try {
      const artifactUrl = process.env.GITHUB_SERVER_URL + '/' + repo +
        '/actions/runs/' + process.env.GITHUB_RUN_ID;
      await request('/issues/' + prNumber + '/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: auditMarkdown({ run: canonical, prNumber, decision, artifactUrl }) }),
      });
    } catch (e) {
      decision = { approved: false, reason: 'Append-only audit comment failed: ' + String(e.message || e) };
    }
  } else {
    decision = { approved: false, reason: 'No attributable PR for audit comment' };
  }
  // No success until AFTER the independent audit has been written.
  await postStatus(stub.head_sha, decision.approved ? 'success' : 'failure', decision.reason);
  if (!decision.approved) throw new Error(decision.reason);
  console.log('Exact-head substantive verdict verified; SHA-256: ' + (record.body_sha256 || 'n/a'));
}

main().catch(async (e) => {
  console.error(String(e.message || e));
  process.exitCode = 1;
});
