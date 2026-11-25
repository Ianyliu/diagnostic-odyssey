# Security policy

## Reporting a vulnerability

**Reporting channel: not yet designated.** The maintainers have not published a private security contact, and this
file deliberately does not invent one (see [open items](docs/governance/open-items.md)). Until one is published:

- do **not** open a public issue or pull request containing exploit details, credentials or tokens;
- if the repository has GitHub private vulnerability reporting enabled, use it (maintainers: please confirm and
  record the answer here);
- otherwise contact the repository owner through GitHub without including sensitive details and ask for a private channel.

## Scope

In scope: the web application, the Vercel functions in `apps/web/api`, the build and CI configuration, and the handling of
reviewed artifacts. Out of scope: third-party services (Vercel, Google Gemini API, Upstash/KV), social-engineering, and
physical attacks.

## What the repository tests, and what it does not claim

Automated tests currently check (see [docs/testing.md](docs/testing.md) and [docs/security/workstream-k.md](docs/security/workstream-k.md)):

- the Content-Security-Policy and related headers declared in `apps/web/vercel.json`;
- the Preview-only `/api/ai-guidance` endpoint: environment gating, bearer authentication, same-origin checks, request
  size/shape validation, signed single-use challenges, rate limiting, fail-closed behavior when state is unavailable,
  bounded provider responses, the exact data sent to the provider, and that secrets never appear in responses
  (387 deterministic cases in `tests/characterization/endpoint.ts`);
- the retired `/api/ai-preview` returning `404` and containing no provider, secret or storage code;
- immutability of reviewed scientific artifacts (SHA-256 inventory).

These are local and static checks. They are not a penetration test, an audit, a certification, or evidence of
production deployment behavior. Verification against an isolated Vercel Preview is a separate stage. No clinical
validation or regulatory compliance is claimed anywhere in this repository.

## Secrets and data boundaries

The core application needs no secrets. Optional server-side values (never commit them): `AI_PREVIEW_TOKEN`,
`AI_CHALLENGE_SECRET`, `GEMINI_API_KEY`, `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or Upstash equivalents), `CENSUS_API_KEY`,
and `JULES_API_KEY` for CI. `VITE_*` variables are public build-time switches, not secrets. Public production builds contain no
AI inference and no provider calls; the Preview-only lane sends the provider only identifiers, codes and a snapshot fingerprint
(the `ModelEgressV1` shape in `packages/planning-guidance`), never user free text. See [docs/gemini-preview-setup.md](docs/gemini-preview-setup.md) and
[docs/operations/stage2-gemini-reviewed-preview.md](docs/operations/stage2-gemini-reviewed-preview.md).

## Supported versions

Only the current `main` branch is maintained.
