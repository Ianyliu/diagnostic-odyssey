# Retired Preview endpoint & Strategy AI Studio modes

`/api/ai-preview` is **permanently retired** and returns HTTP `404` (`{ "error": "not_found" }`) with `Cache-Control: no-store` in every deployment environment, making zero external model or KV calls.

All authenticated Preview-only Gemini execution now routes exclusively through **`/api/ai-guidance`** under the **Strategy AI Studio** modes:

- **Prompt Studio**: local manual six-goal handoff builder + canonical JSON companion (works in public production builds with zero API calls).
- **Illustrative exploration**: non-admitted four-lens exploratory walkthroughs anchored to the current Brief.
- **Authenticated preview guidance** (`POST /api/ai-guidance`): protected `VERCEL_ENV=preview` operator-credential lane using signed HMAC challenges (`AI_CHALLENGE_SECRET` distinct from `AI_PREVIEW_TOKEN`), mandatory same-origin `Origin` on `POST`, atomic Redis `EVAL` rate limiting (`12` requests / `300 s`), and single-use `SET EX NX` challenge consumption.

See [stage2-gemini-reviewed-preview.md](operations/stage2-gemini-reviewed-preview.md) for the complete Preview setup and operator acceptance procedure.
