import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertValidArtifactBundle } from "./index.ts";

const candidate = process.argv[2];
if (!candidate) {
  console.error("Usage: node --experimental-strip-types packages/contracts/src/validate-artifact-cli.ts <bundle.json>");
  process.exit(2);
}

const path = resolve(candidate);
const value: unknown = JSON.parse(readFileSync(path, "utf8"));
assertValidArtifactBundle(value);
console.log(`Validated Diagnostic Odyssey artifact: ${path}`);
