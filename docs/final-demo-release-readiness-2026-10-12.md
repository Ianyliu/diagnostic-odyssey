# Issue #100 — Final demo/release acceptance and rollback runbook

**Snapshot:** 2026-10-12. **Scope:** documentation/read-only QA only. **Status:** provisional **NO-GO for public release**; preparation may proceed. This is not a certification or PM approval. Re-evaluate all SHAs immediately before the final gate.

## Observed identities and limitations

| Surface | Pinned observation |
| --- | --- |
| GitHub main | `17fe339c01d749bff4922d41318c85055e137149` (Oct 11 merge of #97) |
| Open corrective PR #99 | `4b56b381f05ed43ffb7e838cf8ed954d8eddba8c` at audit; moved from originally documented `fc4e37995eb0d146706e9c80464ed587efb92286` |
| Historical comparison PR #94 | `a77e2ff03971c32e3f268408e41061d6b9e9f9ad`, draft against pinned `b99d1c703226009f2004a06a332174124fbfd8a3`; not an integration candidate |
| Cloudflare Pages project/domain | `diagnostic-odyssey` / `diagnostic-odyssey.pages.dev` |
| Configured production branch | `demo/deploy-ready-2026-10-06-b99d1c70` (NOT main) |
| GitHub head of configured static branch | `29aca3f095e7b1033b498c451841eaceb2b0c759` |
| Earlier unconfigured static branch | `demo/deploy-ready-2026-10-11-e27403a` at `93772504080a47dfc772f78422bd5329f1343639`; not the production branch |
| Newer unconfigured static branch (Oct 12) | `demo/deploy-ready-2026-10-12-17fe339` at `a400ddd10a0d1e2e3b4ac1d974a498ccad4af2cb`; README claims source main `17fe339c01d749bff4922d41318c85055e137149`, built with **`npm install` + `npm run build`**, with self-reported tests. Branch root contains `README.md`, `assets/`, `index.html` and logos, but no `build-provenance.json`; these are **claims, not independently proven reproducibility or deployed-byte parity**. Do not treat `npm install` as a lockfile-frozen `npm ci` build. |

| Latest successful Cloudflare production deployment (Oct 12) | `b296771d-5e5b-46cb-9cd5-89efa9a8c270` at `2026-10-12T11:12:30.591872Z`, success at `2026-10-12T11:12:32.868883Z`, immutable URL `https://b296771d.diagnostic-odyssey.pages.dev` |
| Previous successful production deployment (Oct 11; historical, **not known-good**) | `086af799-c1bc-4522-8add-ea7cfc98e5aa` at `2026-10-11T11:09:42.65022Z`; historical only; no byte-parity proof |
| Latest Cloudflare deployment trigger | `ad_hoc`, configured `demo/deploy-ready-2026-10-06-b99d1c70` branch, **empty `commit_hash` and `commit_message`**, no build command/destination in deployment metadata; deployment success does not identify uploaded bytes |
| Earlier Cloudflare production deployment (Oct 10; historical, **not known-good**) | `171fdf6b-839c-4852-9449-6a5aba6516bc` reports `6a216270094519b45421db91a6eb80e7b6c07ee5`, **not proof for Oct 11 or Oct 12 uploads** |
| Static branch `build-provenance.json` | Claims `source_main_sha=e27403af8d878327d28ead2b6f7aeb00657c5239`, Node `v22.23.3`, `npm ci --offline --no-audit --no-fund`, and `npm run build`. This claims static-branch bundle origin, not verified deployed bytes. |
| Static branch `index.html` | JS `/assets/index-DzXhtyp7.js`; CSS `/assets/index-D24PT-ZR.css` |

Source: read-only GitHub branch/content/PR endpoints and connected Cloudflare Pages project/deployment API on Oct 12. Cloudflare Browser Rendering returned HTTP API success and rendered the production `/` HTML with application navigation. Additional browser-rendering route checks hit Cloudflare API rate limit 2001; container direct DNS requests failed. **Deep-link SPA fallback, precise served asset hashes, served provenance JSON, and parity to main remain UNVERIFIED**, not PASS. The configured static branch provenance is behind main, and neither the Oct 11 nor Oct 12 static branch's build claims can establish uploaded bytes. **Oct 12 latest Cloudflare deployment, Oct 11 historical deployment, and all static branches remain separate identities.**


## Authoritative TOPx milestone check — do not conflate submission and demo

**Official NIH TOPx HHS Tech Sprint instructions**, accessed 2026-10-12: https://www.nih.gov/challenges/topx-hhs-tech-sprint-ai-invisible-illness (see **Timeline → TOPx Sprint (Phase 2)** and **How to Enter**). The official NIH Challenges index separately labels Phase 2 as open until October 15: https://www.nih.gov/challenges.

| Gate | Official published deadline | What this does and does not establish |
| --- | --- | --- |
| Phase 2 TOPx Sprint submission-period close | **October 15, 2026 at 11:59 PM ET** | An actionable, separate submission deadline; do **not** defer the Phase 2 submission because there is an October 22 showcase. |
| Final Live MVP Demo Showcase submission-period close | **October 22, 2026 at 11:59 PM ET** | Distinct showcase submission milestone; does not extend or replace the October 15 Phase 2 deadline. The published cutoff alone does not establish a specific live presentation appointment. |

NIH explicitly states **HHS may revise, extend or adjust milestone dates**. The accessible official page says Phase 2 entries follow the Challenge-platform instructions at https://invisibleillness.crowdicity.com/ and gives high-level MVP demonstration requirements, but this read-only audit **could not independently verify current authenticated team-specific portal prompts, exact upload fields/formats, access rights, receipt/lock rules, or any updated organizer notice**. Mark those details **UNRESOLVED**; reconcile with the authenticated Challenge portal and any direct organizer instructions, document evidence and acceptance/receipt before October 15. The new unconfigured static branch README independently repeats October 15, but a developer-authored README is **not** the authority.

**Separate, PM-controlled milestones:** approval of the #103 documentation PR for merge; #99 integration and Gate 0 PASS; source/scientific/privacy admission; an exact-byte **release-candidate approval**; authorized Cloudflare deployment/static synchronization; **October 15 Phase 2 entry submission**; and **October 22 Final Live MVP Demo Showcase submission**. Completing any one does not imply the others are complete. No submission or external action is authorized by this document.

## Independent parity proof (run before GO)

1. Freeze release-candidate main SHA and Git tree; record UTC, lockfile SHA256, source artifact IDs, validated review manifests, release/admission config, and build environment. Use `npm ci` and `npm run build` in clean Node 22 environment; compute SHA256 of every `apps/web/dist` file and canonical sorted manifest.
2. Fetch exact live `/`, `/burden`, `/burden/medical`, `/burden/work`, `/burden/admin`, `/burden/human`, `/local-context`, `/pilot`, `/evidence`, `/data-requests`, `/brief` by direct navigation (fresh session) and reload; record status, MIME, effective URL, page heading, JS errors, asset network failures, and application bootstrap. Unknown paths may redirect to root; known routes must not show blank page or 404.
3. Fetch `/index.html`, hashed JS/CSS assets, `/build-provenance.json` (if exposed), and reviewed artifacts as served. Record HTTP response hashes and compare against frozen build manifest **byte by byte**. Confirm no cache served an older bundle. Do not interpret missing provenance or differing deterministic bundler hashes as parity.
4. Reconcile Cloudflare project production_branch, deployment ID, trigger/hash, immutable deployment URL, origin branch SHA, and the exact upload manifest. With ad-hoc upload and blank commit hash, an explicit asset-level attestation or matching checksums is required.
5. Repeat relevant QA at the **actual served approved artifact**, not only in Vite Preview. Record outputs and label untested browser/platform combinations.

## Release acceptance matrix — fail closed

| ID | Gate / falsifiable acceptance | Required proof | Owner | Status |
| --- | --- | --- | --- | --- |
| R01 | Frozen main/lockfile/artifact/allowlist identity; clean reproducible build; published SHA256 manifest | commit/tree/manifest + full clean build log | Release engineer | PENDING |
| R02 | Cloudflare configured production branch, immutable deployment ID, uploaded byte hashes match approved candidate exactly | API snapshot, GET hash manifest, compare report | Release engineer + independent reviewer | **BLOCKED: identity not proved** |
| R03 | All 11 actual deep links above load on cold/reload and unknown path handled; no console/network errors | per-route HTTP, DOM, screenshots, console/network table | Browser QA | PENDING |
| R04 | 390 / 768 / 1440px; light/dark/system (both OS modes); normal/reduced motion, overflow and content fidelity | screenshot matrix and measured document/client widths | Browser QA | PENDING |
| R05 | Keyboard-only tab/shift-tab, focus, disclosures, labels, names, accessible status announcements; zero serious/critical axe violations; contrast >= WCAG AA | rendered Playwright/axe output; manual VoiceOver/NVDA separately reported | Accessibility QA | PENDING, coordinate #99 |
| R06 | Reviewed 21 national MEPS measures and reviewed 34 WV indicators present, native units/provenance intact; local context does NOT rescale national burden | source IDs + full reviewed hashes + before/after numerical snapshots | Scientific QA | PENDING |
| R07 | Sensitivity is one-way, deterministic; reach/capacity/timing/resources obey bounds; invalid/NaN/infinite/zero/subnormal inputs handled without misstatement | arithmetic fixtures, rejection matrix, sensitivity tables | Scientific QA | PENDING |
| R08 | Request opt-in only; stale/switch/refresh exclusion; canonical real JSON export; no illustrative/suppressed/unreleased findings | browser e2e request/output snapshots and JSON schema checks | Export QA | PENDING |
| R09 | Real multipage PDF/browser-print output, 21 interpretations/decision entries intact, no clipping, correct figures, no unsupported evidence | generated PDFs, page-by-page render screenshots, print CSS QA | Export QA | PENDING; tagged-PDF certification separate |
| R10 | Candidate A linked-condition secondary/descriptive isolation, zero narrative admission, empty acquisition production allow/release lists, offline AI-only, no model calls or effects/ROI claims | config hashes, negative fixtures, outbound-network inspection | Security + science | PENDING |
| R11 | No PHI entry/upload requirement, secret in static assets, logging of user free text, unapproved external endpoints, unexpected storage or telemetry | static secret grep, devtools/network/storage review, privacy memo | Security reviewer | PENDING |
| R12 | Exact-head standard CI + synthetic R + browser matrix + any independent review; no timeout/missing/BLOCK verdict treated as approval | linked jobs/attempt/statuses/HEAD + substantive reviewer finding; coordinate #101 | Release reviewer | PENDING |
| R13 | Live 3-minute rehearsal and failure fallback demonstrably sourced from same approved artifact | timed recording, route/action checklist, manifest and fallback match | Presenter + reviewer | PENDING |

Historical #99 owner reported focused 14/14, historical browser 140/140, 336 unit tests, actual PDF/JSON and successful workflow runs `38166742150` / `38166742136` at **earlier head** `fc4e379...`. These are relevant evidence, **not approval** for moved head `4b56b381...` or latest production upload. PR #94 is an unmerged comparator only. Actual screen-reader speech, native OS print dialog and tagged PDF accessibility are not certified by axe.

## Three-minute demo (stopwatch checkpoints)

| Time | Action + what to say | Invariant |
| --- | --- | --- |
| 0:00–0:20 | Open Overview: “The hidden cost of diagnostic delay is hard to plan around. This workspace separates the evidence we have from the decisions we still need to test.” | Don't call attributable savings observed |
| 0:20–0:50 | Burden: select reviewed 2024 national MEPS Long COVID estimate(s), show provenance and native units; note 21 reviewed measures | No suppressed/illustrative totals; no unit mixing |
| 0:50–1:15 | Local Context: show reviewed WV state-level HRSA/ACS context, 34 indicators | “Context shapes implementation; it does not rescale national burden.” |
| 1:15–2:05 | Pilot Planner: change a visible reach/capacity assumption; run one-way sensitivity | “These are transparent planning assumptions, **not** measured intervention effects or forecasts.” |
| 2:05–2:30 | Data Requests: identify absent intervention evidence, assemble concrete follow-up request and deliberately opt in | Request is planning need, not empirical evidence |
| 2:30–2:50 | Planning Brief: show traceable inputs, generated scenario and governed JSON/PDF output | Real export only; no invented ROI or live AI |
| 2:50–3:00 | Close: “The next step is to gather the missing evidence to decide where a defensible pilot might help.” | Explicit uncertainty remains |

Before stage: close all other tabs, reset state, preselect safe released measures, rehearse exact number of actions and elapsed time, verify Wi-Fi and backup local/offline approved build, disable unrelated notifications. Do not show unadmitted narrative source as reviewed.

## Failure fallback

* Approved **same-artifact** 3-minute screen recording (or timestamped slide/screenshot sequence) with frozen source SHA, asset manifest, and evidence release IDs attached.
* Switch within seconds upon a network/browser fault; state explicitly that the presentation is a recorded walkthrough of the pinned approved artifact, not a live site, live AI, current deployment, or real-world intervention validation.
* Show real previously generated JSON and PDF from the **same** exact candidate; never paste invented data or photoshop unsupported outputs. If neither live nor approved fallback is verifiable, disclose failure and do **not** claim release readiness.

## Decision gates and rollback

* **PR merge gate:** independent review and exact-head CI of each proposed PR (#103 documentation and separately #99 corrective), substantive verdict where required, and **separate PM merge authorization**. A green workflow alone is insufficient; merging a documentation PR does not imply Gate 0 PASS.
* **Gate 0 PASS gate:** separately accepted exact final-main C-01/C-02, full original browser suite, valid numeric edge cases and actual export/PDF proof; no implied PASS from PR status or earlier HEAD.
* **Source/scientific/privacy admission gate:** independently verify reviewed 21/34 source IDs and hashes, distinct Candidate A, zero candidate narrative promotion, empty acquisition allowlists, no live AI and no PHI leakage; no automatic promotion or release status change.
* **Release-candidate approval and static parity gate:** PM approves a precise main SHA plus source/lockfile hashes and reproducible bundle **after** separate Gate 0 and science/privacy acceptance. Then independently verify any proposed static branch and upload manifest against it, byte for byte. A branch's claimed source SHA, `npm install`, or matching UI is insufficient.
* **Deployment gate:** separate explicit PM approval of the exact release-candidate bytes, production branch/upload strategy, and an independently verified recovery artifact; only then a deployment operator acts. No currently listed Cloudflare deployment is certified known-good.
* **Phase 2 submission gate (Oct 15):** verify authoritative portal-specific requirements and acknowledgment; PM separately authorizes the Phase 2 submission before **2026-10-15 11:59 PM ET**, if the official schedule remains unchanged.
* **Final MVP Showcase submission gate (Oct 22):** timed live/fallback rehearsal, release acceptance matrix signed with evidence, actual showcase instructions confirmed, and **separate** final PM submission GO before **2026-10-22 11:59 PM ET**; do not infer October 15 submission success or release readiness from a showcase.

Rollback proposal (NOT executed): record the active production deployment `b296771d-5e5b-46cb-9cd5-89efa9a8c270` and historical Oct 11 `086af799-c1bc-4522-8add-ea7cfc98e5aa` as **inventory/forensic references only**, **not known-good rollback targets**. No existing deployment has been proven byte-identical to an approved build or independently certified safe for restoration. Before a future PM-authorized deploy, separately preserve and verify a known-good, immutable, exact-byte recovery artifact plus route/export smoke evidence, verify rollback permissions and strategy, and identify its source tree/manifest and Cloudflare deployment identity. If no verified recovery candidate exists, flag **ROLLBACK BLOCKED** and withhold deployment authorization. On a critical post-deploy failure, stop presentation/update, obtain incident authority, restore **only** the previously independently approved/reverified recovery artifact (if any), rerun smoke checks, and publish incident/revision details. Never restore an older deployment simply because it has a successful Cloudflare status or earlier timestamp.

## Remaining parallel work and issue hygiene

* #99 owns C-01/C-02 code, tests and final integration; this PR must not touch its branch. #101 owns Jules approval governance. #40 owns roadmap; #23/#26 source admission, #68 AI. Do **not** duplicate these issues.
* Worth a **new narrowly scoped issue only if needed after matrix audit**: automatically produce a reproducible SHA256-based live-asset deployment attestation and deep-link smoke job for ad-hoc Cloudflare uploads. This addresses a verifiable gap not solved by CI/build success alone; keep it documentation/QA first.
* Independent Final Release QA Reviewer should reproduce parity, product route matrix and export/print output against the **final approved main SHA**, then communicate pass/block with exact identities. A separate security/privacy reviewer should independently validate R10–R11.
