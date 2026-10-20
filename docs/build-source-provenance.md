# Source revision and build provenance (Issue #117)

The app's source link comes from Vite's build-time `__DO_BUILD_PROVENANCE__` value. This is **not** evidence that a hosted URL serves the same bytes as a local build; deployment attestation remains independently gated under issues #100 and #104.

## Inputs and guarantees

- `VITE_SOURCE_SHA` (optional in a real Git checkout; **required for a source archive without `.git` to display a revision**) must be exactly 40 hexadecimal characters. Uppercase hex is normalized to lowercase. Empty, abbreviated, whitespace-padded or malformed values fail the build.
- Where the source root has its own `.git`, Vite reads and validates `git rev-parse --verify HEAD`. A supplied valid `VITE_SOURCE_SHA` **must equal** that Git HEAD or the build fails. The source root is detected from the repository structure; an archive must never inherit an unrelated parent repository's HEAD.
- When no valid Git HEAD exists and no override is supplied, source identity is `null` and the UI must say **Source revision unavailable**, with no source link. This is preferable to a guessed commit.
- The source commit date is read from the matching local Git commit only, never inferred from the build date. An archive with a supplied revision but no Git metadata has no displayed commit date.
- `VITE_BUILD_DATE` is independent and optional. If provided it must be a real calendar date in UTC `YYYY-MM-DD` format; an invalid value fails the build. Supply the actual build date only, never copy Git's commit date into it. It is omitted when unknown. Vite never calls the current clock to populate metadata, so identical inputs remain reproducible.

No deployment environment variable is secret here. The source SHA is public and embedded in shipped JavaScript. A supplied source SHA is an assertion by the build operator; the app **cannot** prove that an archive's contents match it. The archive must come from an immutable, independently recorded commit download.

## Normal checkout

From this repository's actual Git checkout:

```sh
npm ci --no-audit --no-fund
npm run build
```

The Vite build uses the real checkout HEAD. For a build where an external process also supplies provenance:

```sh
VITE_SOURCE_SHA="$(git rev-parse --verify HEAD)" npm run build
```

The second command rejects disagreement instead of silently showing incorrect source attribution.

## External archive/static builder handoff (NOT implemented in this repository)

The external `rebuild_and_push_demo.py` / demo-watch process reportedly downloads source without `.git`. **Its behavior has not been changed or verified by this PR.** The operator must:

1. Resolve and record the **full 40-character GitHub commit SHA** for the exact intended source. Download the archive pinned to **that SHA**, not a moving branch name after separately resolving its tip. Verify the downloaded source identity through the API/recorded immutable fetch and do not substitute the static packaging branch SHA.
2. Run `npm ci` inside the extracted source; pass the downloaded source's SHA as `VITE_SOURCE_SHA` to the actual Vite subprocess environment. For example, using a SHA supplied by the upstream fetch step:

   ```python
   # Illustrative lines for the external builder (not code changed here):
   source_sha = verified_downloaded_commit_sha  # exact 40-hex GitHub source commit
   build_env = {**os.environ, "VITE_SOURCE_SHA": source_sha}
   # Only if the builder can prove its actual UTC build date:
   # build_env["VITE_BUILD_DATE"] = datetime.now(timezone.utc).date().isoformat()
   subprocess.run(["npm", "run", "build"], cwd=extracted_source, env=build_env, check=True)
   ```

3. Save the source SHA, archive identity, dependency lockfile hash, Node/npm versions, build command, relevant **non-secret** configuration, generated asset manifest/hash set, and actual build date outside deterministic assets. Do not claim that a GitHub commit or a green CI run proves uploaded bytes match the built bytes.
4. Independently inspect the built JS for the exact SHA, the generated app's footer URL, and the **actual served** Cloudflare candidate. Compare manifests/assets, runtime headers and routes per #100/#104 before any production-equivalence or rollback claim.

An unchanged external builder that omits `VITE_SOURCE_SHA` will still produce **Source revision unavailable** from a Git-less archive. Merging this code alone cannot repair an already-uploaded Cloudflare deployment. No Cloudflare upload, Vercel update, credentials/configuration change or release approval is performed here.

## Validation

```sh
npm run typecheck
npm test
npm run lint
npm run build
node apps/web/scripts/verify-repeated-build.mjs
```

The build test compares the complete emitted file list and SHA-256 bytes from two successive production builds under identical source, dependencies, toolchain and environment, and checks that a known complete source SHA appears in JavaScript. Git/archive identity, malformed overrides, conflict rejection, missing provenance and date separation have focused Node unit tests. Repeated asset equality is **not** live-hosted asset parity.

The scientific 21 national estimates, 34 Local Context indicators, deterministic planner, offline-only AI boundary, Brief exports and AppShell copy are outside this fix's scope. PR #120 owns footer language and social previews.
