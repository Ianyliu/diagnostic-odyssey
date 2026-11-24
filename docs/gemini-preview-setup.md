# Synthetic Gemini Vercel preview

Development-only serverless function: `POST /api/ai-preview`. It runs a fixed server-owned synthetic test using the existing `planning-guidance` validator. There is no connection to real Planning Briefs and no production AI activation.

## Required Vercel configuration

Deploy the draft PR branch as a **Preview** deployment in an isolated Vercel development project or protected preview. Project Root Directory must be `apps/web`.

Under **Vercel Settings -> Environment Variables**, set **Preview only**:

- `GEMINI_API_KEY`: Google AI Studio key (Secret).
- `AI_PREVIEW_TOKEN`: separate 32+ byte random operator bearer token generated privately with `openssl rand -hex 32` (Secret).
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`): durable serverless Redis/KV store for distributed rate limiting (`503` fail-closed when missing on `VERCEL=1`).
- `AI_PREVIEW_ENABLED`: `on` (absent/off by default).
- `GEMINI_MODEL`: `gemini-3.5-flash-lite` or `gemini-2.5-flash-lite` (optional).

Do not enable a Production feature flag, set any key in a `VITE_*` variable, or commit secrets. Redeploy the Preview after changing environment variables. Existing Production deployments (`VERCEL_ENV !== "preview"`) always return `404` for this endpoint.

## Smoke test (private Terminal)

Store `AI_PREVIEW_TOKEN` in the local shell without echoing it into terminal history, then run:

    curl --fail-with-body -X POST \
      -H "Authorization: Bearer $AI_PREVIEW_TOKEN" \
      https://<exact-reviewed-preview-host>.vercel.app/api/ai-preview

Expected: JSON with `mode=synthetic_only` and a validated model-generated candidate bound to the synthetic fixture. An invalid model response returns HTTP `502` with a generic error code. `GET` requests return `405`.

## Security controls

- Same-origin check (`403`), streaming empty-body enforcement (`400`), streaming 32 KB provider response cap (`502`), and 8 s request abort propagation.
- Dedicated `VERCEL_ENV=preview` + `AI_PREVIEW_ENABLED=on` gate (`404` otherwise).
- Distributed serverless rate limiting (12 requests per 300 s window per bearer digest) failing closed (`503`) if Vercel KV/Upstash is unconfigured or unavailable.
- Keep Google AI Studio auto-reload off; apply a spending cap in Google AI Studio.
