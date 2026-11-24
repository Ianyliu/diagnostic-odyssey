import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("brand palette is Obsidian Command dark-first with zero AI-teal", () => {
  const tokens = readSource("../../../packages/ui/src/styles.css");
  assert.match(tokens, /--do-canvas:\s*#0a0b0e/);
  assert.match(tokens, /--do-surface:\s*#12141a/);
  assert.match(tokens, /--do-text:\s*#f4f2ec/);
  assert.match(tokens, /--do-accent:\s*#d9a441/);
  assert.match(tokens, /:root\[data-theme="light"\][\s\S]*--do-canvas:\s*#f4f3ee/);
  assert.match(tokens, /:root\[data-theme="light"\][\s\S]*--do-text:\s*#111318/);
  assert.match(tokens, /:root\[data-theme="light"\][\s\S]*--do-accent:\s*#9a6a16/);
  assert.doesNotMatch(tokens, /#0f7476|#2a9d9f|#58c3bd|#276b54|#3f765f|#2c6b58/i);
});

test("overview uses tactical arc and quantitative monolith strip without filler", () => {
  const overview = readSource("../src/pages/OverviewPage.tsx");
  const css = readSource("../src/pages/OverviewPage.css");
  assert.match(overview, /See where health costs break\. Move the right lever first\./);
  assert.match(overview, /tactical-arc-shell/);
  assert.match(overview, /monolith-strip/);
  assert.match(overview, /Enter Command Workspace/);
  assert.doesNotMatch(overview, /<DecisionStateRail/);
  assert.doesNotMatch(overview, /style=\{\{/);
  assert.match(css, /obsidian-grid-backdrop/);
  assert.match(css, /radial-gradient/);
});

test("narrow Overview uses single-column monolith strip", () => {
  const css = readSource("../src/pages/OverviewPage.css");
  const narrow = css.match(/@media \(max-width: 820px\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(narrow, "820px mobile styles must exist");
  assert.match(narrow, /\.monolith-strip\s*\{\s*grid-template-columns:\s*1fr/);
});

test("sensitivity rows share one grid and the current row does not escape the card", () => {
  const css = readSource("../src/components/SensitivityExplorer.css");
  assert.match(css, /\.sensitivity-bars\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.sensitivity-row\s*\{[^}]*grid-template-columns:\s*subgrid/s);
  assert.match(css, /\.sensitivity-row\s*\{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(css, /\.sensitivity-row\.current\s*\{[^}]*margin-inline:\s*0/s);
  assert.doesNotMatch(css, /\.sensitivity-row\.current\s*\{[^}]*padding-inline:/s);
});

test("all quantitative burden and local-context views use pure-SVG native-unit visuals", () => {
  const burden = readSource("../src/pages/BurdenPage.tsx");
  const domain = readSource("../src/pages/DomainPage.tsx");
  const local = readSource("../src/pages/LocalContextPage.tsx");
  const visual = readSource("../src/components/MetricVisual.tsx");
  assert.match(burden, /TelemetryWhiskerTrack/);
  assert.match(domain, /<MetricVisual/);
  assert.match(local, /ConstraintBar/);
  assert.match(visual, /role="img"/);
  assert.doesNotMatch(visual, /style=\{\{/);
  const geometry = readSource("../src/data/metricGeometry.ts");
  assert.match(geometry, /No uncertainty interval is displayed/);
  assert.match(visual, /intervalLabel/);
  assert.match(visual, /metricAriaDescription/);
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
  assert.match(css, /\.planning-brief-page \.brief-aside,[\s\S]*?display:\s*none !important/s);
  assert.match(css, /@bottom-left\s*\{\s*content:\s*"Diagnostic Odyssey"/s);
  assert.match(css, /@bottom-right\s*\{\s*content:\s*"Page "\s*counter\(page\)/s);
  assert.match(css, /\.planning-brief-page \.brief-print-footer\s*\{[\s\S]*?display:\s*none !important/s);
  assert.match(css, /\.brief-burden-table-wrap\s*\{[^}]*position:\s*relative/s);
});
