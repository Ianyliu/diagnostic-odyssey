import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  getPilotFragmentTargetId,
  SENSITIVITY_FRAGMENT
} from "../src/data/pilotFragmentScroll.ts";

const pilotSource = readFileSync(
  fileURLToPath(new URL("../src/pages/PilotPage.tsx", import.meta.url)),
  "utf8"
);

test("Pilot fragment helper recognizes only the sensitivity target", () => {
  assert.equal(SENSITIVITY_FRAGMENT, "#sensitivity");
  assert.equal(getPilotFragmentTargetId("#sensitivity"), "sensitivity");
  assert.equal(getPilotFragmentTargetId(""), null);
  assert.equal(getPilotFragmentTargetId("#other"), null);
});

test("PilotPage explicitly scrolls the sensitivity fragment after scenario content is ready", () => {
  assert.match(pilotSource, /useLocation\(\)/);
  assert.match(pilotSource, /getPilotFragmentTargetId\(location\.hash\)/);
  assert.match(pilotSource, /document\.getElementById\(targetId\)\?\.scrollIntoView/);
  assert.match(pilotSource, /\[location\.hash, sensitivityReady\]/);
  assert.match(pilotSource, /id="sensitivity"/);
});
