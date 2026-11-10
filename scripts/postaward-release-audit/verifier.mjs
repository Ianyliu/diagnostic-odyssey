/**
 * postaward-release-audit — read-only release-integrity verifier (issue #104, v1).
 *
 * Given a supplied build directory and an expected source revision, this tool
 * computes a machine-readable JSON receipt reporting FOUR separate provenance
 * dimensions, each with its own evidence and verdict:
 *
 *   a) sourceRevisionMatch          — build's recorded source revision vs expected
 *   b) sourceStateClean             — source tree clean/dirty at build time, if verifiable
 *   c) localAssetManifestIntegrity  — SHA-256 of each build asset vs a recorded manifest
 *   d) servedByteVerification       — assets actually served over HTTP vs the manifest
 *                                      (requires authorized deployment access; this
 *                                      local, read-only audit NEVER performs it)
 *
 * Read-only guarantees: this tool reads the supplied build directory, an optional
 * manifest, an optional lock file, and (optionally) package-lock.json at a supplied
 * repo root. It computes hashes and writes ONLY the receipt file at --out
 * (creating parent directories for that path if needed). It never writes into
 * artifacts/reviewed, the source tree, or the build directory, and it performs no
 * network access.
 *
 * Verdict semantics:
 *   - PASS      evidence affirmatively supports the dimension
 *   - FAILED    evidence contradicts the dimension
 *   - UNKNOWN   evidence is missing or unverifiable (never silently passed)
 *   - localVerdict covers a–c only; overallVerdict covers a–d. Because dimension d
 *     can never be proven from a local run, overallVerdict is NEVER VERIFIED here —
 *     a local result never certifies production deployment parity.
 *
 * Run (Node >= 22, plain ESM, no dependencies):
 *   node scripts/postaward-release-audit/verifier.mjs \
 *     --build-dir <path-to-build-output> \
 *     --expected-revision <40-hex-source-sha> \
 *     --manifest <recorded-asset-manifest.json> \
 *     --out <receipt.json>
 *
 * Exit codes: 0 = audit completed and overallVerdict is not FAILED;
 *             1 = overallVerdict is FAILED;
 *             2 = audit could not be performed (bad inputs).
 */
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, posix, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TOOL = "postaward-release-audit";
const TOOL_VERSION = "1.0.0";
const RECEIPT_VERSION = 1;
const HEX40 = /^[0-9a-fA-F]{40}$/;
const HEX64 = /^[0-9a-fA-F]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".jsx", ".ts", ".html", ".json", ".css", ".svg",
  ".txt", ".xml", ".webmanifest", ".map"
]);
const MAX_SCAN_BYTES = 25 * 1024 * 1024;

