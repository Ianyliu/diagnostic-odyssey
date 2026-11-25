# Design and motion (Strategic Atlas · Edition 01)

Diagnostic Odyssey uses **Strategic Atlas**, a light-first, cool-neutral editorial design system paired with a **7-role visual semantic grammar ("Grammar of Honesty")**. Color, pattern, typography, and motion always reinforce explicit written labels so readers can distinguish reviewed national evidence, statewide local access context, analyst assumptions, and open information gaps across light, dark, and print views.

## Brand identity and assets

| Asset | Purpose | Source / generator |
| --- | --- | --- |
| [`apps/web/public/diagnostic-odyssey-mark.svg`](../apps/web/public/diagnostic-odyssey-mark.svg) | Primary astrolabe vector mark (`#101B32` rounded square, `#B8A5FF` outer ring, `#91AAFF` dashed inner ring, `#F5F7FF` trajectory curve, `#3157D5` peak node, `#B8A5FF` waypoint) | Hand-authored SVG used in header chrome and favicon |
| [`apps/web/public/diagnostic-odyssey-icon.png`](../apps/web/public/diagnostic-odyssey-icon.png) | Crisp `192×192` raster app / Apple touch icon | Checked-in PNG derived from the astrolabe mark |
| [`apps/web/public/diagnostic-odyssey-horizontal.png`](../apps/web/public/diagnostic-odyssey-horizontal.png) | `760×144` horizontal lockup pairing the astrolabe mark with *Diagnostic Odyssey* and *EVIDENCE & PILOT STRATEGY WORKSPACE* | Checked-in PNG for documentation and light surfaces |
| [`apps/web/public/og-image.png`](../apps/web/public/og-image.png) | `1200×630` deterministic, non-numeric social share preview (*"Long COVID goes beyond the bill."*) | Generated during `prebuild` by [`scripts/og/render-og-image.mjs`](../scripts/og/render-og-image.mjs) |

**Palette boundary:** Warm earth tones, terracotta, brown, mustard/gold, sage, teal, and dark green are explicitly excluded from the brand identity. Bright green (`#1ED760` indicator dot, `#0B6E38` light text, `#4ADE80` dark text) is reserved narrowly for positive statuses.

## Color tokens and themes

Canonical tokens live in [`packages/ui/src/styles.css`](../packages/ui/src/styles.css). First-paint theme resolution runs synchronously via the parser-blocking [`apps/web/public/theme-init.js`](../apps/web/public/theme-init.js) (`diagnostic-odyssey.theme` in `localStorage` with `prefers-color-scheme` fallback) so light and dark themes paint without flash or `unsafe-inline` scripts under the strict CSP in [`apps/web/vercel.json`](../apps/web/vercel.json).

### Surface, ink, and brand tokens

| Role | CSS variable | Light (`:root`) | Dark (`[data-theme="dark"]`) | Print (`@media print`) |
| --- | --- | --- | --- | --- |
| Page canvas | `--do-canvas` | `#F5F7FC` | `#0B1119` | `#FFFFFF` |
| Card surface | `--do-surface` | `#FFFFFF` | `#131C27` | `#FFFFFF` |
| Elevated surface | `--do-surface-elevated` | `#EDF1FA` | `#1B2736` | `#FFFFFF` |
| Inset dark stage | `--do-ink-band` | `#101B32` | `#080D14` | `#FFFFFF` |
| Inset stage text / muted | `--do-ink-band-text` / `--do-ink-band-muted` | `#F5F7FF` / `#9EB0C3` | `#F2F5FF` / `#9EB0C3` | `#101B32` / `#4B596D` |
| Primary text / brand navy | `--do-text` / `--do-brand-navy` | `#101B32` | `#F2F5FF` | `#101B32` |
| Muted text | `--do-text-muted` | `#4B596D` | `#A8B8CC` | `#4A5562` |
| Structural / control border | `--do-border` / `--do-control-border` | `#D8E0EE` / `#76849B` | `#2A394C` / `#768BA6` | `#8995AA` / `#647182` |
| Primary action accent (cobalt) | `--do-accent` (`--do-accent-contrast`) | `#3157D5` (`#FFFFFF`) | `#91AAFF` (`#101B32`) | `#3157D5` (`#FFFFFF`) |
| Journey & focus accent (iris violet) | `--do-journey-accent` / `--do-focus` | `#7154D8` | `#B8A5FF` | `#5F3DB5` / `#101B32` |

### 7-role visual semantic grammar

Color is always supplemental: every semantic role combines dedicated text/surface/border tokens with explicit wording and non-color patterns (see [`apps/web/src/styles.css`](../apps/web/src/styles.css)).

