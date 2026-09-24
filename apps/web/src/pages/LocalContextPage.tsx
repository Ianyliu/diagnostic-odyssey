import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import { formatLocalContextValue } from "../data/formatLocalContextValue";

function IndicatorDisclosure({record}: {record: LocalContextRecord}) {
  return <details>
    <summary>Source, universe, and interpretation boundary</summary>
    <p><strong>Source:</strong> {record.source_agency} · {record.source_ref}</p>
    <p><strong>Vintage:</strong> {record.source_release_vintage}</p>
    <p><strong>Observation as of:</strong> {record.observation_as_of_date ?? "Missing / not available"}</p>
    <p><strong>Universe:</strong> {record.universe}</p>
    <p><strong>Allowed use:</strong> {record.allowed_interpretation}</p>
    <p><strong>Not supported:</strong> {record.prohibited_interpretation.join("; ")}</p>
    <p><strong>Limitations:</strong> {record.limitations.join(" ")}</p>
    <p><strong>Release/data state:</strong> {record.release_status} / {record.state}</p>
  </details>;
}

function BreakdownList({records}: {records: LocalContextRecord[]}) {
  return <div>
    {records.map(record => <div className="measure" key={record.indicator_id}>
      <div>
        <strong>{record.label}</strong>
        <span>{record.universe}</span>
      </div>
      <div className="measure-value">
        {formatLocalContextValue(record)}
        <small>{record.release_status}</small>
      </div>
    </div>)}
  </div>;
}

