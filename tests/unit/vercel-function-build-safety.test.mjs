// Regression tests for scripts/verify/vercel-function-build.sh: it must never touch an existing
// apps/web/.vercel directory, never copy .env files, never read the developer's Vercel login, and
// must clean up only its own temporary directory on success, failure and interruption.
// A fake Vercel CLI (VERCEL_BIN) stands in for the real one, so these tests are offline.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SENTINEL = {
  "apps/web/.vercel/project.json": '{"projectId":"prj_REAL_LINKAGE","orgId":"team_REAL"}\n',
  "apps/web/.vercel/.env.preview.local": "AI_CHALLENGE_SECRET=sentinel-secret-must-not-leak\n",
  "apps/web/.vercel/output/keep.txt": "previous local build output\n",
  "apps/web/.env.local": "GEMINI_API_KEY=sentinel-secret-must-not-leak\n"
};

const FAKE_CLI = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const cwd = args[args.indexOf("--cwd") + 1];
const globalConfig = args[args.indexOf("--global-config") + 1];
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.name === "node_modules") return [];
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const srcRoot = path.resolve(cwd, "..", "..");
const files = walk(srcRoot).map(file => path.relative(srcRoot, file));
const leaked = files.filter(file => fs.readFileSync(path.join(srcRoot, file), "utf8").includes("sentinel-secret"));
fs.writeFileSync(process.env.FAKE_LOG, JSON.stringify({ cwd, globalConfig, files, leaked,
  project: fs.readFileSync(path.join(cwd, ".vercel/project.json"), "utf8") }));
if (process.env.FAKE_MODE === "fail") process.exit(1);
if (process.env.FAKE_MODE === "hang") { setTimeout(() => {}, 60000); return; }
const out = path.join(cwd, ".vercel/output");
for (const name of ["ai-guidance", "ai-preview"]) {
  const dir = path.join(out, "functions/api", name + ".func");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, ".vc-config.json"), JSON.stringify({ handler: "index.mjs", runtime: "nodejs22.x" }));
  fs.writeFileSync(path.join(dir, "index.mjs"), "export default function handler() {}\\n");
}
fs.writeFileSync(path.join(out, "config.json"), JSON.stringify({ routes: [
  { headers: { "Content-Security-Policy": "x", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" } },
  { src: "/(.*)", dest: "/index.html?path=$1" }, { src: "/api/(.*)", status: 404 }] }));
`;

function snapshot(root) {
  const result = {};
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else result[full.slice(root.length + 1)] = { text: readFileSync(full, "utf8"), mtimeMs: statSync(full).mtimeMs };
    }
  };
  walk(join(root, "apps/web/.vercel"));
  result["apps/web/.env.local"] = { text: readFileSync(join(root, "apps/web/.env.local"), "utf8"), mtimeMs: statSync(join(root, "apps/web/.env.local")).mtimeMs };
  return result;
}

function makeFixture() {
  const base = mkdtempSync(join(tmpdir(), "vercel-safety-"));
  const root = join(base, "repo");
  const scratchTmp = join(base, "tmp");
  mkdirSync(scratchTmp);
  mkdirSync(join(root, "scripts/verify"), { recursive: true });
  mkdirSync(join(root, "apps/web/api"), { recursive: true });
  mkdirSync(join(root, "node_modules"), { recursive: true });
  copyFileSync(join(repoRoot, "scripts/verify/vercel-function-build.sh"), join(root, "scripts/verify/vercel-function-build.sh"));
  writeFileSync(join(root, ".gitignore"), "node_modules/\n.env\n.env.*\n!.env.example\n.vercel/\n");
  writeFileSync(join(root, "apps/web/package.json"), "{}\n");
  writeFileSync(join(root, "apps/web/api/ai-guidance.ts"), "export default function handler() {}\n");
  writeFileSync(join(root, "apps/web/.env.example"), "GEMINI_API_KEY=\n");
  for (const [file, text] of Object.entries(SENTINEL)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });
  const fake = join(base, "fake-vercel");
  writeFileSync(fake, FAKE_CLI);
  chmodSync(fake, 0o755);
  return { base, root, scratchTmp, fake, log: join(base, "fake.log"), before: snapshot(root) };
}

function start(fixture, mode) {
  return spawn("bash", [join(fixture.root, "scripts/verify/vercel-function-build.sh")], {
    env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}`, TMPDIR: fixture.scratchTmp,
      VERCEL_BIN: fixture.fake, FAKE_MODE: mode, FAKE_LOG: fixture.log },
    stdio: ["ignore", "pipe", "pipe"]
  });
}
const finished = child => new Promise(resolve => {
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  child.on("close", (code, signal) => resolve({ code, signal, output }));
});

function assertSafe(fixture) {
  assert.deepEqual(snapshot(fixture.root), fixture.before, "pre-existing .vercel and .env files must be unchanged");
  assert.deepEqual(readdirSync(fixture.scratchTmp), [], "the temporary workdir must be removed");
  const seen = JSON.parse(readFileSync(fixture.log, "utf8"));
  assert.ok(seen.cwd.startsWith(fixture.scratchTmp) || seen.cwd.includes("/vercel-function-build."), `build ran outside the temp copy: ${seen.cwd}`);
  assert.ok(!seen.cwd.startsWith(fixture.root), "build must not run in the repository");
  assert.ok(seen.globalConfig.includes("/vercel-function-build."), "CLI must use a private global config");
  assert.deepEqual(seen.leaked, [], "no secret-bearing file may be copied into the build tree");
  assert.ok(!seen.files.some(file => /(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".env.example")), `env file copied: ${seen.files}`);
  assert.ok(seen.files.includes("apps/web/api/ai-guidance.ts"), "tracked sources are copied");
  assert.match(seen.project, /prj_localbuildonly/, "only the throwaway project descriptor is visible to the build");
}

test("success leaves an existing .vercel directory and env files untouched and cleans up", async () => {
  const fixture = makeFixture();
  try {
    const result = await finished(start(fixture, "ok"));
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /PASS: function inventory, routing config and runtime resolution/);
    assertSafe(fixture);
  } finally { rmSync(fixture.base, { recursive: true, force: true }); }
});

test("a failing build still leaves .vercel untouched and cleans up", async () => {
  const fixture = makeFixture();
  try {
    const result = await finished(start(fixture, "fail"));
    assert.notEqual(result.code, 0);
    assert.match(result.output, /FAIL: vercel build exited nonzero/);
    assertSafe(fixture);
  } finally { rmSync(fixture.base, { recursive: true, force: true }); }
});

test("interruption (SIGTERM) during the build stops promptly, cleans up and leaves .vercel untouched", async () => {
  const fixture = makeFixture();
  try {
    const child = start(fixture, "hang");
    const done = finished(child);
    const deadline = Date.now() + 15000;
    while (!existsSync(fixture.log)) {
      assert.ok(Date.now() < deadline, "fake CLI never started");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    child.kill("SIGTERM");
    const result = await Promise.race([done, new Promise(resolve => setTimeout(() => resolve({ code: "timeout" }), 10000))]);
    assert.equal(result.code, 143, `expected exit 143, got ${result.code}`);
    assertSafe(fixture);
  } finally { rmSync(fixture.base, { recursive: true, force: true }); }
});
