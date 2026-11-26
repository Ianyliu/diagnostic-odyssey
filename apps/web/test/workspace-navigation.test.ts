import assert from "node:assert/strict";
import test from "node:test";
import {workspaceStages, workspaceStageForPath} from "../src/data/workspaceNavigation.ts";

test("guided stages include Data Requests between Strategy Lab and Planning Brief", () => {
  assert.deepEqual(workspaceStages.map(stage => stage.to), ["/burden", "/local-context", "/pilot", "/data-requests", "/brief"]);
  assert.equal(workspaceStageForPath("/burden/medical"), "/burden");
  assert.equal(workspaceStageForPath("/evidence"), "/burden");
  assert.equal(workspaceStageForPath("/data-requests"), "/data-requests");
  assert.equal(workspaceStageForPath("/concept/future-ai"), null);
  assert.equal(workspaceStageForPath("/advisor"), null);
  assert.equal(workspaceStageForPath("/"), null);
});
