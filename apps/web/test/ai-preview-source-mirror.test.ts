import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {test} from "node:test";
const here = dirname(fileURLToPath(import.meta.url));
const parts = ["index.ts", "guards.ts", "types.ts"];
test("preview server validator exactly mirrors independently reviewed planning-guidance", () => {
 for (const name of parts) {
  const original = readFileSync(resolve(here, "../../../packages/planning-guidance/src", name));
  const local = readFileSync(resolve(here, "../src/server/planning-guidance", name));
  assert.deepEqual(local, original, `${name} must remain byte-for-byte identical`);
 }
});
