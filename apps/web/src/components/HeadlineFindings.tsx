import { Link } from "react-router-dom";
import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { selectHeadlineFindings } from "../data/headlineFindings";
import "./HeadlineFindings.css";
function headlineValue(e: Estimate) {
  return e.unit === "hours/person/year" && typeof e.value === "number"
    ? e.value.toLocaleString("en-US", { maximumFractionDigits: 1 }) : formatEstimateValue(e);
}
function accessibleInterval(s: string) {
  return s.replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ").replace(/^CI\s*/, "Confidence interval: ");
}
export function HeadlineFindings() {
  const {bundle} = useArtifact();
  if (!bundle) return null;
  const rows = selectHeadlineFindings(bundle);
  const reviewedCount = bundle.burden_domains.flatMap(domain => domain.measures)
    .filter(canExportEstimate).length;
  if (!rows.length) return null;
  return <aside className="headline-findings" aria-labelledby="headline-findings-title">
    <p className="headline-findings-kicker">Reviewed national evidence · AHRQ MEPS {bundle.context.evidence_year}</p>
    <h2 id="headline-findings-title">What adults with Long COVID are carrying</h2>
    <dl className="headline-findings-list">{rows.map(({spec,estimate}) => {
      const interval = formatEstimateInterval(estimate);
      return <div className="headline-finding" key={spec.estimateId}>
        <dt>{headlineValue(estimate)}</dt>
        <dd><span>{spec.label(estimate)}</span><small>
          <span aria-hidden="true">{interval}</span>
          <span className="sr-only">{accessibleInterval(interval)}</span>
        </small></dd>
      </div>;
    })}</dl>
    <p className="headline-findings-note">Descriptive survey-weighted estimates for adults with current Long COVID. All-cause spending is not cost attributable to Long COVID, diagnostic delay or care navigation.</p>
    <Link className="headline-findings-link" to="/burden">Explore all {reviewedCount} ordinary reviewed estimates and interpretation limits <span aria-hidden="true">→</span></Link>
  </aside>;
}
