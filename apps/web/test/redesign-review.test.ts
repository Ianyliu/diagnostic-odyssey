import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("Cupertino Clarity palette uses Apple daylight, Space Black, Cobalt, Amber, Indigo with zero AI-teal", () => {
  const tokens = readSource("../../../packages/ui/src/styles.css");
  assert.match(tokens, /--do-canvas:\s*#f5f5f7/);
  assert.match(tokens, /--do-surface:\s*#ffffff/);
  assert.match(tokens, /--do-text:\s*#1d1d1f/);
  assert.match(tokens, /--do-accent:\s*#0066cc/);
  assert.match(tokens, /--do-amber:\s*#bf6a00/);
  assert.match(tokens, /--do-indigo:\s*#4f46e5/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-canvas:\s*#000000/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-surface:\s*#1c1c1e/);
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--do-accent:\s*#4da3ff/);
  assert.doesNotMatch(tokens, /0f7476|2a9d9f|58c3bd|276b54|3f765f|2c6b58/i);
});

test("Overview renders form-first hero and interactive bento grid with zero inline styles", () => {
  const overview = readSource("../src/pages/OverviewPage.tsx");
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(overview, /Health costs, finally clear\./);
  assert.match(overview, /bento-simulator/);
  assert.match(overview, /bento-reality/);
  assert.match(overview, /edition-pill-rail/);
  assert.doesNotMatch(overview, /style=\{\{/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.bento-tile\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
});

test("sensitivity rows share one grid and the current row does not escape the card", () => {
  const css = readSource("../src/components/SensitivityExplorer.css");
  assert.match(css, /\.sensitivity-bars\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.sensitivity-row\s*\{[^}]*grid-template-columns:\s*subgrid/s);
  assert.match(css, /\.sensitivity-row\s*\{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(css, /\.sensitivity-row\.current\s*\{[^}]*margin-inline:\s*0/s);
});

test("all quantitative burden and local-context rows expose CSP-safe SVG native-unit visuals", () => {
  const burden = readSource("../src/components/BurdenMeasureList.tsx");
  const local = readSource("../src/pages/LocalContextPage.tsx");
  const visual = readSource("../src/components/MetricVisual.tsx");
  assert.match(burden, /<MetricVisual/);
  assert.match(local, /<MetricVisual/);
  assert.match(visual, /role="img"/);
  assert.match(visual, /<svg/);
  assert.doesNotMatch(visual, /style=\{\{/);
  const geometry = readSource("../src/data/metricGeometry.ts");
  assert.match(geometry, /No uncertainty interval is displayed/);
  assert.match(visual, /metricAriaDescription/);
});

test("Planning Brief print repeats product provenance and moves decision state out of trailing sidebar", () => {
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
});
