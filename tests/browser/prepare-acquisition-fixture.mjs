/* global console */
import { mkdir, writeFile } from "node:fs/promises";
import { URL } from "node:url";
import { fixture, context, scenario } from "../../packages/acquisition-hints/test/fixture.ts";
const output = new URL("../../artifacts/generated/acquisition-browser-fixture/", import.meta.url);
await mkdir(output, {recursive:true});
await writeFile(new URL("fixture.json", output), JSON.stringify({...fixture(), context, scenario}));
console.log("Prepared synthetic test-only fixture; no production release or allowlist changed.");
