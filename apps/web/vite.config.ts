import type { Plugin } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { findSourceRoot, readGitSource, resolveBuildProvenance } from "./build/sourceProvenance";

const CRITICAL_PRELOAD_FONTS = [
  "newsreader-latin-wght-normal",
  "plus-jakarta-sans-latin-wght-normal",
  "ibm-plex-mono-latin-400",
  "ibm-plex-mono-latin-600"
];

/** Avoid late webfont-swap CLS while preloading core Latin faces in build output. */
function stableWebfontLoading(): Plugin {
  return {
    name: "stable-webfont-loading",
    transform(code, id) {
      if (id.includes("@fontsource") && id.endsWith(".css")) {
        return code.replaceAll("font-display: swap", "font-display: optional");
      }
      return null;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const links = Object.keys(ctx.bundle)
          .sort()
          .filter(name => name.endsWith(".woff2") && CRITICAL_PRELOAD_FONTS.some(prefix => name.includes(prefix)))
          .map(name => `    <link rel="preload" as="font" type="font/woff2" crossorigin href="/${name}" />`)
          .join("\n");
        return links ? html.replace("</head>", `${links}\n  </head>`) : html;
      }
    }
  };
}

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
  plugins: [react(), stableWebfontLoading()],
  define: {
    __DO_BUILD_PROVENANCE__: JSON.stringify(provenance),
    // Build-time public boolean only; never expose server secrets or production inference.
    __DO_GEMINI_STAGE2_PREVIEW__: JSON.stringify(
      process.env.VERCEL_ENV === "preview" &&
      process.env.AI_PREVIEW_ENABLED === "on" &&
      process.env.AI_GUIDANCE_ENABLED === "on"
    )
  },
  build: {
    assetsInlineLimit: 0
  },
  server: { port: 5173 }
});
