import {
  boundedInboxText,
  inboxETag,
  parseStagingInboxResponse,
} from "../../data/communityPulseResponse.ts";
import { isProtectedStagingPreview, type CommunityPulseEnvironment } from "./environment.ts";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, noarchive",
};

function workerInboxUrl(input: string | undefined): URL | null {
  if (!input || !/^https:\/\/community-pulse-staging\.[a-z0-9-]{1,63}\.workers\.dev\/?$/.test(input)) {
    return null;
  }
  return new URL("/v1/inbox", input);
}

function unavailable() {
  return Response.json({ error: "intelligence_unavailable" }, { status: 503, headers });
}

export async function readStagingInbox(
  request: Request,
  env: CommunityPulseEnvironment,
  fetchWorker: typeof fetch = fetch,
): Promise<Response> {
  if (!isProtectedStagingPreview(env)) {
    return Response.json({ error: "not_found" }, { status: 404, headers });
  }
  if (request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
  }
  const site = request.headers.get("Sec-Fetch-Site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (new URL(request.url).search) {
    return Response.json({ error: "unexpected_query" }, { status: 400, headers });
  }
  const url = workerInboxUrl(env.PULSE_STAGING_WORKER_URL);
  const token = env.PULSE_STAGING_WORKER_TOKEN;
  if (!url || !token || !/^[a-zA-Z0-9_-]{32,128}$/.test(token)) return unavailable();

  try {
    const conditional = inboxETag(request.headers.get("If-None-Match"));
    const upstreamHeaders: Record<string, string> = { Accept: "application/json", Authorization: `Bearer ${token}` };
    if (conditional) upstreamHeaders["If-None-Match"] = conditional;
    const response = await fetchWorker(url, {
      method: "GET",
      headers: upstreamHeaders,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(7_000),
    });
    const validator = inboxETag(response.headers.get("ETag"));
    if (response.status === 304 && conditional && validator === conditional) {
      return new Response(null, { status: 304, headers: { ...headers, ETag: validator } });
    }
    if (response.status !== 200 || !validator ||
      !response.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return unavailable();
    }
    const projection = parseStagingInboxResponse(JSON.parse(await boundedInboxText(response)) as unknown);
    if (!projection) return unavailable();
    return Response.json(projection, { headers: { ...headers, ETag: validator } });
  } catch {
    return unavailable();
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return readStagingInbox(request, process.env);
  },
};
