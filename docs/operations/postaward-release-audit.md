# Post-award release audit (issue #104, v1)

A **read-only** verifier that checks the integrity and provenance of a web-app
**build directory** against an **expected source revision**, and produces a
machine-readable JSON **receipt**. It is the first, bounded piece of
reproducible release-integrity work for the Diagnostic Odyssey web app.

This harness **complements — it does not duplicate or replace —** the existing
records:

- [`docs/operations/build-provenance.md`](build-provenance.md) — the public
  source-revision **stamp** embedded in the Vite bundle
  (`__DO_BUILD_PROVENANCE__` → `{sourceSha, sourceCommitDate, buildDate}`).
  This verifier *reads* that stamp (structured `build-provenance.json` if the
  build pipeline writes one, otherwise the embedded bundle literal) as evidence.
- [`docs/analytical-release-workflow.md`](../analytical-release-workflow.md) —
  the **scientific-artifact** release workflow (`SHA256SUMS`, reviewed
  manifests, explicit promotion). This tool deliberately does **not** touch
  `artifacts/reviewed`, MEPS/WV artifacts, or the Promotion gate; it audits the
  **web build** only.
- `.github/workflows/ci.yml` and `meps-candidate.yml` — CI already asserts
  `git rev-parse HEAD == $GITHUB_SHA`. This tool's revision dimension is the
  build-side analogue of that same discipline, applied to a supplied build.

## Scope and the four provenance dimensions

The verifier reports **four distinct provenance dimensions separately**, each
with its own evidence and verdict (`PASS` / `FAILED` / `UNKNOWN`):

| Dimension | What it checks | Local verdict possible |
| --- | --- | --- |
| **a) `sourceRevisionMatch`** | The build's *recorded* source revision (SHA) vs the **expected** revision supplied by the caller. | PASS / FAILED / UNKNOWN |
| **b) `sourceStateClean`** | Whether the source tree was **clean** at build time, **if verifiable** from build metadata. | PASS / FAILED / UNKNOWN |
| **c) `localAssetManifestIntegrity`** | SHA-256 of **each build asset** on disk vs a **recorded manifest** (tamper/missing/extra detection). | PASS / FAILED / UNKNOWN |
| **d) `servedByteVerification`** | Whether the assets **actually served over HTTP** match the manifest. | **UNKNOWN only** (see below) |

Where verifiable, the receipt also records: the git SHA, **toolchain details**
(`node`/`npm` versions), the **dependency-lock digest** (SHA-256 of
`package-lock.json`), and the **SHA-256 asset manifest** (plus a digest of the
computed manifest). These are recorded as **evidence**, labeled by their basis
(`build-metadata` / `supplied-lock-file` / `current-checkout` / `unavailable`)
— they are not silently assumed.

### Hard rules

- **Never** label overall provenance `VERIFIED` on a revision match alone.
  `localVerdict` may only be `VERIFIED` when **all of a–c** pass (revision
  match **and** recorded-clean source state **and** full local asset-manifest
  integrity).
- **Missing or unverifiable** dimensions are reported as `UNKNOWN` (never
  silently passed); **contradictory** evidence is `FAILED`.
- **No local result certifies production deployment parity.** Dimension (d)
  requires authorized access to the deployment and is **always `UNKNOWN` in a
  local run**. Therefore `overallVerdict` (which covers a–d) **can never be
  `VERIFIED` from this tool**, and `deploymentParityCertified` is always
  `false`. Both of these are stated explicitly in every receipt.

### Verdict semantics

- **PASS** — evidence affirmatively supports the dimension.
- **FAILED** — evidence contradicts the dimension.
- **UNKNOWN** — evidence is missing or unverifiable (fail-closed).

- `localVerdict` covers dimensions **a–c** only.
- `overallVerdict` covers **a–d**. Because (d) can never be proven locally,
  `overallVerdict` ∈ {`FAILED`, `UNKNOWN`} from this tool. It may become
  `VERIFIED` only via the authorized served-byte procedure (future, out of
  scope for v1).

## Read-only guarantees

The tool:

- **reads** the supplied build directory, an optional recorded manifest, an
  optional lock file, and (optionally) `package-lock.json` at a supplied repo
  root;
- **computes** SHA-256 hashes (streamed, so large assets are not fully loaded);
- **writes ONLY** the single receipt file at `--out` (creating parent
  directories for that path if needed).

It **never** writes into `artifacts/reviewed`, the source tree, or the build
directory; it performs **no** network access; and it is covered by a test that
asserts the build directory is byte-identical (same regular-file set) after an
audit.

## Inputs

