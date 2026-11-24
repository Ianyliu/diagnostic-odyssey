import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readSource(path: string): string {
  return readFileSync(resolve(import.meta.dirname, path), "utf8");
}

test("AppShell exposes a working skip link and focusable main target", () => {
  const shell = readSource("../src/components/AppShell.tsx");
  assert.match(shell, /className="skip-link" href="#main-content"/);
  assert.match(shell, /<main id="main-content" tabIndex=\{-1\}[^>]*>/);
});

test("unexpected render failures use an accessible evidence-honest fallback", () => {
  const boundary = readSource("../src/components/ErrorBoundary.tsx");
  const app = readSource("../src/App.tsx");
  assert.match(app, /<ErrorBoundary>\s*<ArtifactProvider>/);
  assert.match(boundary, /className="skip-link" href="#main-content"/);
  assert.match(boundary, /<main id="main-content"[^>]*tabIndex=\{-1\}/);
  assert.match(boundary, /role="alert"/);
  assert.match(boundary, /unexpected error/i);
  assert.match(boundary, /No substitute evidence or estimate has been created/);
  assert.match(boundary, /window\.location\.reload/);
  assert.doesNotMatch(boundary, /artifact is invalid|invalid artifact/i);
});

test("Planning Brief print contract hides chrome but retains substantive content and provenance", () => {
  const styles = readSource("../src/styles.css");
  const tokens = readSource("../../../packages/ui/src/styles.css");
  const briefStyles = readSource("../src/pages/BriefPage.css");
  const brief = readSource("../src/pages/BriefPage.tsx");
  const navCss = readSource("../src/components/WorkspaceNavigation.css");
  assert.match(styles, /@media print/);
  assert.match(navCss, /@media print[\s\S]*\.command-rail[\s\S]*display:\s*none !important/);
  assert.match(briefStyles, /\.planning-brief-page \.brief-export-actions[\s\S]*display:\s*none !important/);
  assert.doesNotMatch(styles, /\.brief-content\s*\{[^}]*display:\s*none/i);
  assert.match(tokens, /@media print\s*\{\s*:root,\s*:root\[data-theme="dark"\],\s*:root\[data-theme="light"\]\s*\{/);
  assert.match(tokens, /--do-canvas:\s*#ffffff/);
  assert.match(briefStyles, /@media print\s*\{/);
  assert.match(briefStyles, /\.planning-brief-page \.brief-burden-table-wrap\s*\{\s*overflow:\s*visible;/);
  assert.match(briefStyles, /\.planning-brief-page \.brief-burden-table\s*\{[^}]*table-layout:\s*fixed/);
  assert.match(briefStyles, /\.planning-brief-page \.brief-burden-group,[\s\S]*?break-inside:\s*auto/);
  assert.match(briefStyles, /\.planning-brief-page \.brief-burden-details::details-content\s*\{\s*content-visibility:\s*visible\s*!important/);
  assert.match(brief, /className="print-provenance"/);
  assert.match(brief, /<b>National reviewed artifact:<\/b> \{brief\.artifact_version\}/);
  assert.match(brief, /brief\.context\.local_context_id &&/);
  assert.match(brief, /Reviewed local-context artifact:/);
  assert.match(brief, /<b>Generated:<\/b> \{brief\.generated_at\}/);
});

test("JSON companion remains derived from the same gated brief object and artifact version", () => {
  const brief = readSource("../src/pages/BriefPage.tsx");
  assert.match(brief, /serializeBriefJson\(brief\)/);
  assert.match(brief, /anchor\.download\s*=\s*brief\.artifact_version \+ "-planning-brief\.json"/);
  assert.match(brief, /dataRequests: selectedDataRequests/);
  assert.match(brief, /localContext: briefLocalContext/);
  assert.match(brief, /withStaleSelectedDataRequestWarning/);
});

test("shell keeps navigation available at narrow widths without sticky overlap", () => {
  const shell = readSource("../src/components/AppShell.tsx");
  const navCss = readSource("../src/components/WorkspaceNavigation.css");
  const styles = readSource("../src/styles.css");
  const main = readSource("../src/main.tsx");

  assert.match(shell, /aria-expanded=\{menuOpen\}/);
  assert.match(shell, /aria-controls="workspace-tools"/);
  assert.match(shell, /event\.key !== "Escape"/);
  assert.match(shell, /menuToggle\.current\?\.focus\(\)/);
  assert.match(navCss, /@media \(max-width: 959px\)/);
  assert.match(navCss, /\.rail-drawer\.open\s*\{[^}]*display:\s*flex/);
  assert.ok(main.indexOf('import "./styles.css"') < main.indexOf('import "./workspace.css"'));
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /scroll-behavior:\s*auto !important/);
});

test("focusable Brief burden tables expose a named scroll region and table caption", () => {
  const brief = readSource("../src/pages/BriefPage.tsx");
  assert.match(brief, /className="brief-burden-table-wrap" role="region" tabIndex=\{0\} aria-label=/);
  assert.match(brief, /<caption className="sr-only">\{group\.label\} reviewed national burden findings<\/caption>/);
});

test("existing decision visual text/table alternatives remain present", () => {
  const sensitivity = readSource("../src/components/SensitivityExplorer.tsx");
  const pilot = readSource("../src/components/PilotDecisionVisuals.tsx");
  const interval = readSource("../src/components/IntervalWhiskerPlot.tsx");
  const hpsa = readSource("../src/components/HpsaRuralComposition.tsx");
  assert.match(sensitivity, /View sensitivity values as a table/);
  assert.match(sensitivity, /<table className="visual-data-table">/);
  assert.match(pilot, /aria-label=/);
  assert.match(interval, /95% confidence interval/);
  assert.match(hpsa, /aria-label=/);
  assert.match(hpsa, /hpsa-legend/);
});
