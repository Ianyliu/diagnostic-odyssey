import { parseHistoryQuery, receiptReference } from "../../../packages/community-pulse/src/history.ts";
import { allowedReadToken, equalSecret } from "./authentication.ts";
import type { createIntakeStore } from "./storage.ts";

export const historyRoutes = ["/v1/history", "/v1/history/health", "/v1/history/report"] as const;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, noarchive",
  Vary: "Authorization",
};

export function parseHistoryReportRef(query: URLSearchParams): string | null {
  const ref = query.get("ref");
  return query.size === 1 && ref && receiptReference.test(ref) ? ref : null;
}

export async function serveResearchHistory(
  request: Request,
  enabled: boolean,
  token: string | undefined,
  createStore: () => ReturnType<typeof createIntakeStore>,
  now = new Date(),
): Promise<Response> {
  const url = new URL(request.url);
  if (!enabled || !allowedReadToken(token) || !historyRoutes.some(path => path === url.pathname)) {
    return Response.json({ error: "not_found" }, { status: 404, headers });
  }
  const supplied = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43,128})$/u)?.[1];
  if (!supplied || !equalSecret(supplied, token)) {
    return Response.json({ error: "authentication_required" }, { status: 401, headers });
  }
  if (request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
  }
  try {
    if (url.search.length <= 3000) {
      if (url.pathname === "/v1/history/health" && !url.search) {
        const result = await createStore().readHistoryHealth(now);
        const responseHeaders = { ...headers, ETag: result.etag };
        return request.headers.get("if-none-match") === result.etag
          ? new Response(null, { status: 304, headers: responseHeaders })
          : Response.json(result.data, { headers: responseHeaders });
      }
      if (url.pathname === "/v1/history/report") {
        const ref = parseHistoryReportRef(url.searchParams);
        if (ref) {
          const report = await createStore().readReport(now, ref);
          return report ? Response.json(report, { headers })
            : Response.json({ error: "report_unavailable" }, { status: 404, headers });
        }
      }
      if (url.pathname === "/v1/history") {
        const query = parseHistoryQuery(url.searchParams);
        if (query) {
          const page = await createStore().readHistory(now, query, token);
          return page ? Response.json(page, { headers })
            : Response.json({ error: "cursor_unavailable" }, { status: 410, headers });
        }
      }
    }
    return Response.json({ error: "invalid_history_query" }, { status: 400, headers });
  } catch {
    return Response.json({ error: "research_history_unavailable" }, { status: 503, headers });
  }
}
