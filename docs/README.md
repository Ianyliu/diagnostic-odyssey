# Diagnostic Odyssey documentation index

## Current product, brand, and engineering documentation

| Document | Scope |
| --- | --- |
| [README](../README.md) | Repository overview, Strategic Atlas summary, quick start, workflow, and guardrails |
| [Design and motion](design-and-motion.md) | Strategic Atlas brand identity, astrolabe assets, light/dark/print tokens, 7-role semantic grammar, typography, layout, and motion contract |
| [Architecture](architecture.md) | Monorepo package boundaries, runtime flow, routing (`01 Burden`–`05 Planning Brief` + `Strategy AI Studio`), and AI/data boundaries |
| [Scientific guardrails](scientific-guardrails.md) | Mandatory burden, local-context, scenario, release, admissibility, and privacy rules |
| [Capability status](capability-status.md) | Production vs Preview-only vs illustrative vs candidate-only vs not implemented, and the AI data/security boundary |
| [Testing and validation strategy](testing.md) | Unit, WCAG contrast, JSON Schema, R synthetic, browser, PDF, and CSP security verification |
| [CI workflows](operations/ci-workflows.md) · [Engineering release checklist](operations/engineering-release-checklist.md) | Workflow matrix, pins, required-check compatibility, local-vs-actual qualification; pre-merge checklist |
| [Architecture decision records](adr/README.md) | Exact-equivalence evidence, TypeScript project split and hermetic tests, self-contained Vercel functions |
| [Contributing](../CONTRIBUTING.md) · [Security](../SECURITY.md) · [Open governance items](governance/open-items.md) | Setup, checks, hard rules; reporting and scope; decisions that need the project owner |
| [Analytical release workflow](analytical-release-workflow.md) | Offline MEPS, HRSA/ACS, Typical Range, and linked-condition candidate → review → promotion workflow |
| [Decision workspace product decisions](decision-workspace-design-decisions.md) | Accepted product rules for county maps, analyst data requests, claim templates, decision traces, and scenario comparison |
| [Implementation plan](implementation-plan.md) | Delivery phases P0–P7 and Edition 01 status |
| [Gemini Preview setup](gemini-preview-setup.md) | Retired `/api/ai-preview` (`404`) and Strategy AI Studio / Preview-only `/api/ai-guidance` overview |
| [Stage 2 Preview operator acceptance](operations/stage2-gemini-reviewed-preview.md) | Operator runbook and security/scientific bounds for Preview-only `/api/ai-guidance` |
| [Source revision and build provenance](build-source-provenance.md) & [Public source-revision stamp](operations/build-provenance.md) | Build-time `__DO_BUILD_PROVENANCE__` rules and `VITE_SOURCE_SHA` / `VITE_BUILD_DATE` guarantees |
| [Workstream K security headers](security/workstream-k.md) | Strict CSP in `apps/web/vercel.json`, `/theme-init.js`, and enforcement testing |
| [MEPS 2024 Long COVID methods](methods/meps-2024-long-covid.md) & [Typical Range Phase A](methods/typical-range-phase-a.md) | Survey-aware MEPS estimation and distribution summary methods |
| Linked-condition methods (`methods/meps-2024-linked-condition-*.md`) | [Contract](methods/meps-2024-linked-condition-candidate-contract.md), [Implementation](methods/meps-2024-linked-condition-candidate-implementation.md), [Feasibility](methods/meps-2024-linked-condition-feasibility.md), [Feasibility review](methods/meps-2024-linked-condition-feasibility-review.md), [Product policy](methods/meps-2024-linked-condition-product-policy.md), [Governance](methods/meps-2024-linked-condition-reliability-governance.md) |

## Historical design experiments, audits, and PR archives

These records document specific past branches, QA passes, and governance packets and are preserved unchanged for provenance:

- **Design experiments:** [Strategic Atlas consolidation handoff](design-experiments/strategic-atlas-consolidation-20261123.md) (merged in PR #150), [Lovable visual-language experiment](design-experiments/lovable-visual-language-20261111.md)
- **Audits:** [November 25, 2026 engineering maintenance audit](audit-2026-11-25/README.md), [October 16, 2026 audit](audit-2026-10-16/README.md), [October 10, 2026 QA matrix](audit-2026-10-10/qa-matrix.md) & [visual review](audit-2026-10-10/visual-review.md)
- **Guided workspace & planning-to-action:** [Guided workspace plan](guided-workspace/implementation-plan.md), [screenshots](guided-workspace/screenshots.md), [verification](guided-workspace/verification.md), [Planning-to-action handoff](planning-to-action-2026-10-25.md)
- **Planning intelligence & AI handoff history:** [Planning Insights](planning-insights/README.md), [Unified Planning Intelligence handoff](planning-intelligence-integration/MUSE_HANDOFF.md), [AI Handoff PR A](ai-handoff/README.md), [Future AI concept spec](ai-experience-preview/README.md)
- **Acquisition hints & maintenance records:** [Acquisition hints review](acquisition-hints-2026-10-11/README.md), [Maintenance audit report](maintenance-audit-report.md), [Dependencies](maintenance-dependencies.md), [Regression](maintenance-regression.md), [Security](maintenance-security.md)
