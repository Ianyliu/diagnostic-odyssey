import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("brand palette is Architectural Blueprint cobalt and slate with zero AI-Teal", () => {
  const tokens = readSource("../../../packages/ui/src/styles.css");
  assert.match(tokens, /--do-brand-navy:\s*#0f172a/);
  assert.match(tokens, /--do-accent:\s*#1e40af/);
  assert.match(tokens, /--do-canvas:\s*#f4f6fa/);
  assert.match(tokens, /--do-surface:\s*#ffffff/);
  assert.match(tokens, /--do-font-display:\s*"Space Grotesk Variable"/);
  assert.match(tokens, /--do-font-body:\s*"DM Sans Variable"/);
  assert.match(tokens, /--do-font-mono:\s*"JetBrains Mono Variable"/);
  assert.doesNotMatch(tokens, /#0f7476|#2a9d9f|#58c3bd|#276b54|#3f765f|#2c6b58/i);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-canvas:\s*#0a0e17/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-surface:\s*#111827/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-accent:\s*#6d9bff/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-chart-4:\s*#a5b4fc/);
});

test("overview keeps the workflow visible without promotional filler", () => {
  const overview = readSource("../src/pages/OverviewPage.tsx");
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(overview, /Evidence into planning/);
  assert.match(overview, /boundaries intact/);
  assert.match(overview, /overview-proof/);
  assert.match(overview, /<OpeningProvenance[\s\S]*?playing=\{opening\.playing\}/);
  assert.match(overview, /<StrategyTeaserSandbox \/>/);
  assert.match(overview, /className="overview-hero-motion"/);
  assert.match(overview, /journey-grid/);
  assert.doesNotMatch(overview, /<DecisionStateRail/);
  assert.doesNotMatch(overview, /overview-launch-pill/);
  assert.doesNotMatch(overview, /overview-final-cta/);
  assert.match(css, /radial-gradient/);
  assert.match(css, /workspace-preview/);
  assert.match(css, /\.overview-destinations\s*\{[^}]*background:\s*transparent/);
  assert.doesNotMatch(css, /linear-gradient\(135deg, #153552, #102a3d 72%\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("narrow Overview uses valid single-column evidence and workflow grids", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  const narrow = css.match(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(narrow, "720px mobile styles must exist");
  assert.match(narrow, /\.overview-role-grid,\s*\.overview-page \.journey-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.doesNotMatch(narrow, /\.overview-page \.journey-grid,\s*\.overview-role-card/);
});

test("overview visualization preserves separate evidence lanes through the planning output", () => {
  const source = readSource("../src/pages/OpeningProvenance.tsx");
  assert.match(source, /opening-lane lane-evidence/);
  assert.match(source, /opening-lane lane-context/);
  assert.match(source, /opening-lane lane-assumption/);
  assert.match(source, /National estimates, local context, and analyst assumptions stay separate in the Planning Brief/);
  assert.match(source, /not a combined scientific score/);
  assert.match(source, /Replay animation/);
  assert.match(source, /schematic-node-bar/);
  assert.match(source, /preview-inspector/);
  assert.doesNotMatch(source, /opening-junction/);
});

test("sensitivity rows share one grid and the current row does not escape the card", () => {
  const css = readSource("../src/components/SensitivityExplorer.css");
  assert.match(css, /\.sensitivity-bars\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.sensitivity-row\s*\{[^}]*grid-template-columns:\s*subgrid/s);
  assert.match(css, /\.sensitivity-row\s*\{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(css, /\.sensitivity-row\.current\s*\{[^}]*margin-inline:\s*0/s);
  assert.doesNotMatch(css, /\.sensitivity-row\.current\s*\{[^}]*padding-inline:/s);
});

test("all quantitative burden and local-context rows expose native-unit mini visuals", () => {
  const burden = readSource("../src/components/BurdenMeasureList.tsx");
  const local = readSource("../src/pages/LocalContextPage.tsx");
  const visual = readSource("../src/components/MetricVisual.tsx");
  assert.match(burden, /<MetricVisual/);
  assert.match(local, /<MetricVisual/);
  assert.match(visual, /role="img"/);
  const geometry = readSource("../src/data/metricGeometry.ts");
  assert.match(geometry, /No uncertainty interval is displayed/);
  assert.match(visual, /intervalLabel/);
  assert.match(burden, /value=\{estimate\.value\}/);
  assert.match(visual, /metricAriaDescription/);
  assert.match(geometry, /formatMetricValue/);
  assert.match(burden, /pointLabel=\{estimate\.distribution_summary/);
});

test("overview preview does not encode illustrative values as a chart", () => {
  const source = readSource("../src/pages/OpeningProvenance.tsx");
  assert.doesNotMatch(source, /preview-mini-chart/);
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(css, /\.preview-boundary-line\s*\{/);
  assert.doesNotMatch(css, /\.preview-mini-chart\s*\{/);
  assert.doesNotMatch(source, /height: "(?:42|74|58|88)%"/);
});

test("Planning Brief print repeats product provenance and moves decision state out of the trailing sidebar", () => {
  const brief = readSource("../src/pages/BriefPage.tsx");
  const css = readSource("../src/pages/BriefPage.css");
  assert.match(brief, /brief-print-footer/);
  assert.match(brief, /Diagnostic Odyssey/);
  assert.match(brief, /brief\.artifact_version/);
  assert.match(brief, /brief\.generated_at/);
  assert.match(brief, /brief-print-decision-state/);
  assert.match(brief, /<h2>Decision state<\/h2>/);
  assert.match(css, /\.planning-brief-page \.brief-aside\s*\{\s*display:\s*none !important/s);
  assert.match(css, /@bottom-left\s*\{\s*content:\s*"Diagnostic Odyssey"/s);
  assert.match(css, /@bottom-right\s*\{\s*content:\s*"Page "\s*counter\(page\)/s);
  assert.match(css, /\.planning-brief-page \.brief-print-footer\s*\{\s*display:\s*none !important/s);
  assert.match(css, /\.brief-burden-table-wrap\s*\{[^}]*position:\s*relative/s);
});

test("workflow cards use restrained Architectural Blueprint accents", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  for (const accent of ["#1e40af", "#334155", "#92400e", "#1e3a8a", "#475569", "#0f172a"]) {
    assert.ok(css.includes(accent), accent);
  }
  assert.match(css, /journey-card:nth-child\(1\)/);
  assert.match(css, /journey-card:nth-child\(6\)/);
  assert.match(css, /--journey-accent/);
});

test("dark overview keeps Blueprint Cobalt as emphasis instead of the dominant field color", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(css, /:root\[data-theme="dark"\] \.overview-hero\s*\{[\s\S]*linear-gradient\(155deg, #111827 0%, #0a0e17 64%, #0f172a 100%\)/);
  assert.match(css, /rgba\(109, 155, 255, \.09\)/);
  assert.match(css, /\.overview-hero h1 em\s*\{[^}]*color:\s*var\(--do-accent\)/s);
  assert.match(css, /:root\[data-theme="dark"\] \.workspace-preview\s*\{[^}]*background:\s*#111827/s);
});
