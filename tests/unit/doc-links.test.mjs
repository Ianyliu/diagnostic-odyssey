import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { anchorsOf, checkFile, linksOf, maintainedMarkdown, slugify } from "../../scripts/verify/doc-links.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "doc-links-"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return root;
}

test("slugs and anchors follow GitHub conventions, ignoring fenced code and numbering duplicates", () => {
  assert.equal(slugify("Browser acceptance"), "browser-acceptance");
  assert.equal(slugify("What `npm run check` covers"), "what-npm-run-check-covers");
  const anchors = anchorsOf("# Title\n## Same\n## Same\n```\n# not a heading\n```\n");
  assert.deepEqual([...anchors].sort(), ["same", "same-1", "title"]);
});

test("detects missing files and missing anchors but ignores external links and code spans", () => {
  const root = fixture({
    "a.md": "[ok](b.md#real) [missing](nope.md) [bad anchor](b.md#absent) [web](https://example.invalid/x) `[code](ghost.md)`\n",
    "b.md": "# Real\n"
  });
  try {
    const failures = checkFile(root, "a.md");
    assert.equal(failures.length, 2);
    assert.match(failures.join("\n"), /missing target nope\.md/);
    assert.match(failures.join("\n"), /missing anchor #absent in b\.md/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("links inside fenced blocks are not checked and in-page anchors are", () => {
  assert.deepEqual(linksOf("```\n[x](gone.md)\n```\n[y](#here)\n").map(link => link.target), ["#here"]);
  const root = fixture({ "a.md": "# Here\n[self](#here) [bad](#there)\n" });
  try { assert.equal(checkFile(root, "a.md").length, 1); } finally { rmSync(root, { recursive: true, force: true }); }
});

test("historical archives are excluded from the maintained set", () => {
  const root = fixture({ "README.md": "x", "docs/guided-workspace/old.md": "x", "docs/audit-2026-10-16/a.md": "x", "docs/testing.md": "x" });
  try { assert.deepEqual(maintainedMarkdown(root).sort(), ["README.md", "docs/testing.md"]); } finally { rmSync(root, { recursive: true, force: true }); }
});