| Semantic role | Light tokens (text / bg / border) | Dark tokens (text / bg / border) | Non-color visual signifier |
| --- | --- | --- | --- |
| **1. Reviewed national evidence** | `#2457A6` / `#EDF4FF` / `#9CB9E8` | `#8BB8F0` / `#142338` / `#3B6294` | Solid border (`--do-reviewed-*`); solid cobalt track (`--do-chart-1`) |
| **2. Selected local context** | `#1B4670` / `#EBF3FA` / `#8CA8C7` | `#91C9E8` / `#132634` / `#3A6685` | Double-line inset border (`--do-selection-*`); echoed ribbon |
| **3. Editable pilot assumptions** | `#5F3DB5` / `#F3EFFF` / `#C4B3F2` | `#C9B6FF` / `#241C3D` / `#6450A3` | 45° diagonal hatching + dashed violet cues (`--do-assumption-*`, `--do-chart-2`) |
| **4. Information gaps & data requests** | `#3D4D63` / `#EEF2F7` / `#76879F` | `#C4D1E2` / `#1C2633` / `#72859E` | Dashed neutral slate border (`--do-gap-*`, `--do-chart-4`) |
| **5. Caution / fixture / scaffold** | `#8F2456` / `#FDF1F6` / `#E5A9C4` | `#F7A6C9` / `#2F1926` / `#8C4164` | Plum caution callout & status pill (`--do-warning-*`) |
| **6. Error / unmet capacity gap** | `#B42348` / `#FFF0F4` / `#EBA6B8` | `#FF99B3` / `#361722` / `#A33D58` | Rose border + diagonal gap hatching (`--do-error-*`, `--do-chart-3`) |
| **7. Strategy AI Studio** | `#3A319E` / `#EEF0FF` / `#A7A3EB` | `#A5B8FF` / `#182042` / `#4F56A8` | Dotted indigo/violet border (`--do-ai-*`) & explicit AI label |

Automated token contrast assertions in [`apps/web/test/wcag-contrast.test.ts`](../apps/web/test/wcag-contrast.test.ts) verify `≥4.5:1` contrast for all text/background pairs and `≥3.0:1` for interactive borders, focus rings, and chart strokes in both light and dark modes.

## Self-hosted typography

All fonts are self-hosted via `@fontsource` imports in [`apps/web/src/main.tsx`](../apps/web/src/main.tsx) so zero external font requests leave the browser:

- **Display serif (`--do-font-display`):** `Newsreader Variable` (`wght` + italic) for editorial titles and stop labels.
- **Body & UI sans (`--do-font-body`):** `Plus Jakarta Sans Variable` for body copy, tables, controls, and captions.
- **Monospace (`--do-font-mono`):** `IBM Plex Mono` (`400`, `500`, `600`) for stage numbers, eyebrows, and provenance metadata.
- **Numeric alignment:** Global `font-variant-numeric: tabular-nums` and `.numeric-unit` prevent number/unit fragmentation across responsive widths.

## Shell, navigation, and workspace patterns

- **Sticky 56px frosted header (`AppShell.tsx`, `workspace.css`):** Brand astrolabe link, four numbered primary stages (`01 Burden`, `02 Local context`, `03 Strategy Lab`, `04 Planning Brief`), vertical divider + dashed optional companion `Data requests`, `AI` studio pill (`/advisor`), **Edition 01** `EditionDrawer` trigger, and `ThemeControl` (`System` / `Light` / `Dark`). Unsticks at short viewport heights (`max-height: 560px`) and collapses cleanly below `980px` with 44px minimum touch targets.
- **Six-chapter *Atlas Unfolded* landing (`OverviewPage.tsx`):**
  1. *Chapter I — Light Porcelain Hook:* Editorial question (*"What does chronic illness really cost us?"*) + decorative 3-ribbon [`LandingCareHorizon`](../apps/web/src/components/LandingCareHorizon.tsx) gliding into a folded Brief mark without enclosing the first screen in a heavy box.
  2. *Chapters II–III — Burden Scale & Sticky Evidence Strata:* Three headline national MEPS figures paired with a desktop sticky *Evidence Architecture* strata panel ([`LandingBurdenStrata`](../apps/web/src/components/LandingBurdenStrata.tsx)) that preserves cohort boundaries.
  3. *Chapter IV — Inset Midnight Navy Stage:* Rounded `#101B32` stage (*"From data to action."*) housing the sweeping `1024×380` Bezier cartographic pathway ([`LandingJourney`](../apps/web/src/components/LandingJourney.tsx)) with primary spine `01→04` and dashed optional `Data requests` spur.
  4. *Chapter V — Three Selective Product Beats:* Separated National MEPS vs. Statewide West Virginia lenses, live deterministic [`StrategyTeaserSandbox`](../apps/web/src/components/StrategyTeaserSandbox.tsx) (*Load into Strategy Lab*), and governed manual AI handoff demo ([`LandingAiDemo`](../apps/web/src/components/LandingAiDemo.tsx)).
  5. *Chapter VI — Planning Brief Finale:* Inset Midnight Navy closing frame with paper-fan graphic and direct links to `/brief`, `/burden`, `/evidence`, and the **Edition 01** roadmap drawer.