export function LocalContextPage() {
  const {
    bundle,
    localContext,
    localContextStatus,
    localContextError
  } = useArtifact();
  if (!bundle) return null;

  if (localContextStatus === "loading") {
    return <section className="page page-stack">
      <ContextBar />
      <header className="page-heading">
        <h1>Local implementation context</h1>
        <p>Reviewed state context is loading independently from national burden.</p>
      </header>
      <div className="state-card" role="status">
        <strong>Loading reviewed local context…</strong>
        <span>National MEPS burden remains available and unchanged.</span>
      </div>
    </section>;
  }

  if (localContextStatus === "error" || !localContext) {
    return <section className="page page-stack">
      <ContextBar />
      <header className="page-heading">
        <h1>Local implementation context</h1>
        <p>Local implementation evidence is a separate runtime layer from national burden.</p>
      </header>
      <div className="empty-state" role="alert">
        <strong>Reviewed local implementation context is unavailable.</strong>
        <p>{localContextError ?? "The reviewed local-context artifact could not be loaded."}</p>
        <p>National MEPS burden, Pilot Planner, and Planning Brief remain usable. No fixture or illustrative local data are substituted.</p>
      </div>
      <div className="guardrail">
        <strong>Missing local data is not zero constraint.</strong>
        <p>Missing designation/data does not mean no shortage or no implementation constraint.</p>
      </div>
    </section>;
  }

  const indicators = localContext.indicators;
  const primaryCount = indicators.find(record =>
    record.indicator_id === "wv.hrsa.primary-care.designated-distinct-count"
  )!;
  const primaryScore = indicators.find(record =>
    record.indicator_id === "wv.hrsa.primary-care.max-score"
  )!;
  const mentalCount = indicators.find(record =>
    record.indicator_id === "wv.hrsa.mental-health.designated-distinct-count"
  )!;
  const mentalScore = indicators.find(record =>
    record.indicator_id === "wv.hrsa.mental-health.max-score"
  )!;

  const primaryBreakdowns = indicators.filter(record =>
    record.source_ref === "hrsa-hpsa-primary-care-current" &&
    record.indicator_id !== primaryCount.indicator_id &&
    record.indicator_id !== primaryScore.indicator_id
  );
  const mentalBreakdowns = indicators.filter(record =>
    record.source_ref === "hrsa-hpsa-mental-health-current" &&
    record.indicator_id !== mentalCount.indicator_id &&
    record.indicator_id !== mentalScore.indicator_id
  );
  const acsRecords = [
    "wv.acs.uninsured_pct",
    "wv.acs.no_vehicle_pct",
    "wv.acs.broadband_pct",
    "wv.acs.poverty_pct"
  ].map(indicatorId => indicators.find(record => record.indicator_id === indicatorId)!);

  const primarySource = localContext.sources.find(source =>
    source.source_ref === "hrsa-hpsa-primary-care-current"
  );
  const acsSource = localContext.sources.find(source =>
    source.source_ref === "acs-2024-5year-profile"
  );

  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading">
      <p className="eyebrow">REVIEWED IMPLEMENTATION CONTEXT</p>
      <h1>West Virginia statewide implementation constraints</h1>
      <p>What statewide implementation constraints are documented, and what can they legitimately be used for?</p>
    </header>

    <div className="guardrail">
      <strong>Separate evidence layer — not a West Virginia burden estimate.</strong>
      <p>This state context may inform implementation/access planning. It does not change national MEPS burden and is not West Virginia Long COVID prevalence, West Virginia Long COVID cost, a causal effect modifier, a calibrated access severity score, savings, or ROI.</p>
      <p>Missing designation/data does not mean no shortage or zero constraint.</p>
    </div>

    <div className="guardrail">
      <strong>Source/vintage boundary</strong>
      <p><strong>HRSA:</strong> {primarySource?.source_release_vintage ?? "Current HPSA snapshot retrieved 2026-09-24"}.</p>
      <p><strong>ACS:</strong> {acsSource?.source_release_vintage ?? "2020–2024 ACS 5-year estimates / 2024 release"}.</p>
      <p>These sources have different time bases and should not be interpreted as one common observation year.</p>
    </div>

    <article className="card">
      <h2>A. Primary Care HPSA context</h2>
      <p className="subtle">{primaryCount.source_agency} · {primaryCount.source_release_vintage}</p>
      <div className="measure">
        <div>
          <strong>{primaryCount.label}</strong>
          <span>{primaryCount.universe}</span>
        </div>
        <div className="measure-value">{formatLocalContextValue(primaryCount)}</div>
      </div>
      <div className="measure">
        <div>
          <strong>Maximum source-published HPSA score among included designations</strong>
          <span>{primaryScore.universe}</span>
        </div>
        <div className="measure-value">{formatLocalContextValue(primaryScore)}</div>
      </div>
      <p className="limitations">The maximum score is a maximum across included individual designations; it is not a statewide shortage severity score.</p>
      <details>
        <summary>Designation-type and rural-status breakdowns</summary>
        <BreakdownList records={primaryBreakdowns} />
      </details>
      <IndicatorDisclosure record={primaryCount} />
    </article>

    <article className="card">
      <h2>B. Mental Health HPSA context</h2>
      <p className="subtle">{mentalCount.source_agency} · {mentalCount.source_release_vintage}</p>
      <div className="measure">
        <div>
          <strong>{mentalCount.label}</strong>
          <span>{mentalCount.universe}</span>
        </div>
        <div className="measure-value">{formatLocalContextValue(mentalCount)}</div>
      </div>
      <div className="measure">
        <div>
          <strong>Maximum source-published HPSA score among included designations</strong>
          <span>{mentalScore.universe}</span>
        </div>
        <div className="measure-value">{formatLocalContextValue(mentalScore)}</div>
      </div>
      <p className="limitations">The maximum score is a maximum across included individual designations; it is not a statewide shortage severity score.</p>
      <details>
        <summary>Designation-type and rural-status breakdowns</summary>
        <BreakdownList records={mentalBreakdowns} />
      </details>
      <IndicatorDisclosure record={mentalCount} />
    </article>

    <article className="card">
      <h2>C. ACS implementation/access context</h2>
      <p className="subtle">U.S. Census Bureau · 2020–2024 ACS 5-year estimates / 2024 release. Native 90% margins of error are preserved.</p>
      {acsRecords.map(record => <div key={record.indicator_id}>
        <div className="measure">
          <div>
            <strong>{record.label}</strong>
            <span>Universe: {record.universe}</span>
            <span>{record.source_agency} · {record.source_release_vintage}</span>
          </div>
          <div className="measure-value">
            {formatLocalContextValue(record)}
            <small>{record.uncertainty_type} · confidence level {record.confidence_level}</small>
          </div>
        </div>
        <IndicatorDisclosure record={record} />
      </div>)}
    </article>
  </section>;
}
