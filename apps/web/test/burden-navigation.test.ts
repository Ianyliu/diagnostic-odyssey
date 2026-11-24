import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/BurdenPage.tsx", import.meta.url), "utf8");

test("Costs page exposes Apple segmented domain pills for Spending, Time, and Wellbeing", () => {
  for (const label of ["All domains", "Spending", "Time", "Wellbeing"]) {
    assert.ok(page.includes(label), `Missing segmented pill: ${label}`);
  }
  assert.match(page, /role="group" aria-label="Filter burden domains"/);
});

test("BurdenPage preserves U09 secondary navigation, whisker plot, and measure cards", () => {
  assert.match(page, /to="\/burden\/medical"/);
  assert.match(page, /to="\/burden\/medical#linked-condition-secondary-heading"/);
  assert.match(page, /<IntervalWhiskerPlot/);
  assert.match(page, /<BurdenMeasureList estimates=\{domain\.measures\} \/>/);
});
