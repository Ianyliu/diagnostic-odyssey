import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { allowLocalCommunityPulseFixtures, showCommunityPulseFixtures, showCommunityPulseStaging } from "./src/server/community-pulse/environment";
import { readCommunityPulse } from "./src/server/community-pulse/runtime";
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

/** Use the same read handler in offline Vite workflows without serving it over a LAN. */
function offlinePulseApi(): Plugin {
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/api/community-pulse" && url.pathname !== "/api/community-pulse-history") return next();
    const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
    if (url.pathname === "/api/community-pulse-history") {
      const { readHistoryEndpoint } = await import("./src/server/community-pulse/historyEndpoint.ts");
      const request = new Request(url, { method: req.method ?? "GET", headers: {
        "If-None-Match": typeof req.headers["if-none-match"] === "string" ? req.headers["if-none-match"] : "",
        "Sec-Fetch-Site": typeof req.headers["sec-fetch-site"] === "string" ? req.headers["sec-fetch-site"] : "none",
      } });
      const response = local ? await readHistoryEndpoint(request, process.env, fetch, allowLocalCommunityPulseFixtures(process.env))
        : new Response(null, { status: 404 });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    const response = await readCommunityPulse(
      new Request(url, { method: req.method ?? "GET" }),
      local && allowLocalCommunityPulseFixtures(process.env),
      {
        async read() {
          const { fixtureDataSource } = await import("./src/server/community-pulse/fixtureDataSource.ts");
          return fixtureDataSource.read();
        }
      }
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  };
  return {
    name: "offline-community-pulse-api",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); }
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
  plugins: [react(), stableWebfontLoading(), offlinePulseApi()],
  define: {
    __DO_BUILD_PROVENANCE__: JSON.stringify(provenance),
    __DO_COMMUNITY_PULSE_FIXTURES__: JSON.stringify(showCommunityPulseFixtures(process.env)),
    __DO_COMMUNITY_PULSE_STAGING__: JSON.stringify(showCommunityPulseStaging(process.env)),
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
