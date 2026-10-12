import { createHash } from 'node:crypto';

export const CONTEXT = 'jules/verdict-gate';
export const MARKER = '<!-- jules-pr-reviewer -->';
const SHA = /^[a-f0-9]{40}$/;
const failure = (reason) => ({ approved: false, reason });

export function sha256(body) {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

// Only GitHub API objects and action logs are inputs. PR prose is NEVER executable policy.
export function assessEvidence({ repo, run, pr, jobs, log, comments }) {
  if (!run || run.event !== 'pull_request' ||
      run.path !== '.github/workflows/jules-pr-review.yml' ||
      run.repository?.full_name !== repo ||
      run.head_repository?.full_name !== repo ||
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
  if (typeof log !== 'string' || log.length > 2_000_000) {
    return failure('Missing or oversized reviewer log');
  }
  const sessions = [...log.matchAll(/^[^\n]*\bJules session: (\d+)\s*$/gm)];
  const finals = [...log.matchAll(/^[^\n]*\bGot final review with VERDICT line on attempt \d+\.\s*$/gm)];
  const summaries = [...log.matchAll(/^[^\n]*\bVerdict: (approve|comment|block)\. Status check: (success|failure|error)\.\s*$/gm)];
  if (sessions.length !== 1 || finals.length !== 1 || summaries.length !== 1 ||
      /Timed out waiting for a message containing a VERDICT line/i.test(log)) {
    return failure('Missing or ambiguous terminal Jules review evidence');
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
    c.body.length <= 60_000);
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
      changed < started || changed > finished + 120_000) {
    return failure('Comment edit is not attributable to this workflow interval');
  }
  return {
    approved: true, reason: 'Substantive Jules APPROVE on exact live PR HEAD',
    session_id: sessionId, comment_id: comment.id,
    comment_url: comment.html_url, comment_updated_at: comment.updated_at,
    body_sha256: sha256(comment.body), body: comment.body,
  };
}

export function auditMarkdown({ run, prNumber, decision, artifactUrl }) {
  // This audit has NO literal upstream comment marker, even inside the escaped body:
  // the third-party upsert matches marker text anywhere in a comment.
  const body = typeof decision.body === 'string' ? decision.body : '';
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return [
    '## Jules verdict gate — append-only attempt audit',
    '',
    'This is a NEW record; not a Jules review, approval override, or PM exception.',
    '',
    '- PR: #' + prNumber,
    '- Reviewer run: ' + run.html_url + ' (attempt ' + run.run_attempt + ')',
    '- Reviewer HEAD: ' + run.head_sha,
    '- Gate disposition: **' + (decision.approved ? 'APPROVE' : 'NOT APPROVED') + '**',
    '- Reason: ' + decision.reason,
    '- Session: ' + (decision.session_id || 'unavailable'),
    '- Source comment ID: ' + (decision.comment_id || 'unavailable'),
    '- Captured UTF-8 body SHA-256: ' + (decision.body_sha256 || 'unavailable'),
    '- Run artifact: ' + artifactUrl,
    '',
    '<details><summary>Captured reviewer text (HTML escaped to protect review marker)</summary>',
    '',
    escaped || '(no attributable final reviewer body)',
    '',
    '</details>',
    '',
    'Historical BLOCK/COMMENT/timeout stays non-approval even if the source bot comment is later overwritten.',
  ].join('\n');
}

export function sameReviewerWorkflow(head, main) {
  return !!head && !!main && SHA.test(head.sha || '') &&
    head.sha === main.sha &&
    head.path === '.github/workflows/jules-pr-review.yml' &&
    main.path === head.path;
}
