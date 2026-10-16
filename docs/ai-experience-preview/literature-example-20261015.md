# Future AI concept — source-linked worked literature illustration (2026-10-15)

## Product contract

The Future AI concept remains a **static, hand-authored interactive storyboard**, not a live LLM, automatic literature retrieval, or an approved intervention recommendation. This change populates the previously blank/unassessed literature cards and decision tables with **specific, traceable examples** drawn from four externally published papers checked on October 15, 2026. The goal is to make a future *research-and-appraisal user experience* tangible, while preserving the distinction between research exploration and formally admitted Diagnostic Odyssey evidence.

**No external publication has been admitted to Diagnostic Odyssey's reviewed evidence, narrative, effect-parameter or quantitative model pipelines.** No copy of these records is placed in canonical Brief JSON, national MEPS/WV reviewed artifacts, Pilot scenario outputs, print, acquisition sources or analyst data requests. No API, provider, model, runtime fetch, telemetry or new storage dependency is introduced.

Data files: `apps/web/src/concept/demoLiterature.ts` (static examples), `DemoLiterature.tsx` (source-linked illustrations). The original `prototype-stories.v1.json` remains explicitly design-only, with all its `citation`, `doi`, `source_url`, `effectiveness`, and `cost_savings` fields null to prevent admission through a fixture.

## External publications used in examples

### 1. Mir et al. — access, inclusion and referral workflow

**Paper:** *Addressing Inequalities in Long Covid Healthcare: A Mixed-Methods Study on Building Inclusive Services*. *Health Expectations* (2025).
**DOI:** [10.1111/hex.70336](https://doi.org/10.1111/hex.70336).
**Verified text:** The paper describes referral/diagnosis barriers among disadvantaged populations and reports insufficient pathway records to assess certain referral-equity questions.
**Demo interpretation:** Motivates measuring recognition, referral initiation/completion and denominators. Does *not* provide a causal navigator-intervention effect, US effectiveness or saved-cost estimate.

### 2. van der Feltz-Cornelis et al. — coordination/education context

**Paper:** *Integrated care policy recommendations for complex multisystem long term conditions and long COVID*. *Scientific Reports* (2024).
**DOI:** [10.1038/s41598-024-64060-1](https://doi.org/10.1038/s41598-024-64060-1).
**Verified text:** UK Delphi consensus with 480 patients and professionals identifies multidisciplinary care, primary-specialist communication and integration priorities.
**Demo interpretation:** Motivates workflow and provider-support questions. Consensus **is not** a randomized test of clinician training or care navigation and cannot supply efficacy or ROI.

### 3. McGregor et al. — remote rehabilitation outcome example, not navigation

**Paper:** *Clinical effectiveness of an online supervised group physical and mental health rehabilitation programme for adults with post-covid-19 condition (REGAIN study): multicentre randomised controlled trial*. *BMJ* (2024).
**DOI:** [10.1136/bmj-2023-076506](https://doi.org/10.1136/bmj-2023-076506).
**Correction:** [10.1136/bmj.q988](https://doi.org/10.1136/bmj.q988). This explicitly clarified that conclusions apply to **adults at least three months after hospital discharge** from COVID-19.
**Verified primary-result example:** 585 randomized adults; eight-week online supervised group rehabilitation compared with usual care advice; adjusted PROPr health-related quality-of-life difference at three months of 0.03 (95% CI 0.01–0.05).
**Demo interpretation:** Outcome example for that population and **that rehabilitation intervention**. It does not evaluate remote referral coordination, earlier diagnosis, reduced diagnostic delay, a US population-wide strategy, or attributable cost savings. Do not transfer the 0.03 result to Pilot.

### 4. Curvelo et al. — fragmented services background

**Paper:** *Health care for patients with long COVID: a scoping review*. *Revista da Escola de Enfermagem da USP* (2024).
**DOI:** [10.1590/1980-220X-REEUSP-2024-0056en](https://doi.org/10.1590/1980-220X-REEUSP-2024-0056en).
**Verified text:** Scoping review of 13 articles describing care delivery up to June 2023; flags fragmented, symptom-oriented service practices.
**Demo interpretation:** An evidence-mapping rationale for coordination questions, **not** a quantitative impact evaluation, cost-effectiveness model or comprehensive 2026 systematic evidence search.

## What users now see

- **Explain my Brief:** A safe sample narrative built around the current reviewed Brief *without inventing values*; separately labeled external literature context.
- **Explore interventions:** Three populated, interactive question cards. Their study-profile, applicability and source/limits views show actual titles, designs, example findings, DOI links, applicability barriers and candidate fields. No false estimates for untested strategies.
- **Identify data gaps:** Each of the three existing hypothetical decisions now includes a concrete proposed operational definition, example analyst output and relevant external context.
- **Compare strategies:** Cards and comparison matrix identify the example literature, source-to-strategy mismatch, and reason no winner/cost estimate can be supported. No rankings or quantitative model inputs.

This is **a curated worked example, not a systematic or continuously updated review**. Its external sources were manually located and checked only as of 2026-10-15. The future AI concept banner must remain prominent; explicit no-live-AI notices stay in place.

## Release and verification

Keep this in a **separate draft PR** for independent literature/provenance/science, UX, privacy and accessibility review. Check existing browser assertions that previously expected study citation fields to be empty. Those original design-only fixture fields stay empty, while the new static source-linked panel is deliberately populated. Verify four build-flag combinations and rollback switch behavior, keyboard/screenshots, responsive themes, zero unapproved network calls, and governed JSON/PDF parity.

No Cloudflare/Vercel production or static branch synchronization is authorized by this documentation. Opening a PR can trigger an automatically created, access-controlled Vercel preview depending on repository settings.
