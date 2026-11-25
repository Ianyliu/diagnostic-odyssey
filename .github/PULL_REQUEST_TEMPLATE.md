## Summary

<!-- What changed and why. Link issues. Keep it factual. -->

## Verification

- [ ] `npm run check` passes locally (or explain which part could not run)
- [ ] Extra commands that apply to this change (browser suites, `scripts/verify/vercel-function-build.sh`, `npm run check:full`) were run, or are listed as not run
- [ ] Results and any failures are pasted below, not summarized away

## Scientific and security guardrails

- [ ] No scientific output, validator verdict, export content or suppression behavior changed
  **or** the change is intentional, isolated in its own commit, and justified here
- [ ] Characterization goldens were **not** regenerated to make tests pass
- [ ] `artifacts/reviewed/**` and historical audit records are untouched
- [ ] Missing / suppressed / unreleased values are never treated as zero; assumptions are never presented as observed effects
- [ ] No secrets, raw microdata, local paths or generated candidates are committed
- [ ] `apps/web/api` files remain self-contained and no new public endpoint was added

## CI / dependencies

- [ ] Workflow changes keep job ids/names stable (required checks) and were checked with actionlint
- [ ] New or changed external actions are pinned to a full commit SHA with the release recorded in a comment
- [ ] No unrelated dependency upgrades

## Notes for reviewers

<!-- Risks, follow-ups, deferred work. -->
