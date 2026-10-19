import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
const get = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("Administrative and human domains remain visible with the existing disclosures", () => {
  const page = get("../src/pages/BurdenPage.tsx");
  const detail = get("../src/pages/DomainPage.tsx");
  assert.match(page, /burden-domain-spotlight/);
  assert.match(page, /defaultOpen=\{index !== 0\}/);
  assert.match(page, /<WorkspaceDisclosure/);
  assert.match(page, /<BurdenMeasureList estimates=\{domain\.measures\} \/>/);
  assert.match(page, /<summary>Domain interpretation boundaries<\/summary>/);
  assert.match(detail, /<h2>Reviewed measures<\/h2>/);
  assert.doesNotMatch(page, /<h2>\{domain\.label\}<\/h2>/);
  assert.match(page, /not a diagnosis/i);
  assert.match(page, /not added together/i);
});
