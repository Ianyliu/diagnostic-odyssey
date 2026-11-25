#!/usr/bin/env bash
# Offline Vercel build qualification for apps/web/api (no login, no deployment, no project changes).
#
#   scripts/verify/vercel-function-build.sh
#
# Installs a pinned Vercel CLI into a temporary directory, runs `vercel build` using a throwaway
# local project descriptor (.vercel/project.json holds no credentials and is git-ignored), then:
#   1. asserts the built function set is exactly api/ai-guidance and api/ai-preview;
#   2. asserts the routing config still carries the security headers, SPA rewrite and /api 404;
#   3. imports every built function with Node to prove it resolves at runtime.
# This is local/static evidence only. It does not replace verifying an isolated Vercel Preview.
set -euo pipefail
cd "$(dirname "$0")/../../apps/web"
CLI_VERSION="${VERCEL_CLI_VERSION:-66.6.0}"
TOOLS="$(mktemp -d)"
cleanup() { rm -rf "$TOOLS" .vercel; }
trap cleanup EXIT
npm install --prefix "$TOOLS" --no-audit --no-fund "vercel@${CLI_VERSION}" >/dev/null
mkdir -p .vercel
cat > .vercel/project.json <<'JSON'
{"projectId":"prj_localbuildonly","orgId":"team_localbuildonly","settings":{"framework":"vite","buildCommand":"npm run build","outputDirectory":"dist","installCommand":"true","rootDirectory":null,"nodeVersion":"22.x"}}
JSON
VERCEL_TELEMETRY_DISABLED=1 "$TOOLS/node_modules/.bin/vercel" build --yes --cwd . >"$TOOLS/build.log" 2>&1 || { cat "$TOOLS/build.log"; echo "FAIL: vercel build exited nonzero" >&2; exit 1; }
# The builder type-checks each function with the nearest tsconfig (apps/web/api/tsconfig.json).
if grep -E "error TS[0-9]+" "$TOOLS/build.log"; then echo "FAIL: TypeScript diagnostics reported by the Vercel builder" >&2; exit 1; fi
node --input-type=module - <<'NODE'
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const output = resolve(".vercel/output");
const fail = message => { console.error(`FAIL: ${message}`); process.exit(1); };
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
