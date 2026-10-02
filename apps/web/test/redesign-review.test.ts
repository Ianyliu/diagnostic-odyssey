import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("brand palette is navy and teal rather than a red primary theme", () => {
  const tokens = readSource("../../../packages/ui/src/styles.css");
  assert.match(tokens, /--do-brand-navy:\s*#153552/);
  assert.match(tokens, /--do-brand-teal:\s*#0f7476/);
  assert.match(tokens, /--do-accent:\s*#0f7476/);
  assert.match(tokens, /--do-canvas:\s*#f5f2eb/);
  assert.doesNotMatch(tokens, /--do-accent:\s*#762f3c/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-canvas:\s*#09131b/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-surface:\s*#111d26/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-chart-4:\s*#d2ad68/);
});

test("overview keeps the workflow visible without promotional filler", () => {
  const overview = readSource("../src/pages/OverviewPage.tsx");
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(overview, /Evidence into planning/);
  assert.match(overview, /boundaries intact/);
  assert.match(overview, /overview-proof/);
  assert.match(overview, /overview-role-grid/);
  assert.match(overview, /journey-grid/);
  assert.match(overview, /<DecisionStateRail \/>/);
  assert.doesNotMatch(overview, /overview-launch-pill/);
  assert.doesNotMatch(overview, /overview-final-cta/);
  assert.match(css, /radial-gradient/);
  assert.match(css, /workspace-preview/);
  assert.match(css, /\.overview-destinations\s*\{[\s\S]*background:\s*var\(--do-surface\)/);
  assert.doesNotMatch(css, /linear-gradient\(135deg, #153552, #102a3d 72%\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("overview visualization preserves separate evidence lanes through the planning output", () => {
  const source = readSource("../src/pages/OpeningProvenance.tsx");
  assert.match(source, /opening-lane lane-evidence/);
  assert.match(source, /opening-lane lane-context/);
  assert.match(source, /opening-lane lane-assumption/);
  assert.match(source, /The three lanes stay distinct all the way into the Planning brief/);
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
  assert.match(visual, /No uncertainty interval is displayed/);
  assert.match(visual, /intervalLabel/);
  assert.match(burden, /value=\{estimate\.value\}/);
  assert.match(visual, /maximumFractionDigits: 0/);
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
  assert.match(css, /\.planning-brief-page \.brief-print-footer\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /\.brief-burden-table-wrap\s*\{[^}]*position:\s*relative/s);
});


test("workflow cards use restrained semantic variety instead of one teal treatment", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  for (const accent of ["#3f765f", "#3e6f91", "#8a6d2c", "#397d7b", "#687486", "#153552"]) {
    assert.ok(css.includes(accent), accent);
  }
  assert.match(css, /journey-card:nth-child\(1\)/);
  assert.match(css, /journey-card:nth-child\(6\)/);
  assert.match(css, /--journey-accent/);
});

test("dark overview keeps teal as emphasis instead of the dominant field color", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(css, /:root\[data-theme="dark"\] \.overview-hero\s*\{[\s\S]*linear-gradient\(145deg, #101d27 0%, #09131b 66%, #0d1821 100%\)/);
  assert.match(css, /rgba\(88, 195, 189, \.055\)/);
  assert.match(css, /\.overview-hero h1 em\s*\{[^}]*color:\s*var\(--do-accent\)/s);
  assert.match(css, /:root\[data-theme="dark"\] \.overview-lede\s*\{[^}]*color:\s*#c1c9cd/s);
});
