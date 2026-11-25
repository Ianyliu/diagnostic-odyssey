import type { Scenario } from "@diagnostic-odyssey/contracts";
import { DetailDrawer } from "../../components/DetailDrawer";
import { pilotInputFields } from "../../data/pilotInputDraft";
import { getPathwayBoundaryPresentation } from "../../data/pathwayBoundary";
import { formatAppliedAssumption } from "../briefAssumptions";

export function PathwayBoundaryDrawer({
  open,
  scenario,
  onClose
}: {
  open: boolean;
  scenario: Scenario;
  onClose: () => void;
}) {
  const pathwayBoundary = getPathwayBoundaryPresentation(scenario);
  return (
    <DetailDrawer
      open={open}
      eyebrow="SCIENTIFIC BOUNDARY"
      title="Modeled pathway boundary"
      onClose={onClose}
    >
      <dl className="atlas-drawer-list">
        <div>
          <dt>Target pathway step</dt>
          <dd>{pathwayBoundary.pathwayStepLabel}</dd>
        </div>
        <div>
          <dt>Assumed mechanism</dt>
          <dd>{pathwayBoundary.mechanismLabel}</dd>
        </div>
        <div>
          <dt>Modeled boundary</dt>
          <dd>{pathwayBoundary.modeledBoundaryStatement}</dd>
        </div>
        <div>
          <dt>Assumption limit</dt>
          <dd>{pathwayBoundary.assumptionBoundaryStatement}</dd>
        </div>
        <div>
          <dt>Outside this model</dt>
          <dd>{pathwayBoundary.outsideModelItems.join("; ")}.</dd>
        </div>
        <div>
          <dt>Applied values</dt>
          <dd>
            <ul className="atlas-compact-list">
              {pilotInputFields.map(field => (
                <li key={field.key}>{field.label}: {formatAppliedAssumption(scenario, field)}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </DetailDrawer>
  );
}
