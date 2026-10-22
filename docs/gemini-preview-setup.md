# Synthetic Gemini Vercel preview

Development-only serverless function: POST /api/ai-preview. It runs a fixed server-owned synthetic test using the existing planning-guidance validator. There is no connection to real Planning Briefs and no production AI activation.

## Required Vercel configuration

Deploy the draft PR branch as a **Preview** deployment in an isolated Vercel development project or protected preview. Project Root Directory must be apps/web.

Under Vercel Settings -> Environment Variables, set **Preview only**:

- GEMINI_API_KEY: existing Google AI Studio key, type Secret.
- AI_PREVIEW_TOKEN: a separate 32-byte random bearer token (generate privately using openssl rand -hex 32), type Secret.
- AI_PREVIEW_ENABLED: on (type Config); absent/off by default.
- GEMINI_MODEL: gemini-3.5-flash-lite (type Config; optional).

Do not enable a Production feature flag, set the key in a VITE_ variable, or commit secrets. Redeploy the Preview after changing environment variables. Existing Production URLs always return 404 for this endpoint. Do not change protection/access policies for the October 22 judge demo.

## Smoke test (private Terminal)

Store AI_PREVIEW_TOKEN in the local shell without echoing it into terminal history. Then run:

    curl --fail-with-body -X POST \
      -H "Authorization: Bearer $AI_PREVIEW_TOKEN" \
      https://<exact-reviewed-preview-host>.vercel.app/api/ai-preview

Expected: JSON with mode=synthetic_only and a validated model-generated candidate bound to the fake fixture. An invalid model response returns HTTP 502 with a generic code. GET requests are not supported.

## Security limitations

- The endpoint accepts no request body or user-controlled evidence/authority; model egress contains only ID references from a synthetic fixture.
- Only requests with VERCEL_ENV=preview, AI_PREVIEW_ENABLED=on and a valid secret token can reach Gemini.
- This is a manual development smoke test, not a public service or real Brief integration. No durable per-user quota system exists.
- Keep Google AI Studio auto-reload off; apply a project cap, and check billing and usage. Vercel deployment variables do not cap Google spend.
- Mac Ollama stays bound to localhost and is not exposed remotely.
- Verify both /api/ai-preview route behavior and existing deep-link /brief rendering in the deployed Preview.

Implementation and security review are needed before enabling for any public users.
