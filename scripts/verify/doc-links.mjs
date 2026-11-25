#!/usr/bin/env node
/**
 * Verify relative links (and Markdown heading anchors) in the maintained documentation.
 *
 * Historical records (audits, design-experiment handoffs, PR archives) are intentionally preserved
 * unchanged and are excluded; see EXCLUDED_PREFIXES. External URLs are not fetched (offline check).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const EXCLUDED_PREFIXES = [
  "docs/audit-2026-10-10/", "docs/audit-2026-10-16/", "docs/acquisition-hints-2026-10-11/", "docs/ai-experience-preview/",
  "docs/ai-handoff/", "docs/guided-workspace/", "docs/planning-insights/", "docs/planning-intelligence-integration/",
  "docs/design-experiments/", "docs/maintenance-", "docs/planning-to-action-2026-10-25.md"
];

/** GitHub-style heading slug (sufficient for the headings used in this repository). */
export function slugify(heading) {
  return heading.trim().toLowerCase().replace(/`/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

export function anchorsOf(markdown) {
  const anchors = new Set();
  const counts = new Map();
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const match = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const base = slugify(match[1].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"));
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    anchors.add(seen === 0 ? base : `${base}-${seen}`);
  }
  return anchors;
}

export function linksOf(markdown) {
  const links = [];
  let fenced = false;
  for (const [index, line] of markdown.split("\n").entries()) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const stripped = line.replace(/`[^`]*`/g, "");
    for (const match of stripped.matchAll(/\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) links.push({ target: match[1], line: index + 1 });
  }
  return links;
}

export function checkFile(root, file) {
  const failures = [];
  const text = readFileSync(join(root, file), "utf8");
  for (const { target, line } of linksOf(text)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue;
    const [pathPart, anchor] = target.split("#");
    const resolved = pathPart ? resolve(dirname(join(root, file)), decodeURIComponent(pathPart)) : join(root, file);
    if (!existsSync(resolved)) { failures.push(`${file}:${line}: missing target ${target}`); continue; }
    if (anchor && resolved.endsWith(".md") && statSync(resolved).isFile() && !anchorsOf(readFileSync(resolved, "utf8")).has(decodeURIComponent(anchor).toLowerCase())) {
      failures.push(`${file}:${line}: missing anchor #${anchor} in ${relative(root, resolved)}`);
    }
  }
  return failures;
}

export function maintainedMarkdown(root) {
  const out = [];
  const walk = directory => {
    for (const name of readdirSync(join(root, directory))) {
      if (["node_modules", ".git", "artifacts", "dist", ".kilo", ".maintenance-local", ".vercel", "coverage"].includes(name)) continue;
      const path = directory ? `${directory}/${name}` : name;
      if (statSync(join(root, path)).isDirectory()) walk(path);
      else if (name.endsWith(".md")) out.push(path.split(sep).join("/"));
    }
  };
  walk("");
  return out.filter(file => !EXCLUDED_PREFIXES.some(prefix => file.startsWith(prefix)));
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const files = maintainedMarkdown(root);
  const failures = files.flatMap(file => checkFile(root, file));
  if (failures.length) { for (const failure of failures) console.error(`FAIL: ${failure}`); process.exit(1); }
  console.log(`PASS: relative links and anchors resolve in ${files.length} maintained Markdown files`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
