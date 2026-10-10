# Rendered browser acceptance matrix
Base URL: http://127.0.0.1:4177
Browser: system Google Chrome 154.0.8037.98; Playwright 1.64.0; axe 4.11.1
- PASS: 11 direct routes: desktop light
- PASS: 11 direct routes: desktop dark
- PASS: 11 direct routes: tablet light
- PASS: 11 direct routes: tablet dark
- PASS: 11 direct routes: mobile light
- PASS: 11 direct routes: mobile dark
- PASS: history, keyboard skip link, mobile menu and anchor focus
- PASS: full explicit selection workflow, sensitivities, actual JSON, stale requests, print restoration
- PASS: browser API fallback: missingMatchMedia
- PASS: browser API fallback: incompleteMatchMedia
- PASS: browser API fallback: throwingMatchMedia
- PASS: browser API fallback: blockedStorage
- PASS: appearance persistence and reduced motion opening
- PASS: invalid numeric drafts preserve last applied scenario and JSON
- PASS: extreme finite scenario layout and invalid sensitivity remain usable
- PASS: rendered WCAG accessibility: light
- PASS: rendered WCAG accessibility: dark
- PASS: rendered fail-closed artifact error: national
- PASS: rendered fail-closed artifact error: local
- PASS: initial loading DOM commit before synchronous artifact validation
- PASS: opening animation settles, does not replay, and respects motion changes
- PASS: media-query subscriptions clean up across Brief navigation
- PASS: keyboard-only selections, scenario control, request opt-in and JSON export
- PASS: cold browser load measurements