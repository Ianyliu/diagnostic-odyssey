import { createHash } from 'node:crypto';

export const CONTEXT = 'jules/verdict-gate';
export const MARKER = '<!-- jules-pr-reviewer -->';
const SHA = /^[a-f0-9]{40}$/;
const failure = reason => ({ approved: false, reason });
const clean = value => typeof value === 'string' ? value : '';
const iso = value => Number.isFinite(Date.parse(value || '')) ? new Date(value).toISOString() : null;
export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');

// Evidence collection is deliberately independent of approval assessment. All available
// negative outcomes, including overwritten and inconsistent bot comments, are preserved.
export function collectEvidence({ repo, run, pr, jobs, log, comments, capturedAt, errors = [] }) {
  const sessionMatches = [...clean(log).matchAll(/\bJules session: (\d+)/g)];
  const sessionId = sessionMatches.length === 1 ? sessionMatches[0][1] : null;
  const summaries = [...clean(log).matchAll(/\bVerdict: (approve|comment|block)\. Status check: (success|failure|error)\./gi)];
  const excerpts = clean(log).split('\n').filter(s =>
    /Jules session:|VERDICT line|Verdict: (approve|comment|block)|Timed out waiting|Collected review|Skipping draft|Review failed:/.test(s));
  // Reject rather than silently truncate a large reviewer body. No source name is assumed to
  // prove model authorship: github-actions[bot] is a shared identity.
  const candidates = Array.isArray(comments) ? comments.filter(c =>
    c?.user?.login === 'github-actions[bot]' &&
    typeof c.body === 'string' && c.body.startsWith(MARKER + '\n')) : [];
  const sources = candidates.slice(0, 10).map(c => {
    const body = c.body.length <= 60000 ? c.body : null;
    return {
      comment_id: c.id ?? null, author: c.user?.login || null, url: c.html_url || null,
      created_at: iso(c.created_at), updated_at: iso(c.updated_at || c.created_at),
      captured_at: capturedAt, body, body_sha256: body === null ? null : sha256(body),
      matches_session: !!sessionId && !!body &&
        body.endsWith('_Session: ' + String.fromCharCode(96) + sessionId +
          String.fromCharCode(96) + '_'),
      limitation: body === null ? 'Reviewer body absent or exceeds bound' :
        'Mutable GitHub bot comment; source account is shared; no independently signed Jules attestation',
    };
  });
  return {
    schema: 'jules-review-capture/v2', repository: repo, pr_number: pr?.number ?? null,
    reviewer_head: run?.head_sha ?? null, reviewer_run_id: run?.id ?? null,
    reviewer_attempt: run?.run_attempt ?? null, reviewer_workflow: run?.path ?? null,
    reviewer_run_state: run?.status ?? null, reviewer_run_conclusion: run?.conclusion ?? null,
    reviewer_run_url: run?.html_url ?? null, captured_at: capturedAt,
    session_id: sessionId, session_count: sessionMatches.length,
    log_sha256: typeof log === 'string' ? sha256(log) : null,
    log_excerpt: excerpts.slice(-30), // diagnostic only, not a reconstruction of full message
    log_limitation: typeof log === 'string' ?
      'Workflow log is mutable/retention-limited and often omits substantive review prose' :
      'Reviewer log unavailable; no verdict may be authenticated',
    reported_verdicts: summaries.map(m => ({ verdict: m[1].toLowerCase(), status: m[2].toLowerCase() })),
    review_jobs: (jobs || []).map(j => ({ id: j.id ?? null, name: j.name, conclusion: j.conclusion })),
    sources, source_count: candidates.length, errors: [...errors],
    trust_limitation: 'Stage A is NON-AUTHORITATIVE: a shared bot and third-party status writer do not authenticate a Jules verdict; GitHub comments and artifacts can be deleted',
  };
}

