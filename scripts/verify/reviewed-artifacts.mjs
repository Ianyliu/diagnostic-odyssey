#!/usr/bin/env node
/**
 * Verify immutable reviewed artifacts against an explicit, authoritative inventory.
 *
 * Replaces hand-copied `sha256sum -c` blocks in CI. Unlike a discovery loop, this
 * can never silently check fewer artifacts than expected: a missing directory,
 * missing SHA256SUMS, missing/extra/mismatched file, or an unlisted artifact
 * directory is a failure. Works on macOS and Linux (no `sha256sum` dependency).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function parseSums(text) {
  const entries = new Map();
  const problems = [];
  for (const [index, raw] of text.split("\n").entries()) {
    if (!raw.trim()) continue;
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(raw);
    if (!match) { problems.push(`malformed SHA256SUMS line ${index + 1}`); continue; }
    const [, digest, name] = match;
    if (entries.has(name)) problems.push(`duplicate SHA256SUMS entry: ${name}`);
    entries.set(name, digest);
  }
  return { entries, problems };
}

/**
 * @param {{reviewedRoot: string, inventory: {artifacts: {directory: string, sums_sha256?: string, files: string[]}[]}}} options
 * @returns {{ok: boolean, checkedFiles: number, checkedArtifacts: number, failures: string[]}}
 */
export function verifyReviewedArtifacts({ reviewedRoot, inventory }) {
  const failures = [];
  let checkedFiles = 0;
  let checkedArtifacts = 0;
  if (!Array.isArray(inventory?.artifacts) || inventory.artifacts.length === 0) {
    return { ok: false, checkedFiles, checkedArtifacts, failures: ["inventory lists no artifacts"] };
  }
  const listed = new Set(inventory.artifacts.map(item => item.directory));
  if (listed.size !== inventory.artifacts.length) failures.push("inventory contains duplicate directories");
  if (!existsSync(reviewedRoot)) {
    return { ok: false, checkedFiles, checkedArtifacts, failures: [`reviewed artifact root missing: ${reviewedRoot}`] };
  }
  for (const entry of readdirSync(reviewedRoot)) {
    if (statSync(join(reviewedRoot, entry)).isDirectory() && !listed.has(entry)) {
      failures.push(`artifact directory not in inventory: ${entry}`);
    }
  }
  for (const item of inventory.artifacts) {
    const directory = join(reviewedRoot, item.directory);
    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
      failures.push(`${item.directory}: directory missing`);
      continue;
    }
    const sumsPath = join(directory, "SHA256SUMS");
    if (!existsSync(sumsPath)) { failures.push(`${item.directory}: SHA256SUMS missing`); continue; }
    const sumsBytes = readFileSync(sumsPath);
    if (item.sums_sha256 && sha256(sumsBytes) !== item.sums_sha256) {
      failures.push(`${item.directory}: SHA256SUMS content differs from inventory pin`);
    }
    const { entries, problems } = parseSums(sumsBytes.toString("utf8"));
    for (const problem of problems) failures.push(`${item.directory}: ${problem}`);
    const expected = new Set(item.files);
    for (const name of expected) {
      if (!entries.has(name)) failures.push(`${item.directory}: ${name} not listed in SHA256SUMS`);
    }
    for (const name of entries.keys()) {
      if (!expected.has(name)) failures.push(`${item.directory}: SHA256SUMS lists unexpected file ${name}`);
    }
    for (const name of readdirSync(directory)) {
      if (name !== "SHA256SUMS" && !expected.has(name)) failures.push(`${item.directory}: unexpected file ${name}`);
    }
    for (const name of expected) {
      const digest = entries.get(name);
      const filePath = join(directory, name);
      if (!existsSync(filePath)) { failures.push(`${item.directory}: ${name} missing`); continue; }
      if (digest === undefined) continue;
      checkedFiles += 1;
      if (sha256(readFileSync(filePath)) !== digest) failures.push(`${item.directory}: ${name} checksum mismatch`);
    }
    checkedArtifacts += 1;
  }
  return { ok: failures.length === 0, checkedFiles, checkedArtifacts, failures };
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../..");
  const inventory = JSON.parse(readFileSync(join(here, "reviewed-artifacts.inventory.json"), "utf8"));
  const result = verifyReviewedArtifacts({ reviewedRoot: join(root, "artifacts/reviewed"), inventory });
  if (!result.ok) {
    for (const failure of result.failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log(`PASS: ${result.checkedFiles} files across ${result.checkedArtifacts} reviewed artifacts match the authoritative inventory`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
