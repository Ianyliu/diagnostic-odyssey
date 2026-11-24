import assert from "node:assert/strict";
import test from "node:test";
import { workspaceStages, workspaceStageForPath } from "../src/data/workspaceNavigation.ts";

test("Cupertino Clarity segmented nav covers all 6 workspace routes cleanly", () => {
  assert.deepEqual(
    workspaceStages.map(stage => stage.to),
    ["/", "/burden", "/local-context", "/pilot", "/brief", "/advisor"]
  );
  assert.equal(workspaceStageForPath("/"), "/");
  assert.equal(workspaceStageForPath("/burden/medical"), "/burden");
  assert.equal(workspaceStageForPath("/evidence"), "/burden");
  assert.equal(workspaceStageForPath("/data-requests"), "/pilot");
  assert.equal(workspaceStageForPath("/advisor"), "/advisor");
  assert.equal(workspaceStageForPath("/concept/future-ai"), "/advisor");
});
