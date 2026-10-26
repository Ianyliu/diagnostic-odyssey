import assert from "node:assert/strict";
import console from "node:console";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dist = join(root, "apps", "web", "dist");

function snapshot() {
  if (!existsSync(dist)) throw new Error("Build assets are missing: run npm run build first");
  const entries = [];
  const visit = directory => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isDirectory()) visit(path);
      else if (item.isFile()) {
        entries.push([relative(dist, path), createHash("sha256").update(readFileSync(path)).digest("hex")]);
      }
    }
  };
  visit(dist);
  entries.sort((a, b) => a[0].localeCompare(b[0], "en"));
  if (!entries.length) throw new Error("Empty build output");
  return entries;
}

const first = snapshot();
execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", [
  "run", "build", "--workspace", "@diagnostic-odyssey/web"
], { cwd: root, stdio: "inherit", env: process.env });
const second = snapshot();
assert.deepEqual(second, first, "Repeated builds from the same input must produce identical paths and SHA-256 bytes");

let sourceSha = process.env.VITE_SOURCE_SHA?.toLowerCase() ?? null;
if (!sourceSha && existsSync(join(root, ".git"))) {
  try {
    sourceSha = execFileSync("git", ["-C", root, "rev-parse", "--verify", "HEAD"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000
    }).trim();
  } catch {
    sourceSha = null;
  }
}
if (sourceSha && /^[0-9a-f]{40}$/.test(sourceSha)) {
  const javascript = second.filter(([name]) => name.endsWith(".js"));
  if (!javascript.some(([name]) => readFileSync(join(dist, name), "utf8").includes(sourceSha))) {
    throw new Error("Source SHA missing from emitted JavaScript");
  }
}

console.log("PASS: repeated production builds emit " + second.length + " identical files (paths and SHA-256 bytes)");
if (sourceSha) console.log("Bundle source revision: " + sourceSha);
