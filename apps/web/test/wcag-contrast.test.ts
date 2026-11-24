import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../../../packages/ui/src/styles.css", import.meta.url), "utf8");

function parseTokens(blockBody: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of blockBody.matchAll(/(--do-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
    map.set(match[1]!, match[2]!.toLowerCase());
  }
  return map;
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

const lightBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const darkBlock = css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

const lightTokens = parseTokens(lightBlock);
const darkTokens = parseTokens(darkBlock);

for (const [modeName, tokens] of [
  ["light", lightTokens],
  ["dark", darkTokens]
] as const) {
  test(`WCAG 2.1 AA text & control contrast holds in ${modeName} palette`, () => {
    assert.ok(tokens.size > 25, `Expected parsed hex tokens in ${modeName} mode`);

    const textPairs: ReadonlyArray<readonly [string, string, number]> = [
      ["--do-text", "--do-canvas", 4.5],
      ["--do-text", "--do-surface", 4.5],
      ["--do-text", "--do-surface-elevated", 4.5],
      ["--do-text-muted", "--do-canvas", 4.5],
      ["--do-text-muted", "--do-surface", 4.5],
      ["--do-text-muted", "--do-surface-elevated", 4.5],
      ["--do-ink-band-text", "--do-ink-band", 4.5],
      ["--do-ink-band-muted", "--do-ink-band", 4.5],
      ["--do-accent", "--do-surface", 4.5],
      ["--do-accent", "--do-canvas", 4.5],
      ["--do-accent-contrast", "--do-accent", 4.5],
      ["--do-reviewed-text", "--do-reviewed-bg", 4.5],
      ["--do-reviewed-text", "--do-surface", 4.5],
      ["--do-selection-text", "--do-selection-bg", 4.5],
      ["--do-selection-text", "--do-surface", 4.5],
      ["--do-assumption-text", "--do-assumption-bg", 4.5],
      ["--do-assumption-text", "--do-surface", 4.5],
      ["--do-warning-text", "--do-warning-bg", 4.5],
      ["--do-error-text", "--do-error-bg", 4.5],
      ["--do-ai-text", "--do-ai-bg", 4.5],
      ["--do-success-text", "--do-success-bg", 4.5],
      ["--do-control-border", "--do-surface", 3.0],
      ["--do-control-border", "--do-surface-elevated", 3.0],
      ["--do-focus", "--do-surface", 3.0],
      ["--do-chart-1", "--do-surface", 3.0],
      ["--do-chart-2", "--do-surface", 3.0],
      ["--do-chart-3", "--do-surface", 3.0]
    ];

    for (const [fgKey, bgKey, threshold] of textPairs) {
      const fg = tokens.get(fgKey);
      const bg = tokens.get(bgKey);
      assert.ok(fg && bg, `Missing ${fgKey} (${fg}) or ${bgKey} (${bg}) in ${modeName}`);
      const ratio = contrastRatio(fg, bg);
      assert.ok(
        ratio >= threshold,
        `${modeName} contrast ${fgKey} (${fg}) on ${bgKey} (${bg}) = ${ratio.toFixed(2)}:1 < ${threshold}:1`
      );
    }
  });
}
