import assert from "node:assert/strict";
import { runPythonJson } from "../../../scripts/testing/run-python-json.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateNarrativeReferenceCatalog } from "../src/index.ts";

interface Case {
  name: string;
  expected_schema: boolean;
  expected_runtime: boolean;
  note: string;
  catalog: unknown;
}
const fixturePath = new URL("./fixtures/schema-cases.v1.json", import.meta.url);
const fixtures = JSON.parse(readFileSync(fixturePath, "utf8")) as {cases: Case[]};

// An explicit allowlist; never silently let new schema/runtime disagreements pass.
const intentionalSchemaOnly = new Set([
  "invalid_calendar_date_schema_accepts",
  "duplicate_claim_id_runtime_only",
  "conflicting_source_id_runtime_only"
]);

test("committed synthetic cases execute against *actual* Draft 2020-12 schema and runtime", () => {
  assert.equal(new Set(fixtures.cases.map(c => c.name)).size, fixtures.cases.length, "unique case names");
  const schemaResults = runPythonJson<Array<{
    valid: boolean; errors: Array<{path: Array<string | number>; keyword: string; message: string}>
  }>>(
    fileURLToPath(new URL("./schema_draft202012.py", import.meta.url)),
    [fileURLToPath(new URL("../schema/narrative-intervention-references.v1.schema.json", import.meta.url))],
    fixtures.cases.map(c => c.catalog)
  );
  assert.equal(schemaResults.length, fixtures.cases.length);
  const observedSchemaOnly: string[] = [];

  for (const [i, item] of fixtures.cases.entries()) {
    const fromSchema = schemaResults[i]!;
    const runtimeIssues = validateNarrativeReferenceCatalog(item.catalog);
    const runtimeValid = runtimeIssues.length === 0;
    const diagnostics = `${item.name}: schema=${JSON.stringify(fromSchema.errors)} runtime=${JSON.stringify(runtimeIssues)}`;
    assert.equal(fromSchema.valid, item.expected_schema, diagnostics);
    assert.equal(runtimeValid, item.expected_runtime, diagnostics);
    if (fromSchema.valid !== runtimeValid) {
      assert.ok(intentionalSchemaOnly.has(item.name), `UNREVIEWED SCHEMA/RUNTIME DISAGREEMENT ${diagnostics}`);
      assert.equal(fromSchema.valid, true, diagnostics);
      assert.equal(runtimeValid, false, diagnostics);
      observedSchemaOnly.push(item.name);
    }
  }
  assert.deepEqual(observedSchemaOnly.sort(), [...intentionalSchemaOnly].sort(),
    "all intentionally documented divergence fixtures must remain exercised");
  assert.ok(fixtures.cases.length >= 30, "preserve broad negative coverage");
});
