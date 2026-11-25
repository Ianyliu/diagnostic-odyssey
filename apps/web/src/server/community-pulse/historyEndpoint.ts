import { parseHistoryQuery } from "../../../../../packages/community-pulse/src/history.ts";
import { researchReportDigest } from "../../../../../packages/community-pulse/src/transport.ts";
import { parseHistoryReportRef } from "../../../../pulse-worker/src/historyEndpoint.ts";
import { boundedInboxText, inboxETag } from "../../data/communityPulseResponse.ts";
import { parseResearchDetail, parseResearchHealth, parseResearchHistory, parseThreadProjection } from "../../data/communityPulseHistory.ts";
import { isProtectedHistoryDemo, isProtectedStagingPreview, type CommunityPulseEnvironment } from "./environment.ts";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, noarchive",
};

function error(status: number, code: string) {
  return Response.json({ error: code }, { status, headers });
}

export async function readHistoryEndpoint(
  request: Request,
  env: CommunityPulseEnvironment,
  fetchWorker: typeof fetch = fetch,
  localSynthetic = false,
): Promise<Response> {
  const staged = isProtectedStagingPreview(env);
  const synthetic = localSynthetic || isProtectedHistoryDemo(env);
  if (!staged && !synthetic) return error(404, "not_found");
  if (request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
  }
  const site = request.headers.get("Sec-Fetch-Site");
  if (site !== null && site !== "same-origin" && site !== "none") return error(403, "forbidden");
  const url = new URL(request.url);
  const params = url.searchParams;
  const view = params.get("view");
  if (url.search.length > 3100 || params.getAll("view").length !== 1) return error(400, "invalid_history_query");
  params.delete("view");
  const ref = view === "report" ? parseHistoryReportRef(params) : null;

  try {
    if (view === "thread") {
      if (!synthetic || staged) return error(404, "not_found");
      if (params.size) return error(400, "invalid_history_query");
      const { readFixtureThread } = await import("./historyFixture.ts");
      const thread = parseThreadProjection(await readFixtureThread());
      return thread ? Response.json(thread, { headers }) : error(503, "thread_unavailable");
    }

    const path = view === "history" && parseHistoryQuery(params) ? "/v1/history"
      : view === "health" && !params.size ? "/v1/history/health"
        : ref ? "/v1/history/report" : null;
    if (!path) return error(400, "invalid_history_query");
    const origin = staged ? env.PULSE_STAGING_WORKER_URL : "https://synthetic.example.invalid";
    const token = env.PULSE_STAGING_WORKER_TOKEN;
    if (!origin || (staged && (!/^https:\/\/community-pulse-staging\.[a-z0-9-]{1,63}\.workers\.dev\/?$/u.test(origin) ||
      !token || !/^[A-Za-z0-9_-]{43,128}$/u.test(token)))) return error(503, "research_history_unavailable");
    const upstream = new URL(path, origin);
    upstream.search = params.toString();
    const conditional = view === "health" ? inboxETag(request.headers.get("If-None-Match")) : null;
    const outbound = new Headers({ Accept: "application/json" });
    if (staged) outbound.set("Authorization", "Bearer " + token);
    if (conditional) outbound.set("If-None-Match", conditional);
    const response = staged ? await fetchWorker(upstream, {
      headers: outbound, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(7_000),
    }) : await (await import("./historyFixture.ts")).readFixtureHistory(new Request(upstream, { headers: outbound }), upstream);
    const tag = view === "health" ? inboxETag(response.headers.get("ETag")) : null;
    if (view === "report" && response.status === 404) return error(404, "report_unavailable");
    if (view === "history" && response.status === 410) return error(410, "cursor_unavailable");
    if (response.status === 304 && conditional && tag === conditional) {
      return new Response(null, { status: 304, headers: { ...headers, ETag: tag } });
    }
    if (response.status !== 200 ||
      !response.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || (view === "health" && !tag)) {
      return error(503, "research_history_unavailable");
    }
    const value: unknown = JSON.parse(await boundedInboxText(response));
    const detail = view === "report" ? parseResearchDetail(value) : null;
    const data = view === "history" ? parseResearchHistory(value) : view === "health" ? parseResearchHealth(value) : detail;
    if (!data || (detail && (detail.ref !== ref || detail.digest !== researchReportDigest(detail.report)))) {
      return error(503, "research_history_unavailable");
    }
    return Response.json(data, { headers: tag ? { ...headers, ETag: tag } : headers });
  } catch {
    return error(503, "research_history_unavailable");
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return readHistoryEndpoint(request, process.env);
  },
};
