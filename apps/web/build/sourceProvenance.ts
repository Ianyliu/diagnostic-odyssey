import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface GitSource {
  gitSha: string | null;
  gitCommitDate: string | null;
}

export interface ProvenanceInputs extends GitSource {
  envSha: string | undefined;
  explicitBuildDate: string | undefined;
}

export interface ResolvedBuildProvenance {
  sourceSha: string | null;
  sourceCommitDate: string | null;
  buildDate: string | null;
}

function isSha(value: string): boolean {
  return /^[0-9a-fA-F]{40}$/.test(value);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Locate the checked-out or extracted project, regardless of the build's working directory. */
export function findSourceRoot(startDirectory: string): string {
  let directory = resolve(startDirectory);
  for (;;) {
    if (existsSync(join(directory, "apps", "web", "vite.config.ts")) &&
        existsSync(join(directory, "package.json"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Cannot locate Diagnostic Odyssey source root");
    directory = parent;
  }
}

/** Never use a parent repository's HEAD to label an extracted source archive. */
export function readGitSource(sourceRoot: string): GitSource {
  if (!existsSync(join(sourceRoot, ".git"))) return { gitSha: null, gitCommitDate: null };
  const read = (...args: string[]): string | null => {
    try {
      return execFileSync("git", ["-C", sourceRoot, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2000
      }).trim();
    } catch {
      return null;
    }
  };
  return {
    gitSha: read("rev-parse", "--verify", "HEAD"),
    gitCommitDate: read("show", "-s", "--format=%cs", "HEAD")
  };
}

/**
 * Trust only complete source identities. A caller-provided revision is required
 * for archive builds; a conflicting native Git checkout must stop the build.
 * Source commit date never substitutes for the actual, explicitly supplied build date.
 */
export function resolveBuildProvenance(input: ProvenanceInputs): ResolvedBuildProvenance {
  if (input.envSha !== undefined && !isSha(input.envSha)) {
    throw new Error("VITE_SOURCE_SHA must be exactly 40 hexadecimal characters");
  }
  const envSha = input.envSha?.toLowerCase() ?? null;
  const gitSha = input.gitSha && isSha(input.gitSha) ? input.gitSha.toLowerCase() : null;
  if (envSha && gitSha && envSha !== gitSha) {
    throw new Error("VITE_SOURCE_SHA conflicts with the checked-out Git HEAD");
  }
  if (input.explicitBuildDate !== undefined && !isCalendarDate(input.explicitBuildDate)) {
    throw new Error("VITE_BUILD_DATE must be a real UTC date in YYYY-MM-DD format");
  }
  const sourceSha = envSha ?? gitSha;
  return {
    sourceSha,
    sourceCommitDate: sourceSha && gitSha === sourceSha && input.gitCommitDate &&
      isCalendarDate(input.gitCommitDate) ? input.gitCommitDate : null,
    buildDate: input.explicitBuildDate ?? null
  };
}
