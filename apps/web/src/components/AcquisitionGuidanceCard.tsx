import type { AcquisitionGuidance, AcquisitionResolution } from "@diagnostic-odyssey/acquisition-hints";
import "./AcquisitionGuidanceCard.css";

export function AcquisitionGuidanceStatus({resolution}: {resolution: AcquisitionResolution}) {
  if (resolution.guidance) return <AcquisitionGuidanceCard guidance={resolution.guidance} />;
  if (resolution.state === "not_offered") return null;
  return <p className="acquisition-state">
    <strong>{resolution.state === "awaiting_admission" ? "Acquisition guidance awaiting admission." : resolution.state === "available_to_attach" ? "Reviewed acquisition guidance is available to attach." : "Optional acquisition guidance withheld."}</strong>{" "}
    {resolution.state === "awaiting_admission" ? "No admitted guidance is available for this request. The base request remains usable." : resolution.state === "available_to_attach" ? "Attaching it does not select the request for the Brief." : "Its reference, release identity or current context could not be verified. Refresh the request or guidance when applicable; valid base requests remain usable."}
  </p>;
}

/** Receives only canonical resolved guidance, never a request-supplied snapshot. */
export function AcquisitionGuidanceCard({guidance}: {guidance: AcquisitionGuidance}) {
  return <section className="acquisition-guidance" aria-label="Reviewed acquisition guidance">
    <h3>Reviewed acquisition guidance</h3>
    <p>{guidance.wording}</p>
    <p className="acquisition-privacy"><strong>{guidance.privacy_boundary}</strong></p>
    <dl>
      <div><dt>Ask the local steward</dt><dd>{guidance.source_owner_system}</dd></div>
      <div><dt>Minimum necessary output</dt><dd>{guidance.minimum_necessary_output}</dd></div>
      <div><dt>Local preparation only</dt><dd>{guidance.local_only_preparation}</dd></div>
    </dl>
    <details className="technical-disclosure">
      <summary>Required information, mapping limits and provenance</summary>
      <h4>Required information</h4><ul>{guidance.required_information.map(value => <li key={value}>{value}</li>)}</ul>
      <h4>Existing request fields</h4><dl>{guidance.field_crosswalk.map(row => <div key={row.existing_field}>
        <dt>{row.existing_field}</dt><dd>{row.possible_spec_elements ?? "Local definition; no generic FHIR mapping"}. {row.limits}</dd>
      </div>)}</dl>
      <h4>Mapping limits</h4><ul>{guidance.mapping_limits.map(value => <li key={value}>{value}</li>)}</ul>
      <h4>Confirm locally</h4><ul>{guidance.local_confirmation.map(value => <li key={value}>{value}</li>)}</ul>
      <h4>Privacy and feasibility</h4><ul>{guidance.privacy_limits.map(value => <li key={value}>{value}</li>)}</ul>
      <h4>Versioned primary specifications</h4>
      <ul>{guidance.official_support.map(source => <li key={source.url}>
        {source.version}: {source.elements.map((element, index) => <span key={element.element}>
          {index > 0 ? ", " : ""}<a href={element.official_locator}>{element.element}</a>
        </span>)}
        <small>Retrieved {source.retrieved_at}; source SHA-256 {source.source_sha256}. {source.publication_note}</small>
      </li>)}</ul>
      <p>Review: <a href={guidance.review.evidence_url} target="_blank" rel="noopener noreferrer">{guidance.review.reviewer}</a>, {guidance.review.reviewed_at}; code {guidance.review.code_commit}.</p>
      <dl className="acquisition-identities">
        <div><dt>Hint / registry</dt><dd>{guidance.reference.hint_id} v{guidance.reference.hint_version} · {guidance.registry_id} {guidance.registry_version}</dd></div>
        {Object.entries(guidance.reference).filter(([key]) => key.endsWith("sha256") || key === "request_fingerprint").map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value}</dd></div>)}
      </dl>
    </details>
  </section>;
}
