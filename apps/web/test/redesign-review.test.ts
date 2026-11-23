import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("brand palette is Sovereign Editorial obsidian and copper with zero AI-teal", () => {
  const tokens = readSource("../../../packages/ui/src/styles.css");
  assert.match(tokens, /--do-brand-navy:\s*#16191f/);
  assert.match(tokens, /--do-accent:\s*#a83e20/);
  assert.match(tokens, /--do-canvas:\s*#f7f3ec/);
  assert.match(tokens, /--do-reviewed-text:\s*#214569/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-canvas:\s*#0e1014/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-surface:\s*#161920/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-accent:\s*#e27a55/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-assumption-text:\s*#e5b874/);
  for (const forbidden of ["#0f7476", "#2a9d9f", "#58c3bd", "#276b54", "#3f765f", "#2c6b58"]) {
    assert.ok(!tokens.toLowerCase().includes(forbidden), `Forbidden AI-teal token ${forbidden}`);
  }
});

test("overview keeps the workflow visible without promotional filler", () => {
  const overview = readSource("../src/pages/OverviewPage.tsx");
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(overview, /See the hidden cost of fragmented care/);
  assert.match(overview, /Plan smarter before you spend/);
  assert.match(overview, /overview-proof/);
  assert.match(overview, /<OpeningProvenance playing=\{opening\.playing\}/);
  assert.match(overview, /className="overview-hero-motion"/);
  assert.match(overview, /journey-grid/);
  assert.doesNotMatch(overview, /<DecisionStateRail/);
  assert.doesNotMatch(overview, /overview-launch-pill/);
  assert.doesNotMatch(overview, /overview-final-cta/);
  assert.match(css, /radial-gradient/);
  assert.match(css, /workspace-preview/);
  assert.match(css, /console-signal-svg/);
  assert.doesNotMatch(css, /linear-gradient\(135deg, #153552, #102a3d 72%\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("narrow Overview uses valid single-column evidence and workflow grids", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  const narrow = css.match(/@media \(max-width: 540px\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(narrow, "540px mobile styles must exist");
  assert.match(narrow, /\.overview-page \.journey-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
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
  // Real @page margin boxes reserve document space instead of overlaying
  // paragraph text; dynamic artifact version and timestamp remain in provenance.
  assert.match(css, /@bottom-left\s*\{\s*content:\s*"Diagnostic Odyssey"/s);
  assert.match(css, /@bottom-right\s*\{\s*content:\s*"Page "\s*counter\(page\)/s);
  assert.match(css, /\.planning-brief-page \.brief-print-footer\s*\{\s*display:\s*none !important/s);
  assert.match(css, /\.brief-burden-table-wrap\s*\{[^}]*position:\s*relative/s);
});


test("workflow cards use restrained semantic variety across editorial roles", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  for (const accent of ["var(--do-reviewed-text)", "var(--do-selection-text)", "var(--do-assumption-text)", "var(--do-accent)"]) {
    assert.ok(css.includes(accent), accent);
  }
  assert.match(css, /journey-card:nth-child\(1\)/);
  assert.match(css, /journey-card:nth-child\(4\)/);
  assert.match(css, /--journey-accent/);
});

test("dark overview keeps copper as emphasis instead of the dominant field color", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(css, /:root\[data-theme="dark"\] \.overview-hero\s*\{[\s\S]*linear-gradient\(155deg, #161920 0%, #0e1014 68%, #13161d 100%\)/);
  assert.match(css, /rgba\(226, 122, 85, \.07\)/);
  assert.match(css, /\.overview-hero h1 span\s*\{[^}]*color:\s*var\(--do-accent\)/s);
  assert.match(css, /:root\[data-theme="dark"\] \.overview-value-prop\s*\{[^}]*background:\s*var\(--do-surface\)/s);
});
