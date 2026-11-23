import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("Tactical Monograph palette uses archival carbon, ivory, and gold with zero AI-teal", () => {
  const tokens = readSource("../../../packages/ui/src/styles.css");
  assert.match(tokens, /--do-canvas:\s*#f5f4ef/);
  assert.match(tokens, /--do-surface:\s*#fdfcf9/);
  assert.match(tokens, /--do-accent:\s*#181a1f/);
  assert.match(tokens, /--do-signal:\s*#946312/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-canvas:\s*#0e0f11/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-surface:\s*#16171b/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-signal:\s*#dfad4b/);
  for (const banned of ["#0f7476", "#2a9d9f", "#58c3bd", "#276b54", "#3f765f", "#2c6b58"]) {
    assert.ok(!tokens.toLowerCase().includes(banned), `Banned AI-teal token found: ${banned}`);
  }
});

test("overview keeps the workflow visible without promotional filler or scroll clutter", () => {
  const overview = readSource("../src/pages/OverviewPage.tsx");
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(overview, /Evidence into planning/);
  assert.match(overview, /boundaries intact/);
  assert.match(overview, /overview-proof/);
  assert.match(overview, /<OpeningProvenance playing=\{opening\.playing\}/);
  assert.match(overview, /className="overview-hero-motion"/);
  assert.match(overview, /journey-grid/);
  assert.doesNotMatch(overview, /<DecisionStateRail/);
  assert.doesNotMatch(overview, /overview-launch-pill/);
  assert.doesNotMatch(overview, /overview-final-cta/);
  assert.match(css, /strategy-dossier/);
  assert.match(css, /dossier-tabs/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /scroll-timeline|animation-timeline/);
});

test("narrow Overview uses valid single-column workflow grid", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  const narrow = css.match(/@media \(max-width: 640px\) \{([\s\S]*?)\n\}\n\n@media \(prefers-reduced-motion/)?.[1];
  assert.ok(narrow, "640px mobile styles must exist");
  assert.match(narrow, /\.overview-page \.journey-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("overview visualization preserves separate evidence roles in the 4-layer strategy dossier", () => {
  const source = readSource("../src/pages/OpeningProvenance.tsx");
  assert.match(source, /dossier-tabs/);
  assert.match(source, /01[\s\S]*Burden/);
  assert.match(source, /02[\s\S]*Terrain/);
  assert.match(source, /03[\s\S]*Strategy/);
  assert.match(source, /04[\s\S]*Brief/);
  assert.match(source, /National estimates, local context, and analyst assumptions stay separate in the Planning Brief/);
  assert.match(source, /not a combined scientific score/);
  assert.match(source, /Replay sequence/);
  assert.doesNotMatch(source, /style=\{\{/);
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
