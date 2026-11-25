# Vercel projects connected to this repository

Recorded during integration qualification of `chore/audit-docs-ci-tests-debt-20261125` (2026-11-25). Nothing
here was changed in Vercel; project settings, aliases and Git connections are owner decisions.

| Vercel project | Root directory | Role | Status on `main@5b81f5f` | Status on this branch |
| --- | --- | --- | --- | --- |
| `diagnostic-odyssey` | `apps/web` | The application (production and Previews) | READY | READY (Preview, deployment protection enabled) |
| `diagnostic-odyssey-strategy-lab` | `apps/strategy-lab` | Isolated design preview of six Strategy Lab concepts | ERROR `NOW_SANDBOX_WORKER_ROOTDIR_NOT_EXIST` (`dpl_BFc3dpXnWvTskhGrrkX3SesApJMY`) | ERROR, same code (`dpl_H6C6oWtaGa5QGQkuARPsi4MYcnVw`) |

## The `diagnostic-odyssey-strategy-lab` failure is pre-existing and not caused by this branch

- `apps/strategy-lab` has **never existed on `main`** (`git log main -- apps/strategy-lab` is empty). It exists only on
  the unmerged branch `design/strategy-lab-six-concepts-20261113` (five commits on 2026-11-13, starting with
  `2981560 feat(strategy-lab): scaffold isolated six-concept design preview`).
- The production Strategy Lab is the `/pilot` route of `apps/web` (`03 · STRATEGY LAB`), consolidated through the
  Strategic Atlas work merged in PR #150. Neither `main` nor this branch contains a second application.
- The project therefore fails for every commit that lacks that directory, including `main`. Its commit status is
  reported by the Vercel GitHub integration; it is **not** a GitHub Actions check, and `main` has no branch protection
  or ruleset requiring it (GitHub API: `Branch not protected`, rulesets `[]`, checked 2026-11-25).

**Disposition:** documented, pre-existing, **non-blocking** infrastructure issue for this branch. The application was
not recreated to satisfy the stale configuration.

**Unresolved owner decision:** whether the project is still wanted for previews of
`design/strategy-lab-six-concepts-20261113` (the only ref where it can build). If not, the owner may disconnect or
delete it, or add an ignored-build step so it stops reporting failures on unrelated commits. That requires separate
human authorization and was not done here ([open items](../governance/open-items.md)).
