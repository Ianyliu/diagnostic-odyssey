/**
 * The Strategy Lab page is composed of PilotPage.tsx (state, effects, orchestration) and the
 * presentational modules under src/pages/pilot/. Source-text contract tests must assert over
 * the whole page, not only the entry file, so that relocating markup into a module can neither
 * hide a forbidden pattern nor silently drop a required one.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pagesDirectory = fileURLToPath(new URL("../../src/pages/", import.meta.url));

/** File paths (relative to src/pages) of every source file that makes up the Strategy Lab. */
export function pilotSourceFiles(): string[] {
  const modules = readdirSync(`${pagesDirectory}pilot`)
    .filter(name => /\.(?:ts|tsx)$/.test(name))
    .sort()
    .map(name => `pilot/${name}`);
  return ["PilotPage.tsx", ...modules];
}

/** Paths relative to apps/web/test, for tests that iterate over source files. */
export function pilotSourcePathsFromTests(): string[] {
  return pilotSourceFiles().map(file => `../src/pages/${file}`);
}

export function readPilotFile(file: string): string {
  return readFileSync(`${pagesDirectory}${file}`, "utf8");
}

/** Entry file followed by every pilot module, joined in a deterministic order. */
export function readPilotSource(): string {
  return pilotSourceFiles().map(readPilotFile).join("\n");
}
