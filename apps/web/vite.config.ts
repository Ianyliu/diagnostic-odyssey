import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { findSourceRoot, readGitSource, resolveBuildProvenance } from "./build/sourceProvenance";

/**
 * VITE_SOURCE_SHA is the complete source commit downloaded for this build.
 * Native Git checkouts verify it against HEAD; archives require an explicit SHA.
 * Build date is independent of source commit date and is never inferred.
 */
const sourceRoot = findSourceRoot(process.cwd());
const provenance = resolveBuildProvenance({
  envSha: process.env.VITE_SOURCE_SHA,
  explicitBuildDate: process.env.VITE_BUILD_DATE,
  ...readGitSource(sourceRoot)
});

export default defineConfig({
  plugins: [react()],
  define: {
    __DO_BUILD_PROVENANCE__: JSON.stringify(provenance),
    // Build-time public boolean only; never expose server secrets or production inference.
    __DO_GEMINI_STAGE2_PREVIEW__: JSON.stringify(
      process.env.VERCEL_ENV === "preview" && process.env.AI_GUIDANCE_ENABLED === "on"
    )
  },
  server: { port: 5173 }
});
