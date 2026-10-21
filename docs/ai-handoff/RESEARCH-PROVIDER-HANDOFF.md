# Guided research and safe provider launch — draft

## Why and what changes

This enhancement extends the existing complete, source-drift-gated Analyze with AI v1 handoff without touching the canonical Planning Brief or its release rules.

- Optional downstream tasks: literature review, investigational interventions, and provenance-linked visualizations. Literature + interventions are enabled by default; visuals can be enabled by users.
- Additional instructions appear AFTER the entire delimited, untrusted JSON envelope. They require real literature retrieval or an explicit "No sources retrieved" statement; external studies are never silently promoted to reviewed effect evidence.
- Explicit "Copy & open ChatGPT / Claude / Gemini / Copilot" actions initiate clipboard copying and an HTTPS provider home page launch in the same gesture. Prompt, optional question and scenario never appear in URL parameters.
- Fixed-topic PubMed and ClinicalTrials.gov links contain no user-specific data and provide independent, unreviewed literature discovery.
- Build-time VITE_AI_PROVIDERS is a comma-separated allowlist, e.g. chatgpt,claude; empty disables every launch button while retaining manual Copy/Download.

The existing six goals, v1 canonical envelope/template, full source JSON, scientific checks, frozen preview, stale-source latch, clipboard fallback, optional-question limits and Markdown export remain unchanged. The additive task layer uses research template identifier 2026-10-research-v1. It does not shorten or rewrite records, recompute scenario results, access APIs, persist handoffs or automatically submit information.

## Privacy, security and product boundaries

Review before sharing remains essential. Opening a provider home page is not data transfer, but pasting or uploading the full prompt transfers it under the provider's privacy policy. Provider URL behavior is intentionally NOT dependent on undocumented query-string prefill. The popup may be blocked, and noopener can return null even on successful opening; the interface provides a fallback manual link. Clipboard errors retain full-text manual selection and download.

The user-provided proposals for a compact digest, AI package, automated answer checker and authenticated integrations deserve separate phases. An apparently grounded number is not proof of correct source attribution, and a syntactically valid DOI is not evidence that an AI verified a paper. A lossy digest must prove numerical/denominator parity and explicit omissions before it can replace full-canonical transfer.

Future model/API connectors require a separately approved data egress allowlist, user consent, server-side credential handling, cost and rate controls, retention and security assessment, provenance validation, versioned outputs, and an explicit review barrier preventing model proposals from changing reviewed evidence or deterministic scenarios. No live API feature is in this PR.

## Acceptance / release gate

All changes are on an isolated branch and proposed as a draft PR. Opening that PR may produce an automatic Vercel preview through the existing GitHub integration; it is NOT a request to promote or deploy production.

PM should resolve the existing AI provider-launch prohibition in the handoff design record before approving a merge. Require independent scientific, privacy/security, accessibility and product review of the exact PR HEAD. Validate browser user gesture behavior on Safari, Firefox and Chromium, CSP, keyboard use and screen-reader status. The app should work unchanged if all providers are disabled or external sites are unavailable.

Never infer that unit-test or CI success establishes scientific verification, provider compliance, or release authorization.
