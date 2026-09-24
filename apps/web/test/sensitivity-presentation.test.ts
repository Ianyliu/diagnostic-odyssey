import assert from "node:assert/strict";
import test from "node:test";
import { formatSensitivityInput } from "../src/data/sensitivityPresentation.ts";

test("reach sensitivity labels preserve the exact evaluated planning fraction", () => {
  assert.equal(formatSensitivityInput("reach", 0.25), "25% (0.25)");
  assert.equal(formatSensitivityInput("reach", 0.251), "25.1% (0.251)");
  assert.equal(
    formatSensitivityInput("reach", 0.0000004),
    "0.00004% (4e-7)"
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
