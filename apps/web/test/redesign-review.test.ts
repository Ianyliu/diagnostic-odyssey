import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("Atelier Atlas palette uses Midnight Ink, Warm Gallery Paper, Gold, Terracotta, and Steel Slate with zero AI-teal", () => {
  const tokens = readSource("../../../packages/ui/src/styles.css");
  assert.match(tokens, /--do-brand-navy:\s*#0d1622/);
  assert.match(tokens, /--do-canvas:\s*#f9f7f3/);
  assert.match(tokens, /--do-gold:\s*#c8923b/);
  assert.match(tokens, /--do-accent:\s*#c25a3c/);
  assert.match(tokens, /--do-reviewed-text:\s*#2e5373/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-canvas:\s*#0b1119/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-surface:\s*#131c27/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-accent:\s*#e47b5c/);
  assert.doesNotMatch(tokens, /#0f7476|#2a9d9f|#58c3bd|#276b54|#3f765f|#2c6b58/i);
});

test("overview stays form-first with Midnight Ink bands, Two-Lens showcase, and zero inline styles", () => {
  const overview = readSource("../src/pages/OverviewPage.tsx");
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(overview, /Lower the hidden cost of care\./);
  assert.match(overview, /atlas-hero-band/);
  assert.match(overview, /atlas-paper-band/);
  assert.match(overview, /atlas-closing-band/);
  assert.match(overview, /atlas-lenses-grid/);
  assert.match(overview, /atlas-paper-fan/);
  assert.doesNotMatch(overview, /style=\{\{/);
  assert.match(css, /radial-gradient/);
  assert.doesNotMatch(css, /#0f7476|#2a9d9f|#58c3bd|#276b54|#3f765f|#2c6b58/i);
});

test("all quantitative burden and local-context rows expose SVG native-unit mini visuals without inline styles", () => {
  const burden = readSource("../src/components/BurdenMeasureList.tsx");
  const local = readSource("../src/pages/LocalContextPage.tsx");
  const visual = readSource("../src/components/MetricVisual.tsx");
  const geometry = readSource("../src/data/metricGeometry.ts");
  assert.match(burden, /<MetricVisual/);
  assert.match(local, /<MetricVisual/);
  assert.match(visual, /role="img"/);
  assert.match(visual, /<svg/);
  assert.doesNotMatch(visual, /style=\{\{/);
  assert.match(geometry, /No uncertainty interval is displayed/);
  assert.match(visual, /intervalLabel/);
  assert.match(burden, /value=\{estimate\.value\}/);
});

test("sensitivity rows share one grid and use SVG bars without inline styles", () => {
  const sensitivity = readSource("../src/components/SensitivityExplorer.tsx");
  const css = readSource("../src/components/SensitivityExplorer.css");
  assert.match(css, /\.sensitivity-bars\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.sensitivity-row\s*\{[^}]*grid-template-columns:\s*subgrid/s);
  assert.match(css, /\.sensitivity-row\.current\s*\{[^}]*margin-inline:\s*0/s);
  assert.match(sensitivity, /<svg className="sensitivity-svg"/);
  assert.doesNotMatch(sensitivity, /style=\{\{/);
});

test("Planning Brief print retains provenance and decision state outside trailing sidebar", () => {
  const brief = readSource("../src/pages/BriefPage.tsx");
  const css = readSource("../src/pages/BriefPage.css");
  assert.match(brief, /brief-print-footer/);
  assert.match(brief, /Diagnostic Odyssey/);
  assert.match(brief, /brief\.artifact_version/);
  assert.match(brief, /brief\.generated_at/);
  assert.match(brief, /brief-print-decision-state/);
  assert.match(brief, /<h2>Decision state<\/h2>/);
  assert.match(css, /@bottom-left\s*\{\s*content:\s*"Diagnostic Odyssey"/s);
  assert.match(css, /@bottom-right\s*\{\s*content:\s*"Page "\s*counter\(page\)/s);
});
