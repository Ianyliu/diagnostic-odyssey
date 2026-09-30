import type {
  ReviewedLinkedConditionSecondaryEvidence
} from "../data/reviewedLinkedConditionArtifact";
import {
  formatLinkedConditionSecondaryEvidence
} from "../data/linkedConditionPresentation";

export function LinkedConditionServiceUseFootprint({
  evidence
}: {
  evidence: ReviewedLinkedConditionSecondaryEvidence;
}) {
  const display = formatLinkedConditionSecondaryEvidence(evidence);

  return <section
    className="linked-condition-secondary-evidence"
    aria-labelledby="linked-condition-secondary-heading"
  >
    <div className="linked-condition-secondary-heading">
      <div>
        <p className="eyebrow">Secondary / documentation-linked evidence</p>
        <h2 id="linked-condition-secondary-heading">{evidence.sectionHeading}</h2>
      </div>
      <span className="status status-ok">Reviewed descriptive evidence</span>
    </div>

    <div className="linked-condition-secondary-measure">
      <div>
        <h3>{evidence.measureLabel}</h3>
        <p className="linked-condition-secondary-explanation">
          {evidence.alwaysVisibleExplanation}
        </p>
      </div>
      <div className="linked-condition-secondary-value" aria-label={
        `Survey-weighted estimate ${display.estimate}; ${display.interval}`
      }>
        <span>Survey-weighted estimate</span>
        <strong>{display.estimate}</strong>
        <small>{display.interval}</small>
      </div>
    </div>

    <details className="technical-disclosure linked-condition-secondary-details">
      <summary>Technical interpretation and provenance</summary>

      <h3>Scientific boundaries</h3>
      <ol>
        {evidence.technicalLimitations.map(limitation =>
          <li key={limitation}>{limitation}</li>
        )}
      </ol>

      <h3>Support context</h3>
      <dl className="technical-detail-list">
        <div>
          <dt>Governed target</dt>
          <dd>n = {evidence.support.governedTargetN}</dd>
        </div>
        <div>
          <dt>Persons with ≥1 qualifying linked encounter</dt>
          <dd>n = {evidence.support.personsWithQualifyingLinkedEncounterN}</dd>
        </div>
        <div>
          <dt>Qualifying target encounters</dt>
          <dd>{evidence.support.qualifyingTargetEncounterN}</dd>
        </div>
        <div>
          <dt>Weighted target denominator</dt>
          <dd>{display.weightedDenominator}</dd>
        </div>
        <div>
          <dt>Full-design degrees of freedom</dt>
          <dd>{evidence.support.fullDesignDegreesOfFreedom}</dd>
        </div>
      </dl>

      <h3>Reviewed provenance</h3>
      <p>
        {evidence.provenance.dataset}. Reviewed linked-condition artifact{" "}
        <code>{evidence.artifactVersion}</code>. Source files:{" "}
        {evidence.provenance.sourceLabels.join("; ")}.
      </p>
      <p>
        Active specialized product-policy pin:{" "}
        <code>{evidence.productPolicyVersion}</code>.
      </p>
    </details>
  </section>;
}

export function LinkedConditionServiceUseUnavailable() {
  return <section
    className="linked-condition-secondary-evidence linked-condition-secondary-unavailable"
    aria-labelledby="linked-condition-secondary-unavailable-heading"
  >
    <p className="eyebrow">Secondary / documentation-linked evidence</p>
    <h2 id="linked-condition-secondary-unavailable-heading">
      Documentation-linked service-use footprint
    </h2>
    <p>Reviewed documentation-linked service-use evidence is unavailable.</p>
  </section>;
}