| Flag | Required | Meaning |
| --- | --- | --- |
| `--build-dir <dir>` | yes | The build output directory to audit (e.g. a Vite `dist`). |
| `--expected-revision <sha>` | yes | Expected 40-hex source SHA the build should have been made from. |
| `--out <receipt.json>` | yes | Path of the **only** file the tool writes. |
| `--manifest <file>` | no | Recorded asset manifest (`{"assets":{relPath: sha256hex}}` or flat). Without it, dimension (c) is `UNKNOWN`. |
| `--lock-file <package-lock.json>` | no | A build-checkout lock file whose SHA-256 is recorded (basis `supplied-lock-file`). |
| `--repo-root <dir>` | no | Records the SHA-256 of `<dir>/package-lock.json` read-only (basis `current-checkout`). |

### Recorded build metadata (two evidence channels)

1. **Structured** — a `build-provenance.json` **inside the build directory**,
   if the build pipeline writes one. Recognized fields: `sourceSha`,
   `sourceCommitDate`, `buildDate`, `sourceState {clean, modified, untracked}`,
   `toolchain {node, npm}`, `dependencyLockDigest`.
2. **Embedded** — the Vite-injected provenance literal
   (`{"sourceSha":"…","sourceCommitDate":"…","buildDate":null}`) scanned from
   text assets. Used when no structured file is present, and cross-checked
   against it when both exist (a conflict is `FAILED`).

Current Vite builds in this repo only embed the **revision** (channel 2) and do
not record source cleanliness or toolchain, so for those, dimensions (b) and
the toolchain/lock records resolve to `UNKNOWN`/`unavailable`. This is correct
fail-closed behavior, not a defect: v1 records what is verifiable and never
invents the rest.

## How to run

Requires **Node >= 22** (verified on Node v26). Plain ESM, **no dependencies**,
no build step.

**Verdict semantics / exit codes:** `0` = audit completed and `overallVerdict`
is not `FAILED`; `1` = `overallVerdict` is `FAILED`; `2` = the audit could not
be performed (bad inputs).

```sh
# Run the verifier against a supplied build directory
node scripts/postaward-release-audit/verifier.mjs \
  --build-dir <path-to-build-output> \
  --expected-revision <40-hex-source-sha> \
  --manifest <recorded-asset-manifest.json> \
  --out <receipt.json>

# Optionally record a lock digest from the current checkout
node scripts/postaward-release-audit/verifier.mjs \
  --build-dir <path-to-build-output> \
  --expected-revision <40-hex-source-sha> \
  --manifest <recorded-asset-manifest.json> \
  --repo-root . \
  --out <receipt.json>

# Run the test suite (synthetic fixtures only; no real build)
node --test tests/postaward-release-audit/
```

The receipt is emitted as pretty-printed JSON at `--out`. A one-line summary is
printed to stdout; an `auditError` (if any) is printed to stderr.

## Receipt schema (v1)

Top-level fields (all present in every receipt):

| Field | Type | Meaning |
| --- | --- | --- |
| `receiptVersion` | int | Schema version (`1`). |
| `kind` | string | `"postaward-release-audit-receipt"`. |
| `generatedAt` | string (ISO-8601) | When the audit ran. |
| `audit` | object | `{tool, toolVersion, nodeVersion, platform}`. |
| `auditError` | string \| null | Set when the audit could not run (inputs bad); all dimensions then `UNKNOWN`. |
| `inputs` | object | `buildDir`, `expectedRevision`, `manifestPath`, `lockFilePath`, `repoRoot` (as supplied). |
| `recordedBuildMetadata` | object \| null | `source` (`build-provenance.json` \| `embedded-in-bundle` \| null), `recordedSourceSha`, `recordedSourceCommitDate`, `recordedBuildDate`, `recordedSourceState`, `structuredError`, `embeddedFindings[]`, `skippedLargeScanFiles[]`. |
| `recordedToolchain` | object | `{node, npm, basis, note}`. |
| `recordedDependencyLockDigest` | object | `{value, basis, path, note}`. |
| `computedAssets` | object | `{count, manifest{relPath: sha256}, manifestDigest, note}` — SHA-256 of every regular file in the build directory. |
| `dimensions` | object | The four dimensions, each `{verdict, evidence}` (see table above). |
| `localVerdict` | string | `VERIFIED` \| `FAILED` \| `UNKNOWN` over a–c. |
| `overallVerdict` | string | `FAILED` \| `UNKNOWN` over a–d (never `VERIFIED` locally). |
| `deploymentParityCertified` | bool | Always `false`. |
| `statements` | string[] | Fixed, explicit statements incl. the no-local-parity rule. |

