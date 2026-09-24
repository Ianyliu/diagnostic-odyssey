import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  formatSensitivityInput,
  getSensitivityBarWidth
} from "../src/data/sensitivityPresentation.ts";

const explorerSource = readFileSync(
  fileURLToPath(new URL("../src/components/SensitivityExplorer.tsx", import.meta.url)),
  "utf8"
);

test("reach sensitivity labels preserve the exact evaluated planning fraction", () => {
  assert.equal(formatSensitivityInput("reach", 0.25), "25% (0.25)");
  assert.equal(formatSensitivityInput("reach", 0.251), "25.1% (0.251)");
  assert.equal(
    formatSensitivityInput("reach", 0.0000004),
    "0.00004% (0.0000004)"
  );
  assert.equal(formatSensitivityInput("reach", 0), "0% (0)");
  assert.equal(
    formatSensitivityInput("reach", 0.9999996),
    "99.99996% (0.9999996)"
  );
  assert.notEqual(
    formatSensitivityInput("reach", 0),
    formatSensitivityInput("reach", 0.0000004)
  );
});

test("non-reach sensitivity labels retain compact deterministic formatting", () => {
  assert.equal(formatSensitivityInput("capacity", 3000), "3,000");
  assert.equal(
    formatSensitivityInput("alternative_window_months", 5.1),
    "5.1 mo"
  );
});


test("sensitivity bar widths stay finite, non-negative, and bounded", () => {
  assert.equal(getSensitivityBarWidth(0, 0), 0);
  assert.equal(getSensitivityBarWidth(-1, 0), 0);
  assert.equal(getSensitivityBarWidth(0, 10), 0);
  assert.equal(getSensitivityBarWidth(5, 10), 50);
  assert.equal(getSensitivityBarWidth(10, 10), 100);
  assert.equal(getSensitivityBarWidth(20, 10), 100);
  assert.equal(getSensitivityBarWidth(Number.NaN, 10), 0);
  assert.equal(getSensitivityBarWidth(5, Number.NaN), 0);
  assert.equal(getSensitivityBarWidth(Number.POSITIVE_INFINITY, 10), 0);
  assert.equal(getSensitivityBarWidth(5, Number.POSITIVE_INFINITY), 0);
  assert.equal(getSensitivityBarWidth(Number.NEGATIVE_INFINITY, 10), 0);

  for (const [output, maxOutput] of [
    [0, 0],
    [-1, 0],
    [0, 10],
    [5, 10],
    [10, 10],
    [Number.NaN, 10],
    [5, Number.NaN],
    [5, Number.POSITIVE_INFINITY]
  ]) {
    const width = getSensitivityBarWidth(output, maxOutput);
    const cssWidth = `${width}%`;
    assert.doesNotMatch(cssWidth, /NaN%|Infinity%|-Infinity%/);
  }
});

test("SensitivityExplorer uses the tested width invariant for rendered CSS", () => {
  assert.match(explorerSource, /getSensitivityBarWidth\(output, maxOutput\)/);
  assert.doesNotMatch(
    explorerSource,
    /maxOutput > 0 \? \(output \/ maxOutput\) \* 100 : 0/
  );
});
