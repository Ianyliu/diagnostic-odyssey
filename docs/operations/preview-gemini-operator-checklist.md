# Vercel Preview Gemini Function & Local Ollama Topology Operator Checklist

## Overview

This document defines operational guidelines and safety controls for the owner-authorized preview-only Gemini AI serverless integration (`/api/ai/evaluate`), and records the network isolation posture for local Ollama evaluation.

---

## 1. Local Ollama Topology (Localhost Only)

- **Execution Environment**: Ollama runs strictly on `localhost` (127.0.0.1) on an Apple Silicon M2 Mac.
- **Network Boundaries**:
  - Do **NOT** publish Ollama's port (`11434`) to the public internet or local LAN interface.
  - Do **NOT** configure anonymous Cloudflare Tunnels, ngrok, Vercel API rewrites, or unauthenticated public network relays.
- **Future Private Relay Architecture (Not Currently Implemented)**:
  - If remote access to the local Ollama instance is ever required for preview evaluation, it must use an authenticated, encrypted, zero-trust private relay (e.g. WireGuard / Tailscale with mTLS or token-based authorization headers).
  - No public network relay or unauthenticated proxy is permitted.

---

## 2. Vercel Preview Gemini Function Operator Checklist

### Environment & Secret Configuration

1. **Vercel Env Variables (Preview Only)**:
   - `GEMINI_API_KEY`: Configured strictly in **Vercel Preview Sensitive** environment settings. Never set in Production environment.
   - `PRIVATE_DEV_AUTH_TOKEN`: Random 256-bit entropy secret string configured in Vercel Preview settings for development authorization.
   - `AI_PROVIDER_ENABLED`: Set to `"on"` in Preview env when actively running evaluations; default is `"off"` or unconfigured.
   - `VERCEL_ENV`: Set automatically by Vercel (`"preview"` for PR previews). Function rejects any execution where `VERCEL_ENV !== "preview"`.

2. **Google AI Studio Budget & Safety Controls**:
   - [ ] Hard spending cap set to **$3.00** maximum in Google Cloud / AI Studio billing controls.
   - [ ] Automatic billing top-up / auto-reload **DISABLED**.
   - [ ] Rate limits and spending alert notifications enabled.

3. **Pre-Invocation Verification Gate**:
   - The endpoint `/api/ai/evaluate` strictly enforces a multi-tiered gate:
     - `VERCEL_ENV === "preview"`
     - `AI_PROVIDER_ENABLED === "on"`
     - HTTP Method === `POST`
     - Valid `x-dev-authorization` or `Authorization: Bearer <PRIVATE_DEV_AUTH_TOKEN>` header
   - If any condition fails, the request is rejected immediately with 401/403/405 status without invoking the Gemini API or incurring provider costs.

4. **Synthetic Fixture Boundary**:
   - The preview function evaluates **only** server-defined synthetic fixtures.
   - User inputs, uploaded files, actual Brief content, health data, and caller-provided authority overrides are strictly rejected.
   - Model candidates are bound and verified via `@diagnostic-odyssey/planning-guidance` (`bindCandidate` and `assertOutput`).

5. **Manual QA / Verification Script**:
   ```bash
   # Test rejected request (missing dev token)
   curl -i -X POST https://<your-preview-domain>.vercel.app/api/ai/evaluate

   # Test authorized preview request
   curl -i -X POST https://<your-preview-domain>.vercel.app/api/ai/evaluate \
     -H "Authorization: Bearer <PRIVATE_DEV_AUTH_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"model": "gemini-2.0-flash"}'
   ```

---

## 3. Security & Production Safeguards

- Production web application (`VERCEL_ENV === "production"`) will reject all API execution attempts with HTTP 403 (`ENVIRONMENT_NOT_PERMITTED`).
- Public static Vite site, production handoffs, scenario math, and reviewed scientific artifacts remain 100% unchanged.
- No API keys or authorization secrets are included in client bundles, `VITE_*` variables, or server log output.
