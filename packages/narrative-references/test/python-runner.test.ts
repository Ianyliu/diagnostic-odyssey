import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runPythonJson } from "../../../scripts/testing/run-python-json.ts";

test("Python runner preserves large Unicode fixtures and fails on timeout, missing dependency and malformed output", () => {
  const directory = mkdtempSync(join(tmpdir(), "python-runner-test-"));
  const script = join(directory, "validator.py");
  try {
    writeFileSync(script, "import json, sys\njson.dump(json.load(sys.stdin), sys.stdout)\n");
    const input = {text: "🧬 reviewed evidence ".repeat(10_000), numbers: [0, 1.5, 1e100], missing: null};
    assert.deepEqual(runPythonJson(script, [], input), input);
    assert.throws(() => runPythonJson(script, [], {}, {python: join(directory, "missing-python")}), /ENOENT/);
    writeFileSync(script, "raise SystemExit('Install pinned dependency: jsonschema==4.26.0')\n");
    assert.throws(() => runPythonJson(script, [], {}), /exit 1.*[\s\S]*jsonschema==4.26.0/);
    writeFileSync(script, "print('not JSON')\n");
    assert.throws(() => runPythonJson(script, [], {}), /invalid JSON.*[\s\S]*not JSON/);
    writeFileSync(script, "import time\ntime.sleep(60)\n");
    const start = Date.now();
    assert.throws(() => runPythonJson(script, [], {}, {timeoutMs: 200}), /timeout 200ms.*SIGKILL.*ETIMEDOUT/);
    assert.ok(Date.now() - start < 5000, "hung validator must terminate promptly");
  } finally { rmSync(directory, {recursive: true, force: true}); }
});
