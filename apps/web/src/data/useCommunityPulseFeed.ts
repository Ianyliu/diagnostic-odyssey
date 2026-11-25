import {useEffect, useState} from "react";
import {
  boundedInboxText,
  inboxETag,
  parseCommunityPulseResponse,
  parseStagingInboxResponse,
} from "./communityPulseResponse.ts";

type FeedConfiguration<T> = {
  path: string;
  parse: (value: unknown) => T | null;
  adaptive: boolean;
};

export const fixtureFeed = {
  path: "/api/community-pulse",
  parse: parseCommunityPulseResponse,
  adaptive: false,
};

export const stagingFeed = {
  path: "/api/community-pulse-staging",
  parse: parseStagingInboxResponse,
  adaptive: true,
};

const fixtureInterval = 30_000;
const stagingInterval = 60_000;
const maxStagingInterval = 300_000;
const minFocusInterval = 15_000;

function isVisible() {
  return document.visibilityState !== "hidden";
}

export function useCommunityPulseFeed<T>(config: FeedConfiguration<T>, active: boolean) {
  const [feed, setFeed] = useState<T | null>(null);
  const [state, setState] = useState<"loading" | "unavailable" | "ready">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let etag: string | null = null;
    let lastStarted = 0;
    let delay = config.adaptive ? stagingInterval : fixtureInterval;

    async function refresh() {
      if (disposed || controller || !isVisible()) return;
      window.clearTimeout(timer);
      const request = new AbortController();
      controller = request;
      lastStarted = Date.now();
      const deadline = window.setTimeout(() => request.abort(), 8_000);
      try {
        const headers: Record<string, string> = { Accept: "application/json" };
        if (etag) headers["If-None-Match"] = etag;
        const response = await fetch(config.path, {
          signal: request.signal,
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers,
        });

        if (response.status === 304 && config.adaptive && etag &&
          inboxETag(response.headers.get("ETag")) === etag) {
          delay = Math.min(delay * 2, maxStagingInterval);
          return;
        }

        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Inbox unavailable");
        }
        const data = config.parse(JSON.parse(await boundedInboxText(response)) as unknown);
        if (!data) throw new Error("Invalid inbox");
        if (!disposed && isVisible() && controller === request) {
          etag = config.adaptive ? inboxETag(response.headers.get("ETag")) : null;
          if (config.adaptive) delay = stagingInterval;
          setFeed(data);
          setState("ready");
        }
      } catch {
        if (!disposed && isVisible() && controller === request) {
          etag = null;
          if (config.adaptive) delay = Math.min(delay * 2, maxStagingInterval);
          setFeed(null);
          setState("unavailable");
        }
      } finally {
        window.clearTimeout(deadline);
        if (controller === request) {
          controller = undefined;
          if (!disposed && isVisible()) {
            timer = window.setTimeout(() => { void refresh(); }, delay);
          }
        }
      }
    }

    function onVisibility() {
      if (!isVisible()) {
        window.clearTimeout(timer);
        controller?.abort();
        controller = undefined;
        etag = null;
        setFeed(null);
        setState("loading");
      } else {
        void refresh();
      }
    }

    function onFocus() {
      if (!config.adaptive || Date.now() - lastStarted >= minFocusInterval) void refresh();
    }

    void refresh();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, attempt, config]);

  return {feed: active ? feed : null, state, reload: () => setAttempt(number => number + 1)};
}
