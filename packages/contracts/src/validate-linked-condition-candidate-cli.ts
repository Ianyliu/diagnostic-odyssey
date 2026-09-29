import fs from "node:fs";
import {assertValidLinkedConditionCandidate} from "./linked-condition-candidate.ts";

const estimatesPath = process.argv[2];
const manifestPath = process.argv[3];
const diagnosticsPath = process.argv[4];
if (!estimatesPath || !manifestPath || !diagnosticsPath) {
  throw new Error(
    "Usage: validate-linked-condition-candidate-cli.ts <linked-condition-candidate-estimates.json> <candidate-manifest.json> <diagnostics.json>"
  );
}

const estimates = JSON.parse(fs.readFileSync(estimatesPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, "utf8"));
assertValidLinkedConditionCandidate(estimates, manifest, diagnostics);
console.log("Linked-condition candidate artifact is contract-valid.");
