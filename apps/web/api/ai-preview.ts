/**
 * Retired synthetic preview route (`/api/ai-preview`).
 * Kept as a fail-closed 404 stub with zero provider calls, secrets, or KV access;
 * Preview-only reviewed guidance runs exclusively through `/api/ai-guidance`.
 */
export async function handleSyntheticPreview(): Promise<Response> {
  return Response.json(
    { error: "not_found" },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}

export default {
  fetch() {
    return handleSyntheticPreview();
  }
};
