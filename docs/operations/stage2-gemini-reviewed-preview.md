# Stage 2 Gemini — reviewed-evidence Preview operator acceptance

**Status: DRAFT, no Production release authorization.** Stacked on PR #137 and linked to Issue #138. The previous `/api/ai-preview` synthetic smoke route remains unchanged.

## Enable on a protected, isolated Vercel Preview only

1. Ensure Vercel project root is `apps/web`, Preview Deployment Protection is enforced, and the Preview URL resolves the **exact Stage 2 commit**, not the public demo project/alias.
2. Keep the existing **Preview-scoped only** `AI_PREVIEW_ENABLED=on`, `AI_PREVIEW_TOKEN` (at least 32 characters), `GEMINI_API_KEY`, and `GEMINI_MODEL=gemini-3.5-flash-lite` or `gemini-2.5-flash-lite`. Never use a `VITE_` prefix for either secret. The Stage 2 API adds **`AI_GUIDANCE_ENABLED=on` (Preview only)**.
3. Set **`VITE_GEMINI_STAGE2_PREVIEW=on` (Preview only)** to compile the additional UI into that deployment. Without it, the existing manual handoff interface is unchanged. Never set these flags in Production or the public demo.
4. Redeploy a new immutable Preview at the exact feature HEAD; confirm `GET /api/ai-guidance` without bearer returns 401, and `POST` with operator bearer fails closed for invalid selections. `POST /api/ai-preview` should still return its original synthetic-only validated output with an empty body and the existing operator bearer token.
5. Open `/brief` on that protected Preview, select reviewed MEPS and WV indicators, open **Analyze with AI**, regenerate the frozen preview, paste the operator's secret into the ephemeral password box, affirm explicit consent and choose **Analyze with Gemini**. The token stays only in React component memory and is not saved, emailed, embedded into links, exported or logged by application code.
6. Observe two same-origin requests: `prepare` returns a short-lived signed digest of versioned selections; `analyze` uses the same selection and signed challenge. Only the second calls Gemini. Compare all reported numbers with the reviewed source artifacts and check pending-only requests, mandatory warnings and `insufficient_evidence` for interventions.
7. Change the local indicator selection, selected national records, scenario or data requests while the dialog is open: the prior Gemini output must disappear and any in-flight fetch is aborted; a new **Regenerate preview** and explicit consent are required.
8. Verify `npm ci --no-audit --no-fund`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`; inspect branch-specific GitHub CI and protected deployment logs. Check `GET /api/ai-guidance` in Production resolves 404 (only after authorization to test; do not redeploy Production).

## Fixed scientific and trust boundaries

- The single Vercel function embeds byte-exact reviewed artifact copies verified on every cold start against SHA-256 pins from the approved MEPS and WV review manifests. CI checks those pins against the original repository artifacts and checks canonical `planning-guidance` source parity. No runtime local TypeScript imports.
- Browser input may contain **only** the current national/local release IDs, allowlisted estimate/indicator IDs and generated-at timestamp. No numeric overrides, free text, raw Brief payload, result calculations, source promotions or narrative/hint admission. The UI deliberately excludes analyst-authored requests, scenario calculations and the optional question. Requests offered here are **two application-owned exploratory templates**, never claimed to be the actual analyst's selected Brief requests.
- Gemini sees only `projectEgress` IDs/context; it cannot compute, revise or sign source values. `assertCandidate` + `bindCandidate` + `assertOutput` validate the returned object. App supplies source numbers, native units, intervals, hashes and warnings. No local Long COVID estimation, causal attribution, ROI, clinical advice or effect claims.
- Short-lived signed challenges are bound to the exact selected ID set and artifact versions. They **are not a durable, single-use anti-replay guarantee across Vercel instances**. In-memory attempt counters are only a secondary abuse guard, **not durable distributed budget enforcement**. Preview protection, independent operator token, explicit feature flags, vendor quotas/spend alerts and controlled key scope remain required. Do not enable this feature on public production, even if a preview smoke test passes.
- No server-side persistence of analyst drafts, no source or Brief mutation, no patient-level data and no externally admitted intervention claims.
- An operator must confirm the Preview protection/auth behavior and live deployed Gemini inference. GitHub CI is insufficient proof of effective Vercel function packaging.

## Owner acceptance and remaining gates

- **Engineering:** exact-commit tests, source checksums, typecheck/lint/unit/build/browser regression all green; Jules may review this PR independently.
- **Scientific:** review actual supported selection numbers and intervals, disclaimers, pending draft requests and the inability to evaluate scenarios or analyst-authored requests.
- **Security:** confirm fail-closed unauthenticated/Production routes, CSP same-origin `connect-src`, no keys in JS/HTML/headers/response errors/logs and protected Preview status. Validate real Gemini latency/provider errors in the Vercel function logs without prompt logging.
- **Operational:** set durable quota or server-side rate protection before considering expanded access. A durable challenge replay cache and validated deterministic scenario/data-request server registry are future work.
- **Release:** do **not** merge Stage 2 or PR #137 or promote to Production without a separate owner release decision.
