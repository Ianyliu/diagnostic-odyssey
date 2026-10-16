# Public source-revision stamp (2026-10-16)

The web app footer shows a minimal link to the **exact source commit** from which its Vite bundle was built. This is public metadata, not scientific-artifact provenance.

- **Default (reproducible):** during the Vite build, `git rev-parse HEAD` obtains the 40-character checkout SHA and `git show -s --format=%cs HEAD` obtains the commit date. Both are embedded statically through Vite `define`; no runtime fetch, telemetry, dependency, storage or provider calls are added. Two clean builds from the same revision embed the same provenance.
- **Actual build date (optional):** if an authoritative pipeline provides a `VITE_BUILD_DATE` in `YYYY-MM-DD` form, the footer *additionally* says `built YYYY-MM-DD`. In its absence, the footer says only `committed YYYY-MM-DD`, **never** mislabels the commit date as the build date.
- **No Git checkout / invalid SHA:** render `Source revision unavailable` with no clickable link, rather than invent a revision. The Git command has a two-second timeout and cannot execute a shell string.
- **In GitHub PR/CI previews:** the displayed revision reflects the checked-out head/merge checkout rather than an implied `main`. For production, build from an explicitly checked-out and verified main commit.
- **Cloudflare deploy-ready orphan branches:** these contain *already compiled* static assets, not app source. Rehosting those assets preserves the embedded source revision even though the static orphan-branch commit is different. Compare the stamp to the source revision written in the deploy-ready README and to the production bundle before claiming deployment parity.
- **Release safety:** source date/version strings carry no user data. This PR changes presentation/build metadata only, not reviewed MEPS/WV artifacts, Planning Brief contracts, statistical results, Pilot assumptions, AI handoff, export serialization, or the demo build kill switch.

Future pipeline enhancement: if the automated deploy builder is updated, it may supply the actual build date as `VITE_BUILD_DATE=$(date -u +%F)`. That is outside the repository and **not modified by this PR**; reproducibility comparisons should build with a fixed explicit date if doing so.

Acceptance: test normal Git checkout build, absent-Git fallback, valid/invalid source formatting, current revision link, enabled/disabled Future AI builds, and no alteration to canonical outputs.