// The reviewer text is UNTRUSTED DATA. No PR title/body/diff ever controls verification.
export function assessEvidence({ repo, run, pr, jobs, log, comments }) {
  if (!run || run.event !== 'pull_request' ||
      run.path !== '.github/workflows/jules-pr-review.yml' ||
      run.repository?.full_name !== repo || run.head_repository?.full_name !== repo ||
      !SHA.test(run.head_sha || '') ||
      run.status !== 'completed' || run.conclusion !== 'success') {
    return failure('Untrusted, incomplete, or unsuccessful reviewer workflow');
  }
  if (!Array.isArray(run.pull_requests) || run.pull_requests.length !== 1 ||
      run.pull_requests[0].number !== pr?.number ||
      pr?.head?.sha !== run.head_sha || pr?.state !== 'open' ||
      pr?.draft || pr?.base?.ref !== 'main' ||
      pr?.head?.repo?.full_name !== repo) {
    return failure('PR mapping is missing, draft/closed, forked, or stale HEAD');
  }
  const reviewers = (jobs || []).filter(j => j.name === 'review');
  if (reviewers.length !== 1 || reviewers[0].conclusion !== 'success') {
    return failure('Missing, duplicated, or unsuccessful reviewer job');
  }
  if (typeof log !== 'string' || log.length > 2000000) {
    return failure('Missing or oversized reviewer log');
  }
  const sessions = [...log.matchAll(/^[^\n]*\bJules session: (\d+)\s*$/gm)];
  const finals = [...log.matchAll(/^[^\n]*\bGot final review with VERDICT line on attempt \d+\.\s*$/gm)];
  const summaries = [...log.matchAll(/^[^\n]*\bVerdict: (approve|comment|block)\. Status check: (success|failure|error)\.\s*$/gm)];
  if (sessions.length !== 1 || finals.length !== 1 || summaries.length !== 1 ||
      /Timed out waiting for a message containing a VERDICT line/i.test(log)) {
    return failure('Missing, timeout, or ambiguous terminal Jules review evidence');
  }
  if (summaries[0][1] !== 'approve' || summaries[0][2] !== 'success') {
    return failure('Jules verdict is not a substantive APPROVE');
  }
  const sessionId = sessions[0][1];
  const matching = (comments || []).filter(c =>
    c.user?.login === 'github-actions[bot]' &&
    typeof c.body === 'string' && c.body.startsWith(MARKER + '\n') &&
    c.body.endsWith('_Session: ' + String.fromCharCode(96) + sessionId +
      String.fromCharCode(96) + '_') &&
    c.body.length <= 60000);
  if (matching.length !== 1) return failure('No unique attributable final posted comment/session');
  const comment = matching[0];
  const lines = [...comment.body.matchAll(/^\s*VERDICT:\s*(approve|comment|block)\s*$/gim)];
  if (lines.length !== 1 || lines[0][1].toLowerCase() !== 'approve' ||
      /\[BLOCKING\]/i.test(comment.body)) {
    return failure('Comment lacks one consistent approving verdict');
  }
  const changed = Date.parse(comment.updated_at || comment.created_at || '');
  const started = Date.parse(run.created_at || '');
  const finished = Date.parse(run.updated_at || '');
  if (![changed, started, finished].every(Number.isFinite) ||
      changed < started || changed > finished + 120000) {
    return failure('Comment edit is not attributable to this workflow interval');
  }
  return {
    approved: true, reason: 'Provisional substantive Jules APPROVE on exact live PR HEAD',
    session_id: sessionId, comment_id: comment.id,
    comment_url: comment.html_url, comment_updated_at: comment.updated_at,
    body_sha256: sha256(comment.body), body: comment.body,
  };
}

export function sameReviewerWorkflow(head, main) {
  return !!head && !!main && SHA.test(head.sha || '') &&
    head.sha === main.sha &&
    head.path === '.github/workflows/jules-pr-review.yml' &&
    main.path === head.path;
}

export function auditMarkdown({ run, prNumber, decision, artifactUrl, capture }) {
  const sources = capture?.sources || (
    typeof decision?.body === 'string' ? [{
      body: decision.body, body_sha256: sha256(decision.body),
      comment_id: decision.comment_id, matches_session: true,
    }] : []);
  const escaped = text => clean(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const result = [
    '## Jules review — append-only evidence capture (Stage A)',
    '',
    '**Non-authoritative capture.** This does NOT attest Jules identity, grant merge approval,',
    'override a BLOCK, or promise immutable/WORM retention.',
    '',
    '- PR: #' + prNumber,
    '- Reviewer HEAD: ' + (run?.head_sha || 'unavailable'),
    '- Reviewer run: ' + (run?.html_url || 'unavailable') +
      ' (attempt ' + (run?.run_attempt ?? 'unknown') + ')',
    '- Capture time: ' + (capture?.captured_at || 'unavailable'),
    '- Provisional assessment: ' + (decision?.approved ? 'eligible (not final)' : 'NOT APPROVED'),
    '- Assessment reason: ' + (decision?.reason || 'unavailable'),
    '- Reviewer log SHA-256: ' + (capture?.log_sha256 || 'unavailable'),
    '- Reviewer session: ' + (capture?.session_id || decision?.session_id || 'unavailable'),
    '- Captured JSON in workflow artifact: ' + artifactUrl,
    '- Evidence limitations: mutable comments, shared bot, log retention and missing independent authentication',
  ];
  for (const [i, source] of sources.entries()) {
    result.push('', '### Source ' + (i + 1),
      '- Original comment ID: ' + (source.comment_id ?? 'unknown'),
      '- Original UTF-8 body SHA-256: ' + (source.body_sha256 || 'unavailable'),
      '- Source session matches run: ' + Boolean(source.matches_session),
      '- Last edit: ' + (source.updated_at || 'unknown'),
      '', '<details><summary>Captured review-body preimage</summary>', '',
      escaped(source.body) || '(original text unavailable; do not reconstruct)', '',
      '</details>');
  }
  if (sources.length === 0) result.push('', '**No reviewer body available.** Historic overwritten content cannot be recovered from the current comment.');
  return result.join('\n');
}
