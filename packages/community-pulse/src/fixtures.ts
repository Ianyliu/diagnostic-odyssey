import approved from "./fixtures/approved-snapshot.json" with { type: "json" };
import empty from "./fixtures/empty-snapshot.json" with { type: "json" };
import daily from "./fixtures/research-report.json" with { type: "json" };
import scout from "./fixtures/research-no-change.json" with { type: "json" };
import weekly from "./fixtures/research-partial.json" with { type: "json" };
import onDemand from "./fixtures/research-failed.json" with { type: "json" };
import { validateEventSnapshot, type EventSnapshot } from "./ledger.ts";
import { validateResearchReport } from "./research.ts";

function fixtureSnapshot(value: unknown): EventSnapshot {
  const result = validateEventSnapshot(value);
  if (!result.ok) throw new Error("Invalid fixture snapshot: " + result.issues.join(", "));
  return result.value;
}

export const syntheticSnapshot = fixtureSnapshot(approved);
export const emptySyntheticSnapshot = fixtureSnapshot(empty);
export const syntheticResearchReports = [daily, scout, weekly, onDemand].map(raw => {
  const result = validateResearchReport(raw);
  if (!result.ok) throw new Error("Invalid research fixture: " + result.issues.join(", "));
  return result.value;
});
