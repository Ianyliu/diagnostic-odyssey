import fs from "node:fs";
import {assertValidLinkedConditionCandidate} from "./linked-condition-candidate.ts";

const estimatesPath = process.argv[2];
const manifestPath = process.argv[3];
if (!estimatesPath || !manifestPath) {
  throw new Error(
    "Usage: validate-linked-condition-candidate-cli.ts <linked-condition-candidate-estimates.json> <candidate-manifest.json>"
  );
}

const estimates = JSON.parse(fs.readFileSync(estimatesPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assertValidLinkedConditionCandidate(estimates, manifest);
console.log("Linked-condition candidate artifact is contract-valid.");
