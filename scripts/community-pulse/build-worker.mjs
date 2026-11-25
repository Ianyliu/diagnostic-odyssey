import { readFile } from "node:fs/promises";
import process from "node:process";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { build } from "esbuild";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const metadata = JSON.parse(await readFile(new URL("../../apps/pulse-worker/staging-upload.json", import.meta.url), "utf8"));
const output = process.argv[2] ? resolve(process.argv[2]) : undefined;

const disabledBindings = ["PULSE_STAGING_ENABLED", "PULSE_AGENTMAIL_MODE", "PULSE_AGENTMAIL_RECONCILE"];
if (!disabledBindings.every(name => metadata.bindings.some(binding =>
      binding.name === name && binding.type === "plain_text" && binding.text === "off")) ||
    metadata.bindings.some(binding => binding.type === "secret_text") ||
    metadata.main_module !== "worker.mjs") {
  throw new Error("Expected the disabled, secret-free staging upload.");
}

await build({
  absWorkingDir: repo,
  entryPoints: ["apps/pulse-worker/src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  external: ["node:*"],
  target: "es2022",
  legalComments: "none",
  ...(output ? { outfile: output } : { write: false })
});
