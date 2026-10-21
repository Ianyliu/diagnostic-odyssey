# Workstream K — Vercel security header release gate (Issue #128)

This isolated candidate affects the Vercel application only. It does **not** change
Cloudflare Pages `_headers`, static archive provenance, evidence artifacts,
the AI manual handoff, national or local estimates, or the scenario engine.
Do not merge or promote to production without independent D and PM approval.

## Implementation and compatibility

- `apps/web/vercel.json` retains the existing SPA rewrite and applies a **single
  unconditional catch-all** Vercel `headers` rule to the root document, cold
  routes, assets, SVG icons, and `/theme-init.js`. No caching or routing
  overrides are introduced.
- The original small inline theme IIFE is extracted unchanged to a
  **classic, synchronous, parser-blocking local script** in the head. No module,
  `defer`, `async` or DOM-ready delay is permitted. It retains storage
  fallbacks, system theme and theme-color before initial page content renders.
  This avoids a CSP nonce/hash maintenance lifecycle and any `unsafe-inline`
  exception for JavaScript.
- CSP defaults to denial. Scripts, stylesheet files, fonts, images and optional
  fetches are restricted to same origin. The application has no live AI,
  external JS, Google Fonts or runtime API requirement. `base-uri`,
  `form-action`, `object-src`, `frame-ancestors`, `frame-src` and
  `worker-src` are denied. `script-src-attr` and `style-src-attr` are
  denied. React element `style` properties are set through CSSOM, which is
  allowed; assigning a literal `style` attribute is deliberately not.
  Browser print/PDF and JSON Blob **downloads** do not need blob execution
  in `script-src` or `worker-src`; ordinary outbound links to reviewed
  references and manual AI tools remain permitted navigation.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `X-Frame-Options: DENY` (legacy fallback), and a narrow Permissions-Policy
  deny access to camera/microphone/geolocation/payment without interfering
  with clipboard, print or links. Existing provider HSTS remains unchanged.
- CSP does not use `unsafe-inline`, `unsafe-eval`, wildcard/network scheme,
  `data:`, `blob:`, external domains or a reporting endpoint. This is
  intentional: no outbound violation reporting or collection of incidental
  browser information. Test actual CSSOM charts, direct SVG/assets and JSON
  exports before approval. A future genuine use of inline styles, data images,
  workers or other origins requires a scoped review, not blanket exceptions.

## Evidence classes — do not conflate

1. The Node contract unit suite rejects weakened/missing/duplicated
   rules, altered SPA rewrite, removed framing/MIME/referrer protections, and
   tests theme bootstrap semantics, including storage and media-query failure.
2. Workstream K's exact-HEAD browser job runs a **local Vite preview behind a
   minimal header-simulation proxy**. It inspects HTTP headers and MIME,
   checks direct SPA routes, Chrome light/dark before DOMContentLoaded,
   reduced-motion, React CSSOM chart styling, no accidental egress, negative
   script/style injection and frame embedding, and exercises the
   protected Brief JSON download/physical PDF. The full pre-existing
   acceptance/axe suite runs against the ordinary local Vite preview because
   that legacy harness injects the axe library with an inline script tag (which
   the enforced CSP deliberately blocks). This deliberately separates app
   accessibility regression from header-enforcement checks. **This is CSP enforcement testing
   but not proof that Vercel serves the configured headers.**
3. Separately run the `workflow_dispatch` job with an actual **immutable
   Vercel preview URL** (no production host) after its deployment reaches READY;
   it repeats effective HTTP + browser tests and writes
   `security-results.json`. A protected preview returning 401/403 is
   **UNKNOWN/BLOCKED**, never PASS. Also verify real preview externally with
   `curl -i` on root, cold SPA routes, theme-init.js and hashed JS/CSS.
   GitHub Actions access may need authorized preview protection-bypass
   configuration, which is outside this PR and must not be silently created.
4. Workstream H's separately triggered four-mode native Chromium PDF/JSON
   artifacts and Core CI must pass at the **same complete commit HEAD**.
   Passing configuration/preview smoke does not certify print-dialog behavior,
   full screen-reader usability, Cloudflare parity, production effective
   headers, or R10/R11 and #100/#104 release gates.

## Manual reviewer checklist

At an immutable preview URL, verify real response header values/content types;
inspect Chrome console and CSP violation events on every cold route; check first
paint in system/light/dark, mobile widths, reduced motion, evidence charts,
accordion/keyboard accessibility, navigation to external citation/AI handoff,
Brief export JSON and native print-to-PDF. Check framing rejection and
no unintended external network calls. Do not authorize production until D
records an exact-HEAD acceptance disposition and PM expressly approves rollout.
