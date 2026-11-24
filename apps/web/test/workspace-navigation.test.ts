import assert from "node:assert/strict";
import test from "node:test";
import {workspaceStages, workspaceStageForPath} from "../src/data/workspaceNavigation.ts";

test("reviewed evidence means descriptive burden, with separate companion routes and domain routes mapped to their stage", () => {
  assert.deepEqual(workspaceStages.map(stage => stage.to), ["/burden", "/local-context", "/pilot", "/brief"]);
  assert.equal(workspaceStageForPath("/burden/medical"), "/burden");
  assert.equal(workspaceStageForPath("/evidence"), "/burden");
  assert.equal(workspaceStageForPath("/data-requests"), null);
  assert.equal(workspaceStageForPath("/concept/future-ai"), null);
  assert.equal(workspaceStageForPath("/advisor"), null);
  assert.equal(workspaceStageForPath("/"), null);
});
