import assert from "node:assert/strict";
import test from "node:test";
import { readPilotFile } from "./helpers/pilotSource.ts";

/**
 * CSS is bundled in module-evaluation order, so moving a component import changes the cascade even
 * when the rule set is identical (found while splitting PilotPage). The page's imports must load the
 * component stylesheets in the original order.
 */
test("Strategy Lab loads component stylesheets in the pre-split order", () => {
  const page = readPilotFile("PilotPage.tsx");
  const position = (specifier: string): number => {
    const index = page.indexOf(`"${specifier}"`);
    assert.ok(index >= 0, `PilotPage.tsx must import ${specifier}`);
    return index;
  };
  const moduleCss: [string, string][] = [
    ["./pilot/PathwayBoundaryDrawer", "DetailDrawer"],
    ["./pilot/QuantitiesPanel", "DecisionTrace"],
    ["./pilot/ResultsPanel", "PilotDecisionVisuals"]
  ];
  const owners: Record<string, string> = {
    "./pilot/PathwayBoundaryDrawer": "../../components/DetailDrawer",
    "./pilot/QuantitiesPanel": "../../components/DecisionTrace",
    "./pilot/ResultsPanel": "../../components/PilotDecisionVisuals"
  };
  for (const [module, component] of moduleCss) {
    assert.ok(readPilotFile(`pilot/${module.split("/").pop()}.tsx`).includes(`"${owners[module]}"`), `${module} must import ${component}`);
  }
  const order = [...moduleCss.map(([module]) => position(module)), position("../components/SensitivityExplorer")];
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "DetailDrawer, DecisionTrace, PilotDecisionVisuals, SensitivityExplorer");
  assert.ok(position("./PilotPage.css") > order[3]!, "PilotPage.css stays last, as before the split");
});