- **Workspace ledgers & drawers:** `01 Burden` and `02 Local context` default to `Focus` mode with `Overview` expansion (`PresentationMode`), `LedgerGroup` disclosures, and a split provenance inspector paired with native `<dialog>` `DetailDrawer` focus restoration.
- **Strategy Lab split studio (`PilotPage.tsx`):** Three-column studio on wide viewports (presets/inputs, container-queried `PilotDecisionVisuals`, and rule-based Decision Inspector) plus four bottom tabs (`Sensitivity` with deterministic capacity threshold curve, `Compare Strategies`, `All Quantities`, and `Context & Requests`).
- **Planning Brief memo (`BriefPage.tsx`):** Leads with the always-visible **Known · Assumed · Unknown** `BriefExecutiveSummary`, sticky command dock, opt-in print disclosures, and `@media print` light-mode rules.

## Motion contract

All motion is native CSS + lightweight browser observers (`IntersectionObserver` and `matchMedia`); zero animation libraries or inline `style={{}}` attributes are used.

- **Chapter I opening (`openingMotion.ts`, `motion.css`, `LandingCareHorizon.css`):** Plays once per tab session on a fresh, unqualified `/` visit (`OPENING_SESSION_KEY = "diagnostic-odyssey.opening-seen"`, `OPENING_DURATION_MS = 3800`; 2.6s *Care Horizon* ribbon and Brief-mark stagger). Immediately settles on `pointerdown`, `keydown`, `wheel`, `touchstart`, or hidden visibility, and bypasses automatically on deep links, query parameters, unavailable `sessionStorage`, or `prefers-reduced-motion: reduce`.
- **Chapter IV cartographic pathway (`LandingJourney.tsx`, `LandingJourney.css`):** Has an independent viewport-triggered lifecycle (`IntersectionObserver` at `threshold ≥ 0.25`, `JOURNEY_SESSION_KEY = "diagnostic-odyssey.journey-seen"`, `JOURNEY_DURATION_MS = 4000`, 2.65s stroke + staggered node choreography through `2700ms` + finite two-pulse destination halo). Wheel scroll inertia does **not** cancel the Chapter IV trace; deliberate `pointerdown`, `keydown`, and visibility changes settle it, and an accessible `Replay animation` button allows re-triggering when reduced motion is off.
- **Scroll-driven accents:** When supported by the browser, CSS `animation-timeline: scroll(root)` drives the top hairline progress bar and `animation-timeline: view()` drives subtle scroll emphasis along the Care Horizon and Journey trace. Lower-page beats use [`useScrollReveal.ts`](../apps/web/src/pages/useScrollReveal.ts) (`680ms`, `cubic-bezier(0.16, 1, 0.3, 1)`).
- **Routine feedback & reduced motion:** Hover, border, and surface transitions use `--do-motion-fast` (`150ms`) and `--do-motion-standard` (`240ms`). `@media (prefers-reduced-motion: reduce)` and `@media print` disable animations and transitions and keep all routes, ribbons, and text immediately visible.

See [`tests/browser/motion.mjs`](../tests/browser/motion.mjs), [`tests/browser/opening-circuit.mjs`](../tests/browser/opening-circuit.mjs), and [`tests/browser/landing-evidence.mjs`](../tests/browser/landing-evidence.mjs) for automated verification.

## Research applied

- [Nielsen Norman Group: visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) — editorial scale, inset dark focal bands, and semantic grouping clarify evidence vs. assumptions.
- [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — Focus/Overview ledgers and provenance drawers defer secondary detail while keeping scientific limits exposed.
- [Nielsen Norman Group: animation duration](https://www.nngroup.com/articles/animation-duration/) — brief `150–240ms` UI transitions and deliberate, interruptible story choreography.
- [web.dev: high-performance CSS animations](https://web.dev/articles/animations-guide) — opacity, transform, and `stroke-dashoffset` compositing without layout thrashing.
- [WCAG: animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) — `prefers-reduced-motion` bypass, immediate interruption, and manual replay control.
- [WCAG: target size (minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — `44px` minimum interactive targets across mobile controls, disclosures, and navigation links.

These references guide implementation; they are not a claim of complete WCAG conformance. Automated checks cover Chromium rendering, token contrast, keyboard focus order, and `axe-core` rules; real-device screen-reader usability and native print-dialog testing remain separate manual checks.
