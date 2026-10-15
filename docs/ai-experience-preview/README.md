# Future AI Experience Preview — product specification (documentation only)

**Status:** design/handoff only. **No implementation, live AI, source admission, model-provider egress, or release approval.**
**Target:** optional **October 22, 2026** concept demonstration; keep the **October 15 Phase 2** submitted artifact unchanged.
**Baseline for this specification:** `main@5cc772a198f86a92866bf14cb4ad545ff583200e`.
**Related work:** [#68](https://github.com/Ianyliu/diagnostic-odyssey/issues/68) (AI governance), [#26](https://github.com/Ianyliu/diagnostic-odyssey/issues/26) (narrative literature), [#23](https://github.com/Ianyliu/diagnostic-odyssey/issues/23) (acquisition hints), [PR #105](https://github.com/Ianyliu/diagnostic-odyssey/pull/105) (real deterministic preview), [#100](https://github.com/Ianyliu/diagnostic-odyssey/issues/100) (release gates).

## Decision: two experiences, no deception

Keep the **current deterministic Planning Insights preview** (PR #105) as the real, evidence-grounded feature. Separately prototype a **Future AI Experience** as an **explicitly illustrative, guided concept**. It is not an AI-generated result, live AI conversation, literature retrieval, scientific recommendation, or approved model deployment.

- **REAL / CURRENT:** current validated Brief, reviewed burden findings, explicitly selected local context, deterministic Pilot quantities, review-gated references, existing Data Requests. Only existing trusted producers may populate these fields.
- **CONCEPT / ILLUSTRATIVE:** visualization and interaction concepts explaining what a *future* approved synthesis engine **could** produce. Its example intervention categories, hypothetical planning questions, trade-off layouts, and research workflow descriptions must not be represented as reviewed evidence.
- **FUTURE / GATED:** actual research retrieval, source evaluation, text generation, applicability assessments, AI-proposed actions, and provider calls require the separate #68/#26/#23 admission and architecture approvals. A user selecting a concept option grants none of those permissions.

**Never blend these lanes visually or in JSON/print.** Prominent persistent banner: **"Future AI experience — interactive concept, not live AI or verified recommendations."** Every illustrative card has an unambiguous **"Illustrative / not source-verified"** label and no fabricated effect size, country-specific achievement, study author, DOI, or citation.

This specification intentionally does not supersede existing issue #68's conservative Final-demo constraints. If the owner/independent reviewer concludes even an isolated concept demo is outside Final scope, keep the entire feature branch-only; do not ship or surface it publicly.

## Job to be done

Stakeholders should understand the **intended product**: move from a validated Planning Brief to comprehensible evidence synthesis, targeted literature investigation, defensible gaps, and structured next-step comparisons. Unlike PR #105's factual summary, the concept should demonstrate differentiated, visually compelling **analysis workflows** without feigning that research or model inference happened.

## Proposed information architecture

Entry point in a **demo-only build** from the Planning Brief's real insights block ("Explore future AI concept") and, optionally, a concept label near Evidence. Avoid new default production navigation. A standalone, accessible route such as `/concept/future-ai` is acceptable *only when the build flag is on*. Otherwise the route redirects to the existing product without rendering any concept fixture.

A four-goal selector drives distinct presentation states:

| Goal | Distinct concept experience | What must be explicit |
| --- | --- | --- |
| **Explain my Brief** | Visual executive story with **verified current-brief values only** when available: 2–3 referenced highlights, explicit national/local distinction, assumptions/result separation, evidence boundaries; separate static example text explains what conversational AI might add. | Values from validated Brief, not generated. No invented commentary or unvalidated inferences. |
| **Explore interventions** | Illustrative evidence-review pipeline and rich, *unpopulated* study cards: intervention category, setting/population dimensions, study design/evidence type, outcomes, applicability and limitations, exact-source status, contextual transferability. | **No actual studies, countries, effect sizes or citations** until independently reviewed. Concept cards are research targets/questions, not recommendations. |
| **Identify data gaps** | Visual dependency map from a selected hypothetical decision to an illustrative list of information needs and the existing **trusted** request workflow. Contrasts unknown versus missing versus unselected evidence. | Concept gaps ≠ verified local deficiencies. No drafts accepted into analyst state or Brief. |
| **Compare strategies** | Parallel qualitative strategy cards (e.g., care navigation, provider education, remote coordination) with mechanism, implementation questions, **"evidence not assessed"** indicators, unknown costs/effects, transferability checklist, and decision-criteria comparison. | This is a comparison **framework**, not a ranking or an effectiveness conclusion. Do not invent winners, savings, causal arrows, scorecards or effect percentages. |

Design for accessible data-rich UI, not chat bubbles or plain text dumps. Consider: evidence-role bands, expandable study provenance, an applicability mismatch matrix with "not evaluated" states, a question-to-data map, comparison columns, and a "what would be verified" checklist. Use native disclosure/semantic tables for nonvisual equivalents. Maintain present design tokens and responsive light/dark/reduced-motion behavior.

### Screen structure

1. **Concept identity:** persistent concept-state label, one-sentence purpose, no fake "typing"/"researching" animations or model identity.
2. **Goal selector:** four controls with distinct result layouts; keyboard and screen-reader state support.
3. **Optional context strip:** show which parts came from *real reviewed current Brief* (only if validated) and which are conceptual. Use precise source/artifact IDs for real fields.
4. **Output canvas:** cards/graphs/table change visibly between goals. Expand to inspect evidence requirements, transferability dimensions, limitations, and missing sources.
5. **Action boundary:** explain what the proposed next step would be and link to an existing real Pilot / Evidence / Data Requests route. **No state write**, acceptance, hidden side effects, export, API requests or generation calls.
6. **What is missing to activate live AI:** admission of source literature, accountable reviewer, validated output schema, provider/security/privacy approval, and human dispositions.

## Content constraints and defensible examples

- The fixture may name **generic intervention categories** only, as research topics, not as supported solutions.
- Suggested visual study cards must show **"Source: not reviewed"**, **"Effectiveness: not established"**, **"Applicability: not evaluated"**. Their source URLs/DOIs and quantitative outcomes are **null**, never fake plausible values.
- An "international evidence" section can show **geography and health-system transferability fields** as empty review questions, never assert "Country X reduced costs by Y" absent an actual approved source.
- Any real numeric value comes *solely* from PR #105's verified Planning Brief/presentation adapter and carries native unit, denominator, uncertainty, source ID/version, limitations; never copy numeric literals into concept fixtures.
- Preserve the distinctions national ≠ local, gross ≠ attributable, Typical Range ≠ CI, program resource ≠ savings/ROI, descriptive data ≠ causal effect. Candidate A and all unreleased/suppressed records are excluded.
- Do **not** describe the static interaction as "AI generated", "live analysis", "evidence-backed option", "searched literature", or "AI found a gap".
- Do not impersonate a real medical reviewer or create simulated approved research.

## Implementation sequencing (recommended after the independent PR #105 decision)

1. **Foundation (Codex atomic commit A):** introduce a **demo-only** gated route and typed view model / local explicit-illustrative fixtures. Prefer a build flag `VITE_FUTURE_AI_EXPERIENCE_DEMO=on` default **off**; no provider/API/secret dependencies. Avoid modifying #105 until the concurrent print fix is resolved.
2. **UX (Codex atomic commit B):** four selectable goal-specific views and visual components, responsive accessible styles, source/illustrative labels, real current-Brief adapter reuse with strict guards, no new scientific arithmetic.
3. **Proof (Codex atomic commit C):** tests for default-off invisibility, goal-switching, screen reader/keyboard, mobile light/dark, reduced motion, no network/provider calls, no research/citation inventions, no state mutation, and source-aware output. Inspect actual rendered screenshots.
4. **Documentation (Codex atomic commit D):** production/demo screenshots and a short owner-facing comparison: what is currently real vs concept-only vs future governed AI; release gates, rollback and demo script.

Each commit should compile/tests as practical. Do not duplicate existing evidence or Brief models. A prospective real AI provider adapter is **out of scope**. If PR #105 has moved, rebase/cherry-pick safely with exact SHAs and refresh tests. Preserve its original review history.

## Acceptance checklist

- [ ] Goal switching changes substantive **visual content**, not merely headings.
- [ ] Real Brief data (if displayed) comes only from validated, released/current records and links to provenance.
- [ ] Every concept-only research card stays visibly illustrative and source-unverified even when expanded/screenshot.
- [ ] No fake authors, studies, DOI/PMCID, effective interventions, country results, costs, clinical outcomes, or effect sizes.
- [ ] Interventions are **topics to research**, not recommendations or automated treatment/policy decisions.
- [ ] No network egress, LLM calls, patient data, PHI, personal notes, model keys or arbitrary prompt uploads.
- [ ] No changes to `buildPlanningBrief`, scientific contracts, scenario engine, canonical JSON, existing PDF or data-request mutation paths.
- [ ] Public/default build remains demo-free; disabled-route and navigation tests prove this.
- [ ] Responsive, keyboard/axe, reduced-motion and real screenshot verification pass.
- [ ] Final PR is separately reviewed; no merge, static synchronization, Cloudflare deployment or submission without explicit authorization.

## Demonstration language (truthful, confident)

"This is our **future AI experience concept**, showing the kinds of evidence questions, intervention comparisons, and data gaps that a future source-grounded assistant could organize. Today's live system already provides the reviewed burden, transparent Pilot calculations, and analyst-controlled Data Requests. The concept cards are illustrative—not AI-generated research or verified intervention results."

Use no live-model spinner and no invented numerical claims. This demo is deliberately more expressive than PR #105, without misrepresenting feature maturity.