// Shape produced by JSON.stringify of the Vite-injected __DO_BUILD_PROVENANCE__
// object: {sourceSha, sourceCommitDate, buildDate} — keys as written by
// apps/web/build/sourceProvenance.ts, values possibly null.
const EMBEDDED_PROVENANCE_RE =
  /\{["']?sourceSha["']?\s*:\s*(?:"([0-9a-fA-F]{40})"|null)\s*,\s*["']?sourceCommitDate["']?\s*:\s*(?:"([^"]*)"|null)\s*,\s*["']?buildDate["']?\s*:\s*(?:"([^"]*)"|null)\s*\}/g;
const BARE_SOURCE_SHA_RE = /(?<![A-Za-z0-9_])["']?sourceSha["']?\s*:\s*"([0-9a-fA-F]{40})"/g;

const STATEMENTS = [
  "This receipt was produced by a read-only local audit of a supplied build directory; the tool writes only the receipt file and modifies nothing else.",
  "No dimension is silently passed: missing or unverifiable evidence is reported as UNKNOWN, contradictory evidence as FAILED.",
  "A source-revision match alone is never sufficient for a VERIFIED label; localVerdict VERIFIED additionally requires recorded clean source state and full local asset-manifest integrity.",
  "No local result certifies production deployment parity: deploymentParityCertified is always false in a local receipt, and overallVerdict can be VERIFIED only through the authorized served-byte verification procedure referenced by dimensions.servedByteVerification.",
  "computedAssets records the SHA-256 digest of every regular file in the supplied build directory and is the reference for future served-byte comparisons."
];

const USAGE = `Usage (Node >= 22):
  node scripts/postaward-release-audit/verifier.mjs \\
    --build-dir <path-to-build-output> \\
    --expected-revision <40-hex-source-sha> \\
    --manifest <recorded-asset-manifest.json> \\
    --out <receipt.json>
Optional:
  --lock-file <package-lock.json of the build checkout>
  --repo-root <repo root; records SHA-256 of its package-lock.json read-only>
  --help
Read-only: writes only the receipt file at --out. No network access.
Exit codes: 0 = completed (overall not FAILED); 1 = overall FAILED; 2 = audit error.`;

function normalizeSha(value) {
  return typeof value === "string" && HEX40.test(value) ? value.toLowerCase() : null;
}

function sha256Of(data) {
  return createHash("sha256").update(data).digest("hex");
}

function sha256File(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function sha256FileSync(path) {
  return sha256Of(readFileSync(path));
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

function toRel(root, abs) {
  const r = resolve(root);
  return abs.slice(r.length + 1).split(sep).join(posix.sep);
}

/** Recursive listing of regular files only (symlinks and .git excluded), sorted. */
function walkRegularFiles(dir) {
  const out = [];
  (function rec(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === ".git" && entry.isDirectory()) continue;
      const p = join(d, entry.name);
      if (entry.isDirectory()) rec(p);
      else if (entry.isFile()) out.push(p);
    }
  })(dir);
  return out.sort();
}

/** Parse and validate the structured build metadata record, if present. */
function readStructuredProvenance(buildDir) {
  const p = join(buildDir, "build-provenance.json");
  if (!existsSync(p)) return { present: false, value: null, error: null };
  let raw;
  try {
    raw = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    return { present: true, value: null, error: "invalid JSON: " + e.message };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { present: true, value: null, error: "not a JSON object" };
  }
  const invalidFields = [];
  const sha = normalizeSha(raw.sourceSha);
  if (raw.sourceSha != null && sha === null) invalidFields.push("sourceSha");
  const sourceCommitDate =
    typeof raw.sourceCommitDate === "string" && DATE.test(raw.sourceCommitDate)
      ? raw.sourceCommitDate : null;
  const buildDate =
    typeof raw.buildDate === "string" && DATE.test(raw.buildDate) ? raw.buildDate : null;
  let sourceState = null;
  if (raw.sourceState && typeof raw.sourceState === "object" && !Array.isArray(raw.sourceState)) {
    sourceState = {
      clean: typeof raw.sourceState.clean === "boolean" ? raw.sourceState.clean : null,
      modified: Number.isInteger(raw.sourceState.modified) ? raw.sourceState.modified : null,
      untracked: Number.isInteger(raw.sourceState.untracked) ? raw.sourceState.untracked : null
    };
  } else if (raw.sourceState != null) {
    invalidFields.push("sourceState");
  }
  let toolchain = null;
  if (raw.toolchain && typeof raw.toolchain === "object" && !Array.isArray(raw.toolchain)) {
    toolchain = {
      node: typeof raw.toolchain.node === "string" ? raw.toolchain.node : null,
      npm: typeof raw.toolchain.npm === "string" ? raw.toolchain.npm : null
    };
  } else if (raw.toolchain != null) {
    invalidFields.push("toolchain");
  }
  let lockDigest = null;
  if (raw.dependencyLockDigest != null) {
    const d = String(raw.dependencyLockDigest);
    const m = /^(?:sha256:)?([0-9a-fA-F]{64})$/.exec(d);
    lockDigest = m ? "sha256:" + m[1].toLowerCase() : null;
    if (lockDigest === null) invalidFields.push("dependencyLockDigest");
  }
  return {
    present: true,
    value: {
      sourceSha: sha,
      sourceCommitDate,
      buildDate,
      sourceState,
      toolchain,
      dependencyLockDigest: lockDigest
    },
    error: invalidFields.length
      ? "invalid or missing fields: " + invalidFields.join(", ")
      : null
  };
}

/** Scan text assets for the Vite-injected provenance object (no structured file needed). */
function scanEmbeddedProvenance(buildDir, files) {
  const found = [];
  const skippedLarge = [];
  const inText = (abs) => {
    const name = basename(abs);
    const dot = name.lastIndexOf(".");
    return dot > 0 && TEXT_EXTENSIONS.has(name.slice(dot).toLowerCase());
  };
  const tryScan = (abs, rel, push) => {
    let st;
    try {
      st = statSync(abs);
    } catch {
      return;
    }
    if (st.size > MAX_SCAN_BYTES) {
      skippedLarge.push(rel);
      return;
    }
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      return;
    }
    for (const m of text.matchAll(push.re)) {
      push.make(m);
    }
  };
  for (const abs of files) {
    if (!inText(abs)) continue;
    const rel = toRel(buildDir, abs);
    tryScan(abs, rel, {
      re: EMBEDDED_PROVENANCE_RE,
      make: (m) => found.push({
        file: rel,
        sha: m[1] ? m[1].toLowerCase() : null,
        sourceCommitDate: m[2] || null,
        buildDate: m[3] || null
      })
    });
  }
  if (found.length === 0) {
    for (const abs of files) {
      if (!inText(abs)) continue;
      const rel = toRel(buildDir, abs);
      tryScan(abs, rel, {
        re: BARE_SOURCE_SHA_RE,
        make: (m) => found.push({ file: rel, sha: m[1].toLowerCase(), sourceCommitDate: null, buildDate: null })
      });
    }
  }
  return { found, skippedLarge };
}

/** Load a recorded asset manifest: {"assets":{relPath: sha256hex}} or flat {relPath: sha256hex}. */
function loadManifest(path) {
  if (!existsSync(path)) {
    return { assets: null, error: "manifest file not found: " + path };
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { assets: null, error: "invalid JSON: " + e.message };
  }
  const candidate =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw.assets && typeof raw.assets === "object" && !Array.isArray(raw.assets)
        ? raw.assets
        : raw
      : null;
  if (!candidate) {
    return { assets: null, error: 'invalid schema: expected {"assets": {relPath: sha256hex}}' };
  }
  const assets = {};
  for (const [k, v] of Object.entries(candidate)) {
    if (typeof v !== "string" || !HEX64.test(v)) {
      return { assets: null, error: `invalid schema: asset "${k}" is not a 64-character hex SHA-256` };
    }
    if (!k || k.startsWith("/") || k.includes("\\") || k.split("/").some((s) => s === "..")) {
      return { assets: null, error: `invalid schema: asset path "${k}" must be a relative POSIX path` };
    }
    assets[k] = v.toLowerCase();
  }
  return { assets, error: null };
}

function dim(verdict, evidence) {
  return { verdict, evidence };
}

function servedDimension() {
  return dim("UNKNOWN", {
    reason:
      "served-byte verification requires authorized access to the deployment; this local, read-only audit does not and cannot fetch deployment URLs",
    procedureRef:
      "docs/operations/postaward-release-audit.md#served-byte-verification-authorized-operator-procedure"
  });
}

function allUnknownDimensions(reason) {
  return {
    sourceRevisionMatch: dim("UNKNOWN", { reason }),
    sourceStateClean: dim("UNKNOWN", { reason }),
    localAssetManifestIntegrity: dim("UNKNOWN", { reason }),
    servedByteVerification: servedDimension()
  };
}

async function writeReceipt(receipt, out) {
  const target = resolve(out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(receipt, null, 2) + "\n", "utf8");
}

/**
 * Audit a supplied build directory and write the receipt at options.out.
 * Returns the receipt object. Writes nothing except the receipt file.
 */
export async function auditBuild(options) {
  const expected = normalizeSha(options.expectedRevision);
  const receipt = {
    receiptVersion: RECEIPT_VERSION,
    kind: "postaward-release-audit-receipt",
    generatedAt: new Date().toISOString(),
    audit: {
      tool: TOOL,
      toolVersion: TOOL_VERSION,
      nodeVersion: process.version,
      platform: process.platform
    },
    auditError: null
  };

  let inputError = null;
  if (!expected) {
    inputError = "expected revision must be exactly 40 hexadecimal characters";
  } else if (!options.buildDir) {
    inputError = "build directory was not supplied";
  } else {
    try {
      if (!statSync(resolve(options.buildDir)).isDirectory()) inputError = "build directory is not a directory";
    } catch {
      inputError = "build directory does not exist: " + options.buildDir;
    }
  }

  if (inputError) {
    receipt.auditError = inputError;
    receipt.inputs = {
      buildDir: options.buildDir ?? null,
      expectedRevision: expected,
      manifestPath: options.manifestPath ?? null,
      lockFilePath: options.lockFilePath ?? null,
      repoRoot: options.repoRoot ?? null
    };
    receipt.recordedBuildMetadata = null;
    receipt.recordedToolchain = { node: null, npm: null, basis: "unavailable" };
    receipt.recordedDependencyLockDigest = { value: null, basis: "unavailable", path: null };
    receipt.computedAssets = null;
    receipt.dimensions = allUnknownDimensions("audit could not be performed: " + inputError);
    receipt.localVerdict = "UNKNOWN";
    receipt.overallVerdict = "UNKNOWN";
    receipt.deploymentParityCertified = false;
    receipt.statements = STATEMENTS;
    await writeReceipt(receipt, options.out);
    return receipt;
  }

  const buildDir = resolve(options.buildDir);
  const files = walkRegularFiles(buildDir);
  const manifest = {};
  for (const abs of files) manifest[toRel(buildDir, abs)] = await sha256File(abs);
  const computedManifestDigest = "sha256:" + sha256Of(canonicalJson(manifest));

  const structured = readStructuredProvenance(buildDir);
  const embedded = scanEmbeddedProvenance(buildDir, files);
  const sourceState = structured.value ? structured.value.sourceState : null;
  const embeddedShas = [...new Set(embedded.found.filter((f) => f.sha).map((f) => f.sha))];

  // Resolve the recorded source revision across both evidence channels.
  let recordedSha = null;
  let recordedFrom = null;
  let conflict = [];
  if (structured.value && structured.value.sourceSha) {
    recordedSha = structured.value.sourceSha;
    recordedFrom = "build-provenance.json";
  }
  if (embeddedShas.length > 1) conflict = [...embeddedShas].sort();
  if (recordedSha && embeddedShas.length > 0 && !embeddedShas.includes(recordedSha)) {
    conflict = [...new Set([recordedSha, ...embeddedShas])].sort();
  }
  if (!recordedSha && !conflict.length && embeddedShas.length === 1) {
    recordedSha = embeddedShas[0];
    recordedFrom = "embedded:" + embedded.found.find((f) => f.sha === recordedSha).file;
  }

  let dimA;
  if (conflict.length) {
    dimA = dim("FAILED", {
      expected,
      recorded: null,
      reason: "conflicting recorded source revisions in the build evidence",
      conflictingRecordedRevisions: conflict
    });
  } else if (!recordedSha) {
    dimA = dim("UNKNOWN", {
      expected,
      recorded: null,
      reason: "no recorded source revision found in build metadata or bundle"
    });
  } else if (recordedSha === expected) {
    dimA = dim("PASS", { expected, recorded: recordedSha, recordedFrom });
  } else {
    dimA = dim("FAILED", {
      expected,
      recorded: recordedSha,
      recordedFrom,
      reason: "recorded source revision does not match the expected revision"
    });
  }

  let dimB;
  if (sourceState && sourceState.clean === true) {
    dimB = dim("PASS", { recorded: sourceState, basis: "build-provenance.json" });
  } else if (sourceState && sourceState.clean === false) {
    dimB = dim("FAILED", {
      recorded: sourceState,
      basis: "build-provenance.json",
      reason: "recorded build metadata states the source tree was not clean at build time"
    });
  } else {
    dimB = dim("UNKNOWN", {
      basis: sourceState ? "build-provenance.json (clean not recorded)" : "not-recorded",
      reason:
        "source cleanliness at build time is not recorded in verifiable build metadata; it is never inferred"
    });
  }

  let dimC;
  if (!options.manifestPath) {
    dimC = dim("UNKNOWN", {
      reason:
        "no recorded asset manifest supplied; the computed manifest is recorded in computedAssets for future comparison"
    });
  } else {
    const man = loadManifest(options.manifestPath);
    if (man.error) {
      dimC = dim("UNKNOWN", {
        manifestPath: resolve(options.manifestPath),
        manifestError: man.error,
        reason: "the recorded manifest is unreadable or has an invalid schema; local integrity cannot be established"
      });
    } else {
      const mismatches = [];
      const missing = [];
      const unexpected = [];
      let matched = 0;
      for (const [p, d] of Object.entries(man.assets)) {
        if (!(p in manifest)) {
          missing.push(p);
        } else if (manifest[p] !== d) {
          mismatches.push({ path: p, expected: d, actual: manifest[p] });
        } else {
          matched++;
        }
      }
      for (const p of Object.keys(manifest)) {
        if (!(p in man.assets)) unexpected.push(p);
      }
      const contradicting = missing.length || mismatches.length || unexpected.length;
      dimC = contradicting
        ? dim("FAILED", {
            manifestPath: resolve(options.manifestPath),
            matched,
            missing,
            mismatches,
            unexpected,
            reason: "the build directory does not match the recorded asset manifest"
          })
        : dim("PASS", {
            manifestPath: resolve(options.manifestPath),
            matched,
            manifestAssetCount: Object.keys(man.assets).length,
            diskAssetCount: Object.keys(manifest).length
          });
    }
  }

  const dimD = servedDimension();

  const localDimVerdicts = [dimA.verdict, dimB.verdict, dimC.verdict];
  const localVerdict = localDimVerdicts.includes("FAILED")
    ? "FAILED"
    : localDimVerdicts.every((v) => v === "PASS")
      ? "VERIFIED"
      : "UNKNOWN";
  const overallVerdict =
    localVerdict === "FAILED" || dimD.verdict === "FAILED" ? "FAILED" : "UNKNOWN";

  // Toolchain and dependency-lock digest: recorded where verifiable, labeled by basis.
  const toolchain = structured.value && structured.value.toolchain ? structured.value.toolchain : null;
  let lockValue = null;
  let lockBasis = "unavailable";
  let lockPath = null;
  if (structured.value && structured.value.dependencyLockDigest) {
    lockValue = structured.value.dependencyLockDigest;
    lockBasis = "build-metadata";
  } else if (options.lockFilePath) {
    try {
      lockPath = resolve(options.lockFilePath);
      lockValue = "sha256:" + sha256FileSync(lockPath);
      lockBasis = "supplied-lock-file";
    } catch {
      lockBasis = "supplied-lock-file-unreadable";
    }
  } else if (options.repoRoot) {
    try {
      lockPath = join(resolve(options.repoRoot), "package-lock.json");
      lockValue = "sha256:" + sha256FileSync(lockPath);
      lockBasis = "current-checkout";
    } catch {
      lockBasis = "current-checkout-unreadable";
    }
  }

  const embeddedDates = embedded.found.find((f) => f.sourceCommitDate || f.buildDate);

  receipt.inputs = {
    buildDir: options.buildDir,
    expectedRevision: expected,
    manifestPath: options.manifestPath ? resolve(options.manifestPath) : null,
    lockFilePath: options.lockFilePath ? resolve(options.lockFilePath) : null,
    repoRoot: options.repoRoot ? resolve(options.repoRoot) : null
  };
  receipt.recordedBuildMetadata = {
    source: structured.value
      ? "build-provenance.json"
      : embedded.found.length
        ? "embedded-in-bundle"
        : null,
    recordedSourceSha: recordedSha && !conflict.length ? recordedSha : null,
    recordedSourceCommitDate:
      (structured.value && structured.value.sourceCommitDate) ||
      (embeddedDates && embeddedDates.sourceCommitDate) ||
      null,
    recordedBuildDate:
      (structured.value && structured.value.buildDate) ||
      (embeddedDates && embeddedDates.buildDate) ||
      null,
    recordedSourceState: sourceState,
    structuredError: structured.error,
    embeddedFindings: embedded.found,
    skippedLargeScanFiles: embedded.skippedLarge
  };
  receipt.recordedToolchain = {
    node: toolchain ? toolchain.node : null,
    npm: toolchain ? toolchain.npm : null,
    basis: toolchain ? "build-metadata" : "unavailable",
    note:
      "recorded at build time only if the build pipeline wrote build-provenance.json; not independently re-verified by this audit"
  };
  receipt.recordedDependencyLockDigest = {
    value: lockValue,
    basis: lockBasis,
    path: lockPath,
    note:
      lockBasis === "current-checkout"
        ? "SHA-256 of package-lock.json in the current checkout; not proven to be the build-time lock file"
        : lockBasis === "supplied-lock-file"
          ? "SHA-256 of the lock file supplied for this audit; not independently proven to be the build-time lock file"
          : lockBasis === "build-metadata"
            ? "digest recorded in the build's build-provenance.json; trust depends on that metadata being written by the build pipeline"
            : "no build-time dependency lock digest is recorded in verifiable build metadata"
  };
  receipt.computedAssets = {
    count: files.length,
    manifest,
    manifestDigest: computedManifestDigest,
    note: "SHA-256 of every regular file in the supplied build directory; symlinks and .git are excluded"
  };
  receipt.dimensions = {
    sourceRevisionMatch: dimA,
    sourceStateClean: dimB,
    localAssetManifestIntegrity: dimC,
    servedByteVerification: dimD
  };
  receipt.localVerdict = localVerdict;
  receipt.overallVerdict = overallVerdict;
  receipt.deploymentParityCertified = false;
  receipt.statements = STATEMENTS;

  await writeReceipt(receipt, options.out);
  return receipt;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error("missing value for " + arg);
      return argv[++i];
    };
    switch (arg) {
      case "--build-dir": out.buildDir = next(); break;
      case "--expected-revision": out.expectedRevision = next(); break;
      case "--manifest": out.manifestPath = next(); break;
      case "--lock-file": out.lockFilePath = next(); break;
      case "--repo-root": out.repoRoot = next(); break;
      case "--out": out.out = next(); break;
      case "--help":
      case "-h":
        out.help = true;
        break;
      default:
        throw new Error("unknown argument: " + arg);
    }
  }
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(TOOL + ": " + e.message + "\n" + USAGE);
    return 2;
  }
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (!opts.buildDir || !opts.expectedRevision || !opts.out) {
    console.error(USAGE);
    return 2;
  }
  let receipt;
  try {
    receipt = await auditBuild(opts);
  } catch (e) {
    console.error(TOOL + ": unexpected error: " + e.message);
    return 2;
  }
  console.log(
    TOOL + ": overallVerdict=" + receipt.overallVerdict +
    " localVerdict=" + receipt.localVerdict +
    " receipt=" + opts.out
  );
  if (receipt.auditError) {
    console.error(TOOL + ": auditError: " + receipt.auditError);
    return 2;
  }
  return receipt.overallVerdict === "FAILED" ? 1 : 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(TOOL + ": fatal: " + (e && e.message));
      process.exitCode = 2;
    }
  );
}
