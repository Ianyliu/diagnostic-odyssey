#!/usr/bin/env bash
# Local Vercel build qualification for apps/web/api. No login, no deployment, no project changes.
#
#   scripts/verify/vercel-function-build.sh
#
# Safety model (see tests/unit/vercel-function-build-safety.test.mjs):
#   * The build runs in a private temporary copy of the source tree created by this invocation.
#     The repository's own apps/web/.vercel directory (project linkage, pulled env files, build
#     output) is never read, written or deleted.
#   * The copy contains only files Git would track (tracked + untracked-but-not-ignored). Ignored
#     files, every `.env*` file and every `.vercel/` directory are excluded, so secret-bearing
#     environment files are never copied. node_modules is linked read-only from the repository.
#   * A throwaway project descriptor (no credentials) is written inside the temporary copy only.
#   * The CLI runs with a temporary --global-config directory, so it cannot read the developer's
#     Vercel login.
#   * Cleanup removes only the temporary directory created by this invocation, on success,
#     failure and SIGINT/SIGTERM/SIGHUP.
#
# Network: provisioning the pinned CLI (`npm install vercel@<version>`) needs the npm registry.
# Set VERCEL_BIN to an already-provisioned CLI to skip that step. The build itself does not
# deploy and does not need credentials.
#
# Checks:
#   1. the built function set is exactly api/ai-guidance and api/ai-preview;
#   2. the routing config still carries the security headers, SPA rewrite and /api 404;
#   3. every built function imports under Node, proving it resolves at runtime;
#   4. the Vercel builder reported no TypeScript diagnostics.
# This is local/static evidence only. It does not replace verifying an isolated Vercel Preview.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
CLI_VERSION="${VERCEL_CLI_VERSION:-66.6.0}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/vercel-function-build.XXXXXX")"
WORK="$(cd "$WORK" && pwd -P)"
CHILD=""

cleanup() {
  local status=$?
  trap - EXIT INT TERM HUP
  if [ -n "$CHILD" ] && kill -0 "$CHILD" 2>/dev/null; then kill "$CHILD" 2>/dev/null || true; wait "$CHILD" 2>/dev/null || true; fi
  # Only ever remove the directory mktemp created for this invocation.
  case "$WORK" in
    */vercel-function-build.*) rm -rf -- "$WORK" ;;
  esac
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# Run a command in the background and wait, so signals interrupt it promptly and cleanup runs.
run() { "$@" & CHILD=$!; wait "$CHILD"; local status=$?; CHILD=""; return "$status"; }

echo "workdir: $WORK (temporary; removed on exit)"

# 1. Private source copy: Git-visible files only, never .env* or .vercel/.
SRC="$WORK/src"
mkdir -p "$SRC"
( cd "$ROOT" && git ls-files -z --cached --others --exclude-standard ) | ROOT="$ROOT" SRC="$SRC" node -e '
  const { cpSync, existsSync, lstatSync, readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const files = readFileSync(0, "utf8").split("\0").filter(Boolean);
  let copied = 0;
  for (const file of files) {
    const parts = file.split("/");
    if (parts.includes(".vercel") || parts.includes("node_modules") || parts.some(part => /^\.env(\.|$)/.test(part) && part !== ".env.example")) continue;
    const from = join(process.env.ROOT, file);
    if (!existsSync(from) || lstatSync(from).isDirectory()) continue; // deleted in the working tree
    cpSync(from, join(process.env.SRC, file), { recursive: false, verbatimSymlinks: true });
    copied += 1;
  }
  if (copied === 0) { console.error("FAIL: no source files copied"); process.exit(1); }
  console.log(`copied ${copied} source files`);
'
[ -d "$ROOT/node_modules" ] || { echo "FAIL: run npm ci first (node_modules missing)" >&2; exit 1; }
ln -s "$ROOT/node_modules" "$SRC/node_modules"
if [ -d "$ROOT/apps/web/node_modules" ]; then ln -s "$ROOT/apps/web/node_modules" "$SRC/apps/web/node_modules"; fi
WEB="$SRC/apps/web"
mkdir -p "$WEB/.vercel"
cat > "$WEB/.vercel/project.json" <<'JSON'
{"projectId":"prj_localbuildonly","orgId":"team_localbuildonly","settings":{"framework":"vite","buildCommand":"npm run build","outputDirectory":"dist","installCommand":"true","rootDirectory":null,"nodeVersion":"22.x"}}
JSON

# 2. CLI provisioning (network) unless an existing CLI is supplied.
if [ -n "${VERCEL_BIN:-}" ]; then
  VERCEL="$VERCEL_BIN"
  echo "using provided CLI: $VERCEL"
else
  echo "provisioning vercel@${CLI_VERSION} from the npm registry (network) into the workdir"
  run npm install --prefix "$WORK/cli" --no-audit --no-fund --no-save "vercel@${CLI_VERSION}" >"$WORK/cli-install.log" 2>&1 \
    || { cat "$WORK/cli-install.log"; echo "FAIL: could not provision the Vercel CLI" >&2; exit 1; }
  VERCEL="$WORK/cli/node_modules/.bin/vercel"
fi

# 3. Build in the private copy with an empty, private CLI configuration.
mkdir -p "$WORK/global-config"
VERCEL_TELEMETRY_DISABLED=1 run "$VERCEL" build --yes --cwd "$WEB" --global-config "$WORK/global-config" >"$WORK/build.log" 2>&1 \
  || { cat "$WORK/build.log"; echo "FAIL: vercel build exited nonzero" >&2; exit 1; }
# The builder type-checks each function with the nearest tsconfig (apps/web/api/tsconfig.json).
if grep -E "error TS[0-9]+" "$WORK/build.log"; then echo "FAIL: TypeScript diagnostics reported by the Vercel builder" >&2; exit 1; fi

# 4. Inspect the build output (inside the workdir only). The checker is written to a file because
# a backgrounded command's stdin is /dev/null, which would silently turn a heredoc into an empty script.
cat > "$WORK/inspect-output.mjs" <<'NODE'
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const output = process.env.OUTPUT;
const fail = message => { console.error(`FAIL: ${message}`); process.exit(1); };
if (!existsSync(`${output}/functions/api`)) fail("no functions were built");
const functions = readdirSync(`${output}/functions/api`).sort();
if (JSON.stringify(functions) !== JSON.stringify(["ai-guidance.func", "ai-preview.func"])) fail(`unexpected function set: ${functions}`);
const config = JSON.parse(readFileSync(`${output}/config.json`, "utf8"));
const text = JSON.stringify(config.routes);
for (const required of ["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "/index.html?path=$1", "\"status\":404"]) {
  if (!text.includes(required)) fail(`routing config lost ${required}`);
}
for (const name of functions) {
  const vc = JSON.parse(readFileSync(`${output}/functions/api/${name}/.vc-config.json`, "utf8"));
  if (!existsSync(`${output}/functions/api/${name}/${vc.handler}`)) fail(`${name}: handler ${vc.handler} missing`);
  try {
    const module = await import(pathToFileURL(`${output}/functions/api/${name}/${vc.handler}`).href);
    console.log(`PASS: ${name} (${vc.runtime}) loads; exports: ${Object.keys(module).sort().join(", ")}`);
  } catch (error) {
    fail(`${name} does not load at runtime: ${error.code ?? ""} ${String(error.message).split("\n")[0]}`);
  }
}
console.log("PASS: function inventory, routing config and runtime resolution");
NODE
OUTPUT="$WEB/.vercel/output" run node "$WORK/inspect-output.mjs"
