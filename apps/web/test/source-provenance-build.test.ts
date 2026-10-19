import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findSourceRoot, readGitSource, resolveBuildProvenance } from "../build/sourceProvenance.ts";

const shaA = "1c885c604dd6cc71fd64de044d0e9c6b320c8f0c";
const shaB = "2c885c604dd6cc71fd64de044d0e9c6b320c8f0c";

function inputs(overrides: Partial<Parameters<typeof resolveBuildProvenance>[0]> = {}) {
  return { envSha: undefined, explicitBuildDate: undefined, gitSha: null, gitCommitDate: null, ...overrides };
}

function temporaryDirectory(callback: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "do-source-provenance-"));
  try { callback(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

function createGitCommit(directory: string): string {
  execFileSync("git", ["init", "-q", directory]);
  writeFileSync(join(directory, "example.txt"), "source test\n");
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    GIT_AUTHOR_DATE: "2026-10-17T12:00:00+00:00",
    GIT_COMMITTER_DATE: "2026-10-17T12:00:00+00:00"
  };
  execFileSync("git", ["-C", directory, "add", "example.txt"], { env });
  execFileSync("git", ["-C", directory, "commit", "-q", "-m", "fixture"], { env });
  return execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

test("native Git checkout uses exact HEAD and keeps source commit/build dates separate", () => {
  temporaryDirectory(directory => {
    const expectedSha = createGitCommit(directory);
    const git = readGitSource(directory);
    assert.equal(git.gitSha, expectedSha);
    assert.equal(git.gitCommitDate, "2026-10-17");
    assert.deepEqual(resolveBuildProvenance(inputs({ ...git, explicitBuildDate: "2026-10-19" })), {
      sourceSha: expectedSha, sourceCommitDate: "2026-10-17", buildDate: "2026-10-19"
    });
    assert.deepEqual(resolveBuildProvenance(inputs({ ...git, envSha: expectedSha.toUpperCase() })), {
      sourceSha: expectedSha, sourceCommitDate: "2026-10-17", buildDate: null
    });
  });
});

test("archive without .git accepts exact source SHA but cannot infer a commit date", () => {
  temporaryDirectory(parent => {
    createGitCommit(parent);
    const archive = join(parent, "archive");
    const nested = join(archive, "apps", "web");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(archive, "package.json"), "{}\n");
    writeFileSync(join(nested, "vite.config.ts"), "// archive fixture\n");
    assert.equal(findSourceRoot(nested), archive);
    assert.equal(existsSync(join(archive, ".git")), false);
    const git = readGitSource(archive);
    assert.deepEqual(git, { gitSha: null, gitCommitDate: null });
    assert.deepEqual(resolveBuildProvenance(inputs({ ...git, envSha: shaA })), {
      sourceSha: shaA, sourceCommitDate: null, buildDate: null
    });
  });
});

test("malformed or empty VITE_SOURCE_SHA overrides fail instead of silently using Git", () => {
  for (const bad of ["", "12345678", shaA + " ", " " + shaA, "x".repeat(40), "0x" + shaA, shaA + "/evil"]) {
    assert.throws(
      () => resolveBuildProvenance(inputs({ envSha: bad, gitSha: shaA })),
      /VITE_SOURCE_SHA must be exactly 40 hexadecimal characters/
    );
  }
});

test("a valid but conflicting Git HEAD stops the build", () => {
  assert.throws(
    () => resolveBuildProvenance(inputs({ envSha: shaA, gitSha: shaB, gitCommitDate: "2026-10-17" })),
    /VITE_SOURCE_SHA conflicts with the checked-out Git HEAD/
  );
});

test("no Git and no supplied revision truthfully yield no source identity", () => {
  assert.deepEqual(resolveBuildProvenance(inputs()), {
    sourceSha: null, sourceCommitDate: null, buildDate: null
  });
  assert.deepEqual(resolveBuildProvenance(inputs({ gitSha: "malformed", gitCommitDate: "2026-10-17" })), {
    sourceSha: null, sourceCommitDate: null, buildDate: null
  });
});

test("invalid dates fail closed and unverified commit dates are not displayed", () => {
  for (const badDate of ["2026-02-30", "2026-1-19", "2026-13-01", "tomorrow", ""]) {
    assert.throws(
      () => resolveBuildProvenance(inputs({ envSha: shaA, explicitBuildDate: badDate })),
      /VITE_BUILD_DATE must be a real UTC date/
    );
  }
  assert.deepEqual(resolveBuildProvenance(inputs({ envSha: shaA, gitCommitDate: "2026-10-17" })), {
    sourceSha: shaA, sourceCommitDate: null, buildDate: null
  });
});

test("repeated resolution with identical inputs is deterministic", () => {
  const values = inputs({ envSha: shaA, gitSha: shaA, gitCommitDate: "2026-10-17" });
  const first = JSON.stringify(resolveBuildProvenance(values));
  assert.equal(JSON.stringify(resolveBuildProvenance(values)), first);
  assert.doesNotMatch(first, /2026-10-19/);
});
