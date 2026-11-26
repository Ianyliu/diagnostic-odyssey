# @diagnostic-odyssey/ui

Strategic Atlas design tokens: `src/styles.css` (light, dark and print palettes, 7-role semantic tokens, shell and motion
constants, the browser source of truth) and `src/index.ts` (`designTokens`, typed design-role values).

Visual semantics only; no scientific calculations. Exports: `.` (`src/index.ts`) and `./styles.css`.

WCAG contrast of these tokens is enforced by `apps/web/test/wcag-contrast.test.ts` (>=4.5:1 text, >=3:1 UI), run with `npm test --workspace @diagnostic-odyssey/web`. This package has no `test` script of its own.
See [design and motion](../../docs/design-and-motion.md).