Per-dimension `evidence` carries the specific data that drove the verdict
(expected vs recorded SHA, `recordedFrom`, `clean` flag, `matched`/`missing`/
`mismatches`/`unexpected` asset lists, `manifestError`, etc.) so a reviewer can
see *why* a dimension passed or failed without re-running the audit.

## Served-byte verification — authorized operator procedure

Dimension (d) is **not performed by this tool**. It requires authorized access
to the live deployment. The procedure below is **documented only**; an
authorized operator (not this harness, and not automated CI in this repo)
performs it.

**Preconditions:**
- The local audit receipt for the build under test (provides
  `computedAssets.manifest` and `manifestDigest`).
- Authorized credentials / network access to the deployment origin.

**Procedure:**
1. Resolve the deployment base URL (the origin actually serving the build).
2. For **each** asset path `P` in `computedAssets.manifest` with expected digest
   `D`:
   - `GET {base}/{P}` over HTTPS with the operator's authorized client.
   - Confirm HTTP `200` and that `Content-Length` (or the observed byte count)
     matches the size of the local asset.
   - Compute SHA-256 over the **served bytes**.
   - Compare to `D`. A mismatch is a **deployment divergence** — record the
     asset, both digests, and the URL.
3. Verify **security headers** on the document and each asset class (record
   observed values as evidence):
   - `Content-Security-Policy` present and matching the expected policy.
   - `Strict-Transport-Security` (HSTS) present with an acceptable `max-age`.
   - `X-Content-Type-Options: nosniff`.
   - `Referrer-Policy` set; correct `Content-Type` per asset type.
4. Assemble a **served-verification record**: base URL, per-asset served
   digest vs expected, header observations, operator, timestamp, and the
   `manifestDigest` being verified against.
5. Only when **every** served asset digest matches **and** the expected security
   headers are observed may the record support a `VERIFIED` claim for dimension
   (d) — and therefore for `overallVerdict`. Any single mismatch leaves the
   dimension `FAILED` (evidence contradicts) or, if access was insufficient,
   `UNKNOWN` (evidence missing).

This record is the **only** path by which `overallVerdict` can become
`VERIFIED`. Until it exists, treat the build as locally verified at most.

## Explicit non-claims

- A green local audit (even `localVerdict: VERIFIED`) **does not prove the
  deployment serves these bytes**, that headers are enforced in production, or
  that the deployed revision equals the expected revision.
- This tool does not **sign** builds, does not verify **supply-chain**
  integrity of dependencies beyond a lock digest, and does not re-run the app,
  its tests, or any production build.
- It does not modify or read `artifacts/reviewed`, MEPS/WV artifacts, or the
  Promotion gate.

## v1 limitations (what this cannot verify yet)

- **Served-byte / production parity** (dimension d) — by design, local only.
- **Source cleanliness** when the build pipeline does not write
  `build-provenance.json` (dimension b → `UNKNOWN`). Current Vite builds do not
  record this, so real builds currently resolve (b) to `UNKNOWN`.
- **Build-time toolchain and lock digest** — recorded only if the build writes
  them; a `current-checkout` lock digest is labeled as such and is **not**
  proven to be the build-time file.
- **Supply-chain / dependency integrity** — only a lock-file digest, not a
  provenance proof of each dependency.
- **Rebuild reproducibility** — v1 compares a *supplied* build to a manifest;
  it does not rebuild from source and diff (that needs the full toolchain and
  is intentionally out of scope).

## Synthetic example receipt

> **SYNTHETIC.** Generated by running this verifier against the synthetic
> fixture build at
> `tests/postaward-release-audit/fixtures/good-build` (not a real app build).
> The `sourceSha`, dates, toolchain versions, and lock digest in the fixture's
> `build-provenance.json` are invented; only the SHA-256 asset values,
> `manifestDigest`, and the `current-checkout` lock digest reflect actual bytes
> of the checked-in fixture/lock file. Note `overallVerdict` is `UNKNOWN` even
> though `localVerdict` is `VERIFIED` — the served-byte dimension can never be
> proven locally.

