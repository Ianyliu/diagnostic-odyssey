import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/BurdenPage.tsx", import.meta.url), "utf8");

test("BurdenPage uses interactive domain filter tabs with Telemetry Grid and Right Inspector", () => {
  assert.match(page, /role="tablist" aria-label="Filter burden domain"/);
  assert.match(page, /className="telemetry-grid"/);
  assert.match(page, /className="inspector-panel"/);
});

test("direct burden links preserve standalone domain pages and U09 secondary navigation", () => {
  assert.match(page, /to="\/burden\/admin"/);
  assert.match(page, /to="\/burden\/human"/);
  assert.match(page, /to="\/burden\/medical#linked-condition-secondary-heading"/);
  assert.match(page, /to="\/evidence"/);
  assert.match(page, /to="\/local-context"/);
});
