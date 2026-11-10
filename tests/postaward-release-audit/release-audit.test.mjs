import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { after, before, test } from "node:test";
import { auditBuild } from "../../scripts/postaward-release-audit/verifier.mjs";

const here = dirname(fileURLToPath(new URL(import.meta.url)));
const FIXTURES = join(here, "fixtures");
const GOOD_BUILD = join(FIXTURES, "good-build");
const GOOD_MANIFEST = join(FIXTURES, "good-manifest.json");
const EMBEDDED_MANIFEST = join(FIXTURES, "embedded-manifest.json");
const VERIFIER = join(here, "..", "..", "scripts", "postaward-release-audit", "verifier.mjs");

const FIXTURE_SHA = "6f1a3b5c8d2e4f7a0b1c9d3e5f7a0b2c4d6e8f10";
const EMBEDDED_SHA = "0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d";
const WRONG_SHA = "1111111111111111111111111111111111111111";

let tmp;
before(() => {
  tmp = mkdtempSync(join(tmpdir(), "postaward-release-audit-"));
});
after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function copyFixture(name, into) {
  const dest = join(tmp, into);
  cpSync(join(FIXTURES, name), dest, { recursive: true });
  return dest;
}

function listRegularFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(p.slice(resolve(dir).length + 1).split("/").join("/"));
    }
  })(dir);
  return out.sort();
}

