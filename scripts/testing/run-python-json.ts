import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

/** Execute the real Python validator with bounded execution and complete JSON input. */
export function runPythonJson<T>(script: string, args: string[], input: unknown, options: {
  timeoutMs?: number;
  maxBuffer?: number;
  python?: string;
} = {}): T {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const directory = mkdtempSync(join(tmpdir(), "diagnostic-schema-"));
  let descriptor: number | undefined;
  try {
    // A regular-file stdin has an unambiguous EOF even in sandboxes that leave
    // spawned input pipes open. It also avoids pipe backpressure for large fixtures.
    const path = join(directory, "input.json");
    writeFileSync(path, JSON.stringify(input), {mode: 0o600});
    descriptor = openSync(path, "r");
    const run = spawnSync(options.python ?? "python3", [script, ...args], {
      stdio: [descriptor, "pipe", "pipe"],
      encoding: "utf8",
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024
    });
    const context = `${basename(script)} (timeout ${timeoutMs}ms, exit ${run.status}, signal ${run.signal ?? "none"})`;
    if (run.error || run.status !== 0) {
      throw new Error(`Python JSON validation failed: ${context}; ${run.error?.message ?? "nonzero exit"}\n${run.stderr?.slice(-4000) ?? ""}`);
    }
    try { return JSON.parse(run.stdout) as T; }
    catch { throw new Error(`Python validator returned invalid JSON: ${context}\n${run.stdout.slice(0, 1000)}\n${run.stderr.slice(-1000)}`); }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(directory, {recursive: true, force: true});
  }
}
