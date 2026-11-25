import { parseCommunityPulseResponse, type CommunityPulseResponse } from "../../data/communityPulseResponse.ts";

/** The delivery layer reads a new projection on every request. Storage and publication are separate. */
export interface CommunityPulseDataSource {
  read(): Promise<CommunityPulseResponse>;
}

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, noarchive"
};

export async function readCommunityPulse(
  request: Request,
  enabled: boolean,
  dataSource: CommunityPulseDataSource
): Promise<Response> {
  if (!enabled) return Response.json({ error: "not_found" }, { status: 404, headers });
  if (request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
  }
  if (new URL(request.url).search) {
    return Response.json({ error: "unexpected_query" }, { status: 400, headers });
  }
  try {
    const projection = parseCommunityPulseResponse(await dataSource.read());
    if (!projection) return Response.json({ error: "intelligence_unavailable" }, { status: 503, headers });
    return Response.json(projection, { headers });
  } catch {
    return Response.json({ error: "intelligence_unavailable" }, { status: 503, headers });
  }
}