```json
{
  "receiptVersion": 1,
  "kind": "postaward-release-audit-receipt",
  "generatedAt": "2026-11-10T20:08:48.554Z",
  "audit": {
    "tool": "postaward-release-audit",
    "toolVersion": "1.0.0",
    "nodeVersion": "v26.8.1",
    "platform": "darwin"
  },
  "auditError": null,
  "inputs": {
    "buildDir": "tests/postaward-release-audit/fixtures/good-build",
    "expectedRevision": "6f1a3b5c8d2e4f7a0b1c9d3e5f7a0b2c4d6e8f10",
    "manifestPath": "/Users/ianliu/code/diagnostic-odyssey/tests/postaward-release-audit/fixtures/good-manifest.json",
    "lockFilePath": null,
    "repoRoot": "/Users/ianliu/code/diagnostic-odyssey"
  },
  "recordedBuildMetadata": {
    "source": "build-provenance.json",
    "recordedSourceSha": "6f1a3b5c8d2e4f7a0b1c9d3e5f7a0b2c4d6e8f10",
    "recordedSourceCommitDate": "2026-11-01",
    "recordedBuildDate": "2026-11-02",
    "recordedSourceState": {
      "clean": true,
      "modified": 0,
      "untracked": 0
    },
    "structuredError": null,
    "embeddedFindings": [
      {
        "file": "assets/index-0a1b2c3d.js",
        "sha": "6f1a3b5c8d2e4f7a0b1c9d3e5f7a0b2c4d6e8f10",
        "sourceCommitDate": "2026-11-01",
        "buildDate": "2026-11-02"
      }
    ],
    "skippedLargeScanFiles": []
  },
  "recordedToolchain": {
    "node": "v22.11.0",
    "npm": "10.9.0",
    "basis": "build-metadata",
    "note": "recorded at build time only if the build pipeline wrote build-provenance.json; not independently re-verified by this audit"
  },
  "recordedDependencyLockDigest": {
    "value": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "basis": "build-metadata",
    "path": null,
    "note": "digest recorded in the build's build-provenance.json; trust depends on that metadata being written by the build pipeline"
  },
  "computedAssets": {
    "count": 5,
    "manifest": {
      "assets/index-0a1b2c3d.js": "60ff4b1e87c76320339958c4fddaabe3d5cffd1a898bc86eda7929b8230bb9e3",
      "assets/style-4d5e6f70.css": "a8c07e00129bdbc1a1c11a79384471774d34a8ec2b272b84e2e8373026773beb",
      "build-provenance.json": "4fe27e6c908b5f2fda550742c159857b46755104263389d958d2321944b24436",
      "favicon.svg": "28c3ccd83cf1b8e9629bee7b34b84fb92a78013834a75eae3e1e373dc047fb4f",
      "index.html": "4d28ce167f39123d97bfaa22a26a45df4326f092d8b8d9f8d8c9ce7d976b8cbc"
    },
    "manifestDigest": "sha256:b7bb8eff4ddb8f57d21f966896f2004aff17a2775a0c8f86ddb276919c03bab4",
    "note": "SHA-256 of every regular file in the supplied build directory; symlinks and .git are excluded"
  },
  "dimensions": {
    "sourceRevisionMatch": {
      "verdict": "PASS",
      "evidence": {
        "expected": "6f1a3b5c8d2e4f7a0b1c9d3e5f7a0b2c4d6e8f10",
        "recorded": "6f1a3b5c8d2e4f7a0b1c9d3e5f7a0b2c4d6e8f10",
        "recordedFrom": "build-provenance.json"
      }
    },
    "sourceStateClean": {
      "verdict": "PASS",
      "evidence": {
        "recorded": {
          "clean": true,
          "modified": 0,
          "untracked": 0
        },
        "basis": "build-provenance.json"
      }
    },
    "localAssetManifestIntegrity": {
      "verdict": "PASS",
      "evidence": {
        "manifestPath": "/Users/ianliu/code/diagnostic-odyssey/tests/postaward-release-audit/fixtures/good-manifest.json",
        "matched": 5,
        "manifestAssetCount": 5,
        "diskAssetCount": 5
      }
    },
    "servedByteVerification": {
      "verdict": "UNKNOWN",
      "evidence": {
        "reason": "served-byte verification requires authorized access to the deployment; this local, read-only audit does not and cannot fetch deployment URLs",
        "procedureRef": "docs/operations/postaward-release-audit.md#served-byte-verification-authorized-operator-procedure"
      }
    }
  },
  "localVerdict": "VERIFIED",
  "overallVerdict": "UNKNOWN",
  "deploymentParityCertified": false,
  "statements": [
    "This receipt was produced by a read-only local audit of a supplied build directory; the tool writes only the receipt file and modifies nothing else.",
    "No dimension is silently passed: missing or unverifiable evidence is reported as UNKNOWN, contradictory evidence as FAILED.",
    "A source-revision match alone is never sufficient for a VERIFIED label; localVerdict VERIFIED additionally requires recorded clean source state and full local asset-manifest integrity.",
    "No local result certifies production deployment parity: deploymentParityCertified is always false in a local receipt, and overallVerdict can be VERIFIED only through the authorized served-byte verification procedure referenced by dimensions.servedByteVerification.",
    "computedAssets records the SHA-256 digest of every regular file in the supplied build directory and is the reference for future served-byte comparisons."
  ]
}
```
