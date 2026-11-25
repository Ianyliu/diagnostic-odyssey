import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("../src/pages/BurdenPage.tsx", import.meta.url), "utf8");

test("Costs page provides clean category tabs and slide-over methodology drawer", () => {
  for (const label of ["All", "Medical", "Time", "Human"]) {
    assert.ok(page.includes(label), label);
  }
  assert.match(page, /<DetailDrawer/);
  assert.match(page, /Methods &amp; Limits/);
});

test("direct burden links preserve standalone domain pages and U09 secondary navigation", () => {
  assert.match(page, /to="\/burden\/medical#linked-condition-secondary-heading"/);
  assert.match(page, /to="\/evidence"/);
  assert.match(page, /to="\/local-context"/);
  assert.match(page, /<BurdenMeasureList\s+estimates=\{domain\.measures\}/);
});
