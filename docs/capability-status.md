# Capability status

What is production, Preview-only, illustrative/experimental, candidate-only, or only proposed. This page summarizes the
README and the guardrails; where they differ, the README and [scientific guardrails](scientific-guardrails.md) win. Nothing here
claims clinical validation, regulatory compliance or production-readiness beyond what the repository's own checks establish.

| Status | Capability | Boundary |
| --- | --- | --- |
| **Production (public builds)** | `01 Burden`: reviewed national 2024 MEPS HC-256 Long COVID artifact (21 reviewed estimates, 2 descriptive Typical Ranges) | Gross all-cause burden, not attributable cost; Work & Function is explicitly missing |
| Production | `02 Local context`: 34 reviewed **state-level** West Virginia HRSA + ACS indicators | No county-level data; never rescales national burden |
| Production | `03 Strategy Lab`: presets, eight assumptions, deterministic comparison, one-way sensitivity, capacity curve | Arithmetic on analyst assumptions; not forecasts, savings or ROI |
| Production | `04 Data requests` and `05 Planning Brief` with canonical JSON export and print/PDF | Only reviewed, released estimates are exportable |
| Production (no provider calls) | Deterministic *Planning Insights*; *Prompt Studio / Analyze with AI* (user-operated copy/paste handoff) | Public builds contain no AI inference and consume no tokens |
| **Illustrative / experimental** | *Strategy AI Studio* illustrative exploration (`/advisor`, `/concept/future-ai`) | Unadmitted content; can be switched off with `VITE_FUTURE_AI_EXPERIENCE_DEMO=off` |
| **Preview-only** | `POST /api/ai-guidance` reviewed-guidance lane | Only in authenticated `VERCEL_ENV=preview` with explicit operator credentials; `404` in public production |
| Retired | `/api/ai-preview` | Permanently `404` |
| **Candidate-only (not runtime)** | Offline MEPS and local-context candidate generation; linked-condition candidate/feasibility | Produces preliminary aggregate artifacts for review; promotion is a separate, reviewed step ([release workflow](analytical-release-workflow.md)) |
| **Not implemented** | County-level context, PLACES/CMS ingestion, reviewed literature ledger and evidence-backed effect parameters, ME/CFS estimates, tagged accessible PDFs, live public AI inference | Listed under "What is intentionally incomplete" in the [README](../README.md#what-is-intentionally-incomplete) |
| **Future proposals** | Future analytical modules, additional data integrations, AI-assisted exploration | Intentionally **not** started by the maintenance campaign; no speculative abstractions were added for them |

## AI data and security boundary

- Public builds: no provider calls, API keys or embedded inference.
- Prompt Studio prepares text locally; the user decides whether to paste it anywhere.
- The Preview-only endpoint sends a provider only identifiers, codes and a snapshot fingerprint (`ModelEgressV1`), validates the
  provider's answer against that snapshot, and never returns secrets. Its behavior is pinned by 387 characterization cases.
- AI output never sets scenario parameters, admits evidence, or changes export eligibility.

Details: [Gemini Preview setup](gemini-preview-setup.md), [Stage 2 operator acceptance](operations/stage2-gemini-reviewed-preview.md),
[ADR 0003](adr/0003-vercel-api-functions-stay-self-contained.md), and [SECURITY.md](../SECURITY.md).
