import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const briefSource = readFileSync(
  fileURLToPath(new URL("../src/pages/BriefPage.tsx", import.meta.url)),
  "utf8"
);

test("Planning Brief keeps confidence-interval accessibility regex escapes", () => {
  assert.ok(
    briefSource.includes(
      String.raw`.replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ")`
    )
  );
  assert.ok(
    briefSource.includes(
      String.raw`.replace(/^CI\s*/, "Confidence interval: ")`
    )
  );
});
