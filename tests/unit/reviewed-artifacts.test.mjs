import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifyReviewedArtifacts } from "../../scripts/verify/reviewed-artifacts.mjs";

const sha = text => createHash("sha256").update(text).digest("hex");

function makeRoot(files = { "a.json": "alpha", "b.json": "beta" }) {
  const root = mkdtempSync(join(tmpdir(), "reviewed-artifacts-"));
  const directory = join(root, "release-1");
  mkdirSync(directory);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(directory, name), text);
  const sums = Object.entries(files).map(([name, text]) => `${sha(text)}  ${name}\n`).join("");
  writeFileSync(join(directory, "SHA256SUMS"), sums);
  const inventory = { artifacts: [{ directory: "release-1", sums_sha256: sha(sums), files: Object.keys(files).sort() }] };
  return { root, directory, inventory, sums };
}
const run = ({ root, inventory }) => verifyReviewedArtifacts({ reviewedRoot: root, inventory });
const cleanup = fixture => rmSync(fixture.root, { recursive: true, force: true });

test("accepts a complete, matching inventory and counts every file", () => {
  const fixture = makeRoot();
  try {
    const result = run(fixture);
    assert.deepEqual(result.failures, []);
    assert.equal(result.ok, true);
    assert.equal(result.checkedFiles, 2);
    assert.equal(result.checkedArtifacts, 1);
  } finally { cleanup(fixture); }
});

test("fails when a required artifact directory disappears", () => {
  const fixture = makeRoot();
  try {
    rmSync(fixture.directory, { recursive: true });
    assert.match(run(fixture).failures.join("\n"), /release-1: directory missing/);
  } finally { cleanup(fixture); }
});

test("fails when SHA256SUMS is missing, so a release can never be skipped silently", () => {
  const fixture = makeRoot();
  try {
    rmSync(join(fixture.directory, "SHA256SUMS"));
    assert.match(run(fixture).failures.join("\n"), /SHA256SUMS missing/);
  } finally { cleanup(fixture); }
});

test("fails on a missing, modified, or unexpected file", () => {
  let fixture = makeRoot();
  try {
    rmSync(join(fixture.directory, "a.json"));
    assert.match(run(fixture).failures.join("\n"), /a\.json missing/);
  } finally { cleanup(fixture); }
  fixture = makeRoot();
  try {
    writeFileSync(join(fixture.directory, "a.json"), "tampered");
    assert.match(run(fixture).failures.join("\n"), /a\.json checksum mismatch/);
  } finally { cleanup(fixture); }
  fixture = makeRoot();
  try {
    writeFileSync(join(fixture.directory, "extra.json"), "x");
    assert.match(run(fixture).failures.join("\n"), /unexpected file extra\.json/);
  } finally { cleanup(fixture); }
});

test("fails when SHA256SUMS drops an entry, even if it is self-consistent", () => {
  const fixture = makeRoot();
  try {
    writeFileSync(join(fixture.directory, "SHA256SUMS"), `${sha("alpha")}  a.json\n`);
    const failures = run(fixture).failures.join("\n");
    assert.match(failures, /b\.json not listed in SHA256SUMS/);
    assert.match(failures, /SHA256SUMS content differs from inventory pin/);
  } finally { cleanup(fixture); }
});

test("fails on an artifact directory that is not in the inventory", () => {
  const fixture = makeRoot();
  try {
    mkdirSync(join(fixture.root, "release-2"));
    assert.match(run(fixture).failures.join("\n"), /artifact directory not in inventory: release-2/);
  } finally { cleanup(fixture); }
});

test("fails closed on an empty inventory or missing root", () => {
  assert.equal(verifyReviewedArtifacts({ reviewedRoot: tmpdir(), inventory: { artifacts: [] } }).ok, false);
  assert.equal(verifyReviewedArtifacts({ reviewedRoot: join(tmpdir(), "does-not-exist-xyz"), inventory: { artifacts: [{ directory: "x", files: [] }] } }).ok, false);
});

test("rejects malformed and duplicate SHA256SUMS lines", () => {
  const fixture = makeRoot();
  try {
    writeFileSync(join(fixture.directory, "SHA256SUMS"), `not-a-digest  a.json\n${sha("alpha")}  a.json\n${sha("alpha")}  a.json\n`);
    const failures = run(fixture).failures.join("\n");
    assert.match(failures, /malformed SHA256SUMS line 1/);
    assert.match(failures, /duplicate SHA256SUMS entry: a\.json/);
  } finally { cleanup(fixture); }
});
