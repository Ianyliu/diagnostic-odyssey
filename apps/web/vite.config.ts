import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Derive source identity from the actual checkout, never from a fixed release label.
 * Commit date is used as a stable fallback, so repeated builds of one source
 * revision remain byte-for-byte reproducible. An actual build date is shown
 * only when supplied explicitly by the build environment.
 */
function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim();
  } catch {
    return null;
  }
}
const sha = git("rev-parse", "HEAD");
const commitDate = git("show", "-s", "--format=%cs", "HEAD");
const explicitBuildDate = process.env.VITE_BUILD_DATE;
const provenance = {
  sourceSha: sha && /^[0-9a-f]{40}$/.test(sha) ? sha : null,
  sourceCommitDate: commitDate && /^\d{4}-\d{2}-\d{2}$/.test(commitDate) ? commitDate : null,
  buildDate: explicitBuildDate && /^\d{4}-\d{2}-\d{2}$/.test(explicitBuildDate) ? explicitBuildDate : null
};

export default defineConfig({
  plugins: [react()],
  define: {
    __DO_BUILD_PROVENANCE__: JSON.stringify(provenance)
  },
  server: { port: 5173 }
});
