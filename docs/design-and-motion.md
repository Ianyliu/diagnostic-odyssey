# Design and motion

Diagnostic Odyssey uses hierarchy and evidence-role color to help readers distinguish reviewed national evidence, local context and analyst assumptions. The audit keeps those roles and their written labels visible in both themes.

## Decisions

| Principle | Implementation |
| --- | --- |
| A clear visual hierarchy | A large navy-led headline, editorial serif emphasis, two primary workflow entry points and a quieter Insights link. Evidence counts sit below the actions; source boundaries remain adjacent. |
| Group related information | Consistent spacing, card surfaces and typography; numeric values stay attached to their units and confidence intervals. |
| Progressive disclosure | Existing provenance/details controls remain keyboard-operable and gain generous targets. Material interpretation boundaries stay visible rather than moving behind disclosure. |
| Color is supplemental | Evidence roles retain labels, provenance and interpretation text. Dark mode uses its own surface and text tokens throughout the workflow. |
| Feedback should preserve the task | Downloads report failure and recovery without changing the Brief; unfinished Pilot drafts survive route navigation. |

## Motion contract

The opening plays once per tab session on a fresh, unqualified Overview visit. Headline, actions, evidence counts and workspace lanes reveal in sequence. The longest decorative sequence settles within the existing 1,450 ms window; actions are available throughout. Pointer, keyboard, touch or wheel input immediately settles it. Deep links, query URLs, unavailable storage and reduced-motion preferences bypass the opening.

Routine feedback uses 140–220 ms transitions. The opening uses a 560 ms reveal and an 850 ms workspace unfold with short staggered offsets. Entrance effects animate opacity and transforms, not layout dimensions. Navigation animates the heading on a push without remounting the route or the form. Back/forward restoration remains managed by the shell. Dialog feedback retains the existing focus trap, Escape and restoration logic.

`prefers-reduced-motion` and printing disable the new animations/transitions. No looping decorative animation, scroll hijacking, new font request or animation package is introduced. See `apps/web/src/motion.css`, `pages/OpeningProvenance.tsx` and `tests/browser/motion.mjs`.

## Research applied

- [Nielsen Norman Group: visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) — relative prominence communicates priority; applied to the landing page, navigation and workflow cards.
- [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — defer secondary detail while preserving information needed for a decision; scientific boundaries remain exposed.
- [Nielsen Norman Group: animation duration](https://www.nngroup.com/articles/animation-duration/) — brief, contextual motion; routine interaction feedback stays short.
- [web.dev: high-performance CSS animations](https://web.dev/articles/animations-guide) — prefer transform and opacity; avoid layout-changing entrance effects.
- [WCAG: animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) — allow motion to be disabled; applied with reduced-motion support and immediate interruption.
- [WCAG: target size (minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — usable controls with sufficient target area; key menus, buttons and disclosures use 44px targets.

These references guide implementation; they are not a claim of complete WCAG conformance. The audit records actual automated and keyboard checks and remaining manual coverage.