function runCli(args) {
  try {
    return { code: 0, stdout: execFileSync(process.execPath, [VERIFIER, ...args], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status, stdout: e.stdout || "", stderr: e.stderr || "" };
  }
}

test("clean fixture build: all local dimensions PASS, localVerdict VERIFIED, overall still UNKNOWN", async () => {
  const build = copyFixture("good-build", "t1-build");
  const out = join(tmp, "t1-receipt.json");
  const receipt = await auditBuild({ buildDir: build, expectedRevision: FIXTURE_SHA, manifestPath: GOOD_MANIFEST, out });
  assert.equal(receipt.auditError, null);
  assert.equal(receipt.dimensions.sourceRevisionMatch.verdict, "PASS");
  assert.equal(receipt.dimensions.sourceRevisionMatch.evidence.recordedFrom, "build-provenance.json");
  assert.equal(receipt.dimensions.sourceStateClean.verdict, "PASS");
  assert.equal(receipt.dimensions.localAssetManifestIntegrity.verdict, "PASS");
  assert.equal(receipt.dimensions.servedByteVerification.verdict, "UNKNOWN");
  assert.equal(receipt.localVerdict, "VERIFIED");
  assert.equal(receipt.overallVerdict, "UNKNOWN");
  assert.equal(receipt.deploymentParityCertified, false);
  assert.equal(receipt.computedAssets.count, 5);
  assert.match(receipt.computedAssets.manifestDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(receipt.recordedToolchain.node, "v22.11.0");
  assert.equal(receipt.recordedToolchain.npm, "10.9.0");
  assert.match(receipt.recordedDependencyLockDigest.value, /^sha256:[0-9a-f]{64}$/);
  const onDisk = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(onDisk, receipt);
});

test("tampered asset: local integrity FAILED, overall FAILED, never VERIFIED", async () => {
  const build = copyFixture("good-build", "t2-build");
  const target = join(build, "assets", "index-0a1b2c3d.js");
  writeFileSync(target, readFileSync(target, "utf8") + "// tampered\n");
  const receipt = await auditBuild({
    buildDir: build,
    expectedRevision: FIXTURE_SHA,
    manifestPath: GOOD_MANIFEST,
    out: join(tmp, "t2-receipt.json")
  });
  const c = receipt.dimensions.localAssetManifestIntegrity;
  assert.equal(c.verdict, "FAILED");
  assert.deepEqual(c.evidence.mismatches.map((m) => m.path), ["assets/index-0a1b2c3d.js"]);
  assert.notEqual(c.evidence.mismatches[0].expected, c.evidence.mismatches[0].actual);
  assert.equal(receipt.localVerdict, "FAILED");
  assert.equal(receipt.overallVerdict, "FAILED");
});

test("asset listed in manifest but missing from build dir: integrity FAILED, overall FAILED", async () => {
  const build = copyFixture("good-build", "t3-build");
  rmSync(join(build, "favicon.svg"));
  const receipt = await auditBuild({
    buildDir: build,
    expectedRevision: FIXTURE_SHA,
    manifestPath: GOOD_MANIFEST,
    out: join(tmp, "t3-receipt.json")
  });
  const c = receipt.dimensions.localAssetManifestIntegrity;
  assert.equal(c.verdict, "FAILED");
  assert.deepEqual(c.evidence.missing, ["favicon.svg"]);
  assert.equal(receipt.overallVerdict, "FAILED");
});

test("unexpected extra asset not in manifest: integrity FAILED (manifest no longer fully describes the build)", async () => {
  const build = copyFixture("good-build", "t4-build");
  writeFileSync(join(build, "assets", "extra-9999.js"), "var x=1;\n");
  const receipt = await auditBuild({
    buildDir: build,
    expectedRevision: FIXTURE_SHA,
    manifestPath: GOOD_MANIFEST,
    out: join(tmp, "t4-receipt.json")
  });
  const c = receipt.dimensions.localAssetManifestIntegrity;
  assert.equal(c.verdict, "FAILED");
  assert.deepEqual(c.evidence.unexpected, ["assets/extra-9999.js"]);
  assert.equal(receipt.overallVerdict, "FAILED");
});

test("stale/mismatched expected revision: sourceRevisionMatch FAILED, overall FAILED", async () => {
  const build = copyFixture("good-build", "t5-build");
  const receipt = await auditBuild({
    buildDir: build,
    expectedRevision: WRONG_SHA,
    manifestPath: GOOD_MANIFEST,
    out: join(tmp, "t5-receipt.json")
  });
  const a = receipt.dimensions.sourceRevisionMatch;
  assert.equal(a.verdict, "FAILED");
  assert.equal(a.evidence.recorded, FIXTURE_SHA);
  assert.equal(a.evidence.expected, WRONG_SHA);
  assert.equal(receipt.overallVerdict, "FAILED");
});

test("corrupted manifest (invalid JSON): integrity UNKNOWN with manifestError, never VERIFIED", async () => {
  const build = copyFixture("good-build", "t6-build");
  const corrupt = join(tmp, "t6-corrupt-manifest.json");
  writeFileSync(corrupt, "{ this is not valid json");
  const receipt = await auditBuild({
    buildDir: build,
    expectedRevision: FIXTURE_SHA,
    manifestPath: corrupt,
    out: join(tmp, "t6-receipt.json")
  });
  const c = receipt.dimensions.localAssetManifestIntegrity;
  assert.equal(c.verdict, "UNKNOWN");
  assert.match(c.evidence.manifestError, /invalid JSON/);
  assert.equal(receipt.localVerdict, "UNKNOWN");
  assert.equal(receipt.overallVerdict, "UNKNOWN");
});

test("build with no recorded revision anywhere: revision match UNKNOWN, never VERIFIED", async () => {
  const build = join(tmp, "t7-build");
  mkdirSync(join(build, "assets"), { recursive: true });
  writeFileSync(join(build, "index.html"), "<!doctype html><html><body>no provenance</body></html>\n");
  writeFileSync(join(build, "assets", "plain-1234.js"), "export const x = 1;\n");
  const receipt = await auditBuild({ buildDir: build, expectedRevision: FIXTURE_SHA, out: join(tmp, "t7-receipt.json") });
  assert.equal(receipt.dimensions.sourceRevisionMatch.verdict, "UNKNOWN");
  assert.equal(receipt.dimensions.sourceStateClean.verdict, "UNKNOWN");
  assert.equal(receipt.dimensions.localAssetManifestIntegrity.verdict, "UNKNOWN");
  assert.equal(receipt.dimensions.servedByteVerification.verdict, "UNKNOWN");
  assert.equal(receipt.localVerdict, "UNKNOWN");
  assert.equal(receipt.overallVerdict, "UNKNOWN");
  assert.equal(receipt.recordedBuildMetadata.source, null);
});

test("recorded dirty source state: sourceStateClean FAILED, overall FAILED", async () => {
  const build = copyFixture("good-build", "t8-build");
  const metaPath = join(build, "build-provenance.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  meta.sourceState = { clean: false, modified: 3, untracked: 1 };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  const receipt = await auditBuild({ buildDir: build, expectedRevision: FIXTURE_SHA, out: join(tmp, "t8-receipt.json") });
  const b = receipt.dimensions.sourceStateClean;
  assert.equal(b.verdict, "FAILED");
  assert.equal(b.evidence.recorded.clean, false);
  assert.equal(receipt.overallVerdict, "FAILED");
});

test("embedded-only build (no build-provenance.json): revision found via bundle scan, clean state stays UNKNOWN", async () => {
  const build = copyFixture("embedded-build", "t9-build");
  const receipt = await auditBuild({
    buildDir: build,
    expectedRevision: EMBEDDED_SHA,
    manifestPath: EMBEDDED_MANIFEST,
    out: join(tmp, "t9-receipt.json")
  });
  const a = receipt.dimensions.sourceRevisionMatch;
  assert.equal(a.verdict, "PASS");
  assert.equal(a.evidence.recordedFrom, "embedded:assets/embedded-11112222.js");
  assert.equal(receipt.recordedBuildMetadata.recordedSourceCommitDate, "2026-10-30");
  assert.equal(receipt.recordedBuildMetadata.recordedBuildDate, null);
  assert.equal(receipt.dimensions.sourceStateClean.verdict, "UNKNOWN");
  assert.equal(receipt.dimensions.localAssetManifestIntegrity.verdict, "PASS");
  assert.equal(receipt.localVerdict, "UNKNOWN");
  assert.equal(receipt.overallVerdict, "UNKNOWN");
});

test("audit writes only the receipt file: build directory is byte-identical afterwards", async () => {
  const build = copyFixture("good-build", "t10-build");
  const before = listRegularFiles(build);
  await auditBuild({
    buildDir: build,
    expectedRevision: FIXTURE_SHA,
    manifestPath: GOOD_MANIFEST,
    out: join(tmp, "t10-receipt.json")
  });
  assert.deepEqual(listRegularFiles(build), before);
  assert.ok(existsSync(join(tmp, "t10-receipt.json")));
  assert.ok(!existsSync(join(build, "receipt.json")));
});

test("missing build directory produces an auditError receipt (no dimension guessed)", async () => {
  const receipt = await auditBuild({
    buildDir: join(tmp, "does-not-exist"),
    expectedRevision: FIXTURE_SHA,
    out: join(tmp, "t11-receipt.json")
  });
  assert.match(receipt.auditError, /does not exist/);
  for (const d of Object.values(receipt.dimensions)) assert.equal(d.verdict, "UNKNOWN");
  assert.equal(receipt.localVerdict, "UNKNOWN");
  assert.equal(receipt.overallVerdict, "UNKNOWN");
});

test("invalid expected revision format is rejected as an audit error", async () => {
  const receipt = await auditBuild({
    buildDir: GOOD_BUILD,
    expectedRevision: "not-a-sha",
    out: join(tmp, "t12-receipt.json")
  });
  assert.match(receipt.auditError, /40 hexadecimal/);
  for (const d of Object.values(receipt.dimensions)) assert.equal(d.verdict, "UNKNOWN");
});

test("CLI exit codes: 0 when overall not FAILED, 1 when FAILED, 2 on audit error", () => {
  const okBuild = copyFixture("good-build", "t13a-build");
  const ok = runCli([
    "--build-dir", okBuild,
    "--expected-revision", FIXTURE_SHA,
    "--manifest", GOOD_MANIFEST,
    "--out", join(tmp, "t13a-receipt.json")
  ]);
  assert.equal(ok.code, 0);
  assert.match(ok.stdout, /overallVerdict=UNKNOWN localVerdict=VERIFIED/);

  const fail = runCli([
    "--build-dir", okBuild,
    "--expected-revision", WRONG_SHA,
    "--manifest", GOOD_MANIFEST,
    "--out", join(tmp, "t13b-receipt.json")
  ]);
  assert.equal(fail.code, 1);
  assert.match(fail.stdout, /overallVerdict=FAILED/);

  const err = runCli(["--build-dir", join(tmp, "no-such-dir"), "--expected-revision", FIXTURE_SHA, "--out", join(tmp, "t13c-receipt.json")]);
  assert.equal(err.code, 2);
  assert.match(err.stderr, /auditError/);
});
