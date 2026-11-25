import { useState } from "react";
import { NavLink, Link, useSearchParams } from "react-router-dom";
import {
  countyName,
  reportTypes,
  westVirginiaCounties,
  type EventSnapshot,
  type LedgerRecord,
  type ReadableResearchReport,
  type TypedDate,
} from "../../../../packages/community-pulse/src/index";
import type { InboxEntry, StagingInboxMetrics } from "../data/communityPulseResponse";
import { communityPulseStagingEnabled } from "../data/communityPulseFlag";
import { fixtureFeed, stagingFeed, useCommunityPulseFeed } from "../data/useCommunityPulseFeed";
import { ResearchHistoryPanel, ResearchThreadPanel } from "./CommunityPulseHistoryPanel";
import "./CommunityPulsePage.css";

const ledgerPath = "/local-context/policy-access";
const dateFormat = new Intl.DateTimeFormat("en-US", {dateStyle: "medium", timeZone: "UTC"});
const instantFormat = new Intl.DateTimeFormat("en-US", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});
const dayMs = 86_400_000;

const labels: Record<string, string> = {
  diagnostic_access: "Diagnostic access",
  coverage_eligibility: "Coverage and eligibility",
  economic_infrastructure: "Economy and infrastructure",
  data_methods: "Data and methods",
  primary_official_document: "Primary official document",
  independent_origins: "Independent sources",
  single_origin: "Single source",
  attributed_interested_party: "Attributed interested party",
  source_grounded_development: "Reported development",
  cross_source_synthesis: "Cross-source synthesis",
  planning_implication: "Potential planning implication",
  open_question: "Unresolved question",
  verification_needed: "Evidence requiring verification",
  strategic_hypothesis: "Strategic hypothesis",
  source_nomination: "Source lead",
  funding_opportunity: "Potential funding opportunity",
  rules_apply_to: "Rules apply to",
  no_change: "No substantive change",
  needs_verification: "Awaiting verification",
  pending: "Awaiting editorial review",
  none: "Outside editorial review",
  manual_file: "Manual file",
  email: "Email",
  hourly_scout: "Hourly scout",
  daily_synthesis: "Daily synthesis",
  weekly_strategic_review: "Weekly strategic review",
  on_demand: "On-demand research",
};

function label(value: string) {
  return labels[value] ?? value.replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase());
}

function formattedInstant(value: string) {
  return Number.isFinite(Date.parse(value)) ? instantFormat.format(Date.parse(value)) + " UTC" : "Time unknown";
}

function formattedDate(date: TypedDate) {
  if (!date.value) return date.as_written ?? "Date unknown";
  return date.precision === "date" || date.precision === "instant"
    ? dateFormat.format(Date.parse(date.value))
    : date.as_written ?? date.value;
}

const counties = Object.entries(westVirginiaCounties).sort(([, a], [, b]) => a.localeCompare(b));
const coverageStatus = {
  complete: "Complete check",
  partial: "Partial checks",
  not_monitored: "Not monitored",
  unavailable: "Unavailable",
};
const futureRoles = new Set(["effective_start", "enforcement_start", "compliance_deadline", "comment_deadline", "expires"]);

function dateClass(record: LedgerRecord, basis: "announced" | "upcoming", days: number, asOf: string) {
  const point = Date.parse(asOf.slice(0, 10));
  const roles = basis === "announced"
    ? record.dates.some(date => date.role === "announced" && date.value)
      ? record.dates.filter(date => date.role === "announced")
      : record.dates.filter(date => date.role === "source_published")
    : record.dates.filter(date => futureRoles.has(date.role));
  const daysKnown = roles.filter(date => date.value && (date.precision === "date" || date.precision === "instant"))
    .map(date => Date.parse(date.value!.slice(0, 10)));
  if (daysKnown.length === 0) return "undated";
  return daysKnown.some(date => basis === "announced"
    ? date >= point - (days - 1) * dayMs && date <= point
    : date >= point && date < point + days * dayMs) ? "in-window" : "outside";
}

function geoBand(record: LedgerRecord, county: string) {
  const relations = record.geographic_relations.filter(relation => relation.relation !== "mentioned_only");
  if (county) {
    if (relations.some(relation => relation.relation === "located_in" && relation.fips_codes.includes(county))) return "located";
    if (relations.some(relation => relation.relation === "serves" && relation.fips_codes.includes(county))) return "serves";
    if (relations.some(relation => relation.relation === "rules_apply_to" && relation.fips_codes.includes(county))) return "applies";
    if (relations.some(relation => relation.relation === "rules_apply_to" && relation.fips_codes.includes("54"))) return "state";
    return null;
  }
  if (relations.some(relation => relation.fips_codes.some(code => code.startsWith("54")))) return "state";
  if (relations.some(relation => relation.geo_type === "national_context")) return "national";
  return relations.some(relation => relation.fips_codes.length > 0) ? null : "unknown";
}

type GeoBand = Exclude<ReturnType<typeof geoBand>, null>;
const bandLabels: Record<GeoBand, string> = {
  located: "Located in selected county",
  serves: "Documented service to selected county",
  applies: "Rules applying to selected county",
  state: "West Virginia applicability",
  national: "National context",
  unknown: "Geographic attribution unconfirmed",
};

function LedgerCard({record, evidenceById}: {
  record: LedgerRecord;
  evidenceById: ReadonlyMap<string, EventSnapshot["evidence"][number]>;
}) {
  return (
    <article className="pulse-record">
      <header className="pulse-record-heading">
        <div>
          <p className="visual-kicker">{label(record.change_type)}</p>
          <h3>{record.title}</h3>
        </div>
        <span className="status status-neutral">{label(record.status)}</span>
      </header>
      <dl className="pulse-facts">
        <div><dt>Status as of</dt><dd><time dateTime={record.status_as_of}>{dateFormat.format(Date.parse(record.status_as_of))}</time></dd></div>
        {record.dates.map((date, index) => (
          <div key={`${date.role}-${index}`}>
            <dt>{label(date.role)}</dt>
            <dd>{formattedDate(date)}</dd>
          </div>
        ))}
        {record.geographic_relations.map((relation, index) => {
          const place = relation.as_written ??
            (relation.fips_codes.map(fips => countyName(fips) ?? (fips === "54" ? "West Virginia" : fips)).join(", ") || "Unknown");
          return <div key={`geo-${index}`}><dt>{label(relation.relation)}</dt><dd>{place}</dd></div>;
        })}
      </dl>
      <details className="pulse-disclosure">
        <summary>Claims and evidence</summary>
        <div className="pulse-disclosure-body">
          <ul className="pulse-evidence-list">
            {record.claims.map(claim => (
              <li key={claim.claim_id}>
                <span className="status status-reviewed">{label(claim.assertion_type)}</span>
                <p>{claim.text}{claim.attributed_to ? ` · Attributed to ${claim.attributed_to}` : ""}</p>
                <ul>
                  {claim.evidence_ids.map(id => {
                    const evidence = evidenceById.get(id);
                    if (!evidence) return null;
                    return (
                      <li key={id}>
                        <a href={evidence.canonical_url} target="_blank" rel="noopener noreferrer">
                          {evidence.publisher} <span className="sr-only">(opens in a new tab)</span>
                        </a>
                        <span className="micro-caption">
                          {label(evidence.provenance_class)} · {evidence.locator}
                          {evidence.origin_publisher && evidence.origin_publisher !== evidence.publisher
                            ? ` · Origin ${evidence.origin_publisher}` : ""}
                        </span>
                        <span className="micro-caption">Retrieved {formattedInstant(evidence.retrieved_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          {record.reviewed_interpretation && <div className="pulse-interpretation">
            <p className="visual-kicker">Reviewed interpretation</p>
            <p>{record.reviewed_interpretation.text}</p>
          </div>}
          {record.verification_path && <p><strong>Verification path</strong> · {record.verification_path}</p>}
        </div>
      </details>
    </article>
  );
}

function Ledger({snapshot}: {snapshot: EventSnapshot}) {
  const [county, setCounty] = useState("");
  const [domain, setDomain] = useState("");
  const [basis, setBasis] = useState<"announced" | "upcoming">("announced");
  const [days, setDays] = useState(30);
  const bands: GeoBand[] = county ? ["located", "serves", "applies", "state"] : ["state", "national", "unknown"];
  const evidenceById = new Map(snapshot.evidence.map(evidence => [evidence.evidence_id, evidence]));
  const domains = [...new Set([
    ...snapshot.records.flatMap(record => record.domains),
    ...snapshot.coverage.map(item => item.domain),
  ])].sort((a, b) => label(a).localeCompare(label(b)));
  const records = snapshot.records.filter(record => (!domain || record.domains.some(value => value === domain)) && geoBand(record, county));
  const dated = records.filter(record => dateClass(record, basis, days, snapshot.created_at) === "in-window");
  const undated = records.filter(record => dateClass(record, basis, days, snapshot.created_at) === "undated");
  const coverage = snapshot.coverage.filter(item =>
    (county ? item.county_fips === county : item.scope === "west_virginia") && (!domain || domain === item.domain),
  );

  return (
    <div className="pulse-content-grid">
      <div className="pulse-main">
        <section className="pulse-filters" aria-label="Filter recorded changes">
          <label>Geographic view<select value={county} onChange={event => setCounty(event.currentTarget.value)}>
            <option value="">All West Virginia</option>
            {counties.map(([code, name]) => <option value={code} key={code}>{name} County</option>)}
          </select></label>
          <label>Domain<select value={domain} onChange={event => setDomain(event.currentTarget.value)}>
            <option value="">All domains</option>
            {domains.map(value => <option key={value} value={value}>{label(value)}</option>)}
          </select></label>
          <label>Date focus<select value={basis} onChange={event => setBasis(event.currentTarget.value === "upcoming" ? "upcoming" : "announced")}>
            <option value="announced">Announced or published</option>
            <option value="upcoming">Effective dates or deadlines</option>
          </select></label>
          <label>Time window<select value={days} onChange={event => setDays(Number(event.currentTarget.value))}>
            {[7, 30, 90].map(value =>
              <option key={value} value={value}>{basis === "announced" ? "Previous" : "Next"} {value} days</option>,
            )}
          </select></label>
        </section>
        {dated.length === 0 && <div className="empty-state">
          <strong>No matching dated changes in this snapshot.</strong>
          <p>See source coverage for what was monitored in this view.</p>
        </div>}
        {bands.map(band => {
          const group = dated.filter(record => geoBand(record, county) === band);
          if (group.length === 0) return null;
          return <section key={band} className="pulse-record-group">
            <h2>{bandLabels[band]}</h2>
            {group.map(record => <LedgerCard key={record.record_id} record={record} evidenceById={evidenceById} />)}
          </section>;
        })}
        {undated.length > 0 && <section className="pulse-record-group">
          <h2>Dates not specified for this view</h2>
          {undated.map(record => <LedgerCard key={record.record_id} record={record} evidenceById={evidenceById} />)}
        </section>}
      </div>
      <aside className="pulse-aside" aria-label="Source coverage and corrections">
        <section className="card pulse-side-card">
          <p className="visual-kicker">Monitoring</p>
          <h2>Source coverage</h2>
          <p className="subtle">Source checks describe where and when monitoring occurred.</p>
          {coverage.length === 0 ? <p><strong>Not monitored in this view.</strong></p> : <ul className="pulse-side-list">
            {coverage.map((item, index) => <li key={`${item.domain}-${index}`}>
              <strong>{label(item.domain)}</strong>
              <span className="micro-caption">{coverageStatus[item.status]}</span>
              <span className="micro-caption">{item.checked} checked · {item.due} due · {item.eligible} eligible</span>
              <span className="micro-caption">Window {dateFormat.format(Date.parse(item.window_started_at))} –
                {" "}{dateFormat.format(Date.parse(item.window_ended_at))}</span>
              <span className="micro-caption">Last successful check {item.last_success_at ? formattedInstant(item.last_success_at) : "unknown"}</span>
            </li>)}
          </ul>}
        </section>
        <section className="card pulse-side-card">
          <p className="visual-kicker">Published history</p>
          <h2>Corrections</h2>
          {snapshot.tombstones.length === 0 ? <p className="subtle">No corrections in this snapshot.</p> :
            <ul className="pulse-side-list">{snapshot.tombstones.map(entry =>
              <li key={`${entry.record_id}-${entry.revision}`}>
                <strong>{({correct: "Corrected", retract: "Retracted", expire: "Expired"})[entry.action]}</strong>
                <span className="micro-caption">Revision {entry.revision} · {formattedInstant(entry.at)}</span>
                <span className="micro-caption">{label(entry.reason_code)}</span>
                <code>{entry.record_id}</code>
              </li>,
            )}</ul>}
        </section>
      </aside>
    </div>
  );
}

const researchSections: readonly {title: string; kinds: ReadableResearchReport["items"][number]["kind"][]}[] = [
  {title: "Reported developments", kinds: ["source_grounded_development", "funding_opportunity", "source_nomination"]},
  {title: "Cross-source synthesis", kinds: ["cross_source_synthesis"]},
  {title: "Potential planning implications", kinds: ["planning_implication", "strategic_hypothesis"]},
  {title: "Unresolved questions", kinds: ["open_question"]},
  {title: "Evidence requiring verification", kinds: ["verification_needed"]},
];

function ResearchSections({report}: {report: ReadableResearchReport}) {
  return (
    <div className="pulse-research-sections">
      {researchSections.map(section => {
        const items = report.items.filter(item => section.kinds.includes(item.kind));
        if (items.length === 0) return null;
        return <section key={section.title}>
          <h4>{section.title}</h4>
          <ul>{items.map((item, index) => <li key={`${item.kind}-${index}`}>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
            {item.sources.length > 0 && <ul className="pulse-leads">
              {item.sources.map((source, sourceIndex) => <li key={`${source.url}-${sourceIndex}`}>
                {source.publisher}{source.locator ? ` · ${source.locator}` : ""} <code>{source.url}</code>
              </li>)}
            </ul>}
          </li>)}</ul>
        </section>;
      })}
      {report.items.length === 0 && <p>This run submitted no research items.</p>}
      {report.reason_codes.length > 0 && <p className="subtle">{report.reason_codes.map(label).join(" · ")}</p>}
    </div>
  );
}

function InboxCard({entry}: {entry: InboxEntry}) {
  const {receipt, report} = entry;
  return (
    <article className="pulse-record">
      <header className="pulse-record-heading">
        <div>
          <p className="visual-kicker">{report ? label(report.report_type) : "Intake receipt"}</p>
          <h3>{report?.title ?? label(receipt.status) + " submission"}</h3>
        </div>
        <span className={`status ${receipt.status === "quarantined" ? "status-gap" : "status-neutral"}`}>{label(receipt.status)}</span>
      </header>
      <dl className="pulse-facts">
        <div><dt>Received</dt><dd><time dateTime={receipt.received_at}>{formattedInstant(receipt.received_at)}</time></dd></div>
        <div><dt>Transport</dt><dd>{label(receipt.transport)}</dd></div>
        <div><dt>Provider</dt><dd>{receipt.provider ?? "Unspecified"}</dd></div>
        <div><dt>Run outcome</dt><dd>{report ? label(report.status) : "Unavailable"}</dd></div>
        <div><dt>Review</dt><dd>{label(receipt.review_status)}</dd></div>
        {receipt.reason_code && <div><dt>Reason</dt><dd>{label(receipt.reason_code)}</dd></div>}
      </dl>
      <details className="pulse-disclosure">
        <summary>Intake provenance</summary>
        <div className="pulse-disclosure-body pulse-receipt">
          <dl className="pulse-facts">
            <div><dt>Ingestion ID</dt><dd><code>{receipt.ingestion_id}</code></dd></div>
            {report && <div><dt>Run ID</dt><dd><code>{report.run_id}</code></dd></div>}
            <div><dt>Content SHA-256</dt><dd><code>{receipt.content_sha256 ?? "Unavailable"}</code></dd></div>
          </dl>
        </div>
      </details>
      {report && <details className="pulse-disclosure">
        <summary>Raw research report</summary>
        <div className="pulse-disclosure-body">
          <p className="subtle">Untrusted research. Source URLs are displayed as text.</p>
          <ResearchSections report={report} />
        </div>
      </details>}
      {entry.candidate_claims && entry.candidate_claims.length > 0 && <details className="pulse-disclosure">
        <summary>Validated candidate claims</summary>
        <div className="pulse-disclosure-body">
          <p className="subtle">These claims matched the intake format. Evidence verification is tracked separately.</p>
          <ul>{entry.candidate_claims.map((claim, index) =>
            <li key={index}><strong>{label(claim.verification)}</strong> · {claim.text}</li>,
          )}</ul>
        </div>
      </details>}
    </article>
  );
}

function DeliveryHealth({metrics, substantive}: {metrics: StagingInboxMetrics; substantive?: string | null}) {
  return (
    <section className="card pulse-side-card" aria-labelledby="pulse-delivery-heading">
      <h2 id="pulse-delivery-heading">Delivery health</h2>
      <dl className="pulse-facts">
        <div>
          <dt>{substantive === undefined ? "Last successful update" : "Last successful check"}</dt>
          <dd>{metrics.last_success_at
            ? <time dateTime={metrics.last_success_at}>{formattedInstant(metrics.last_success_at)}</time>
            : "None recorded"}</dd>
        </div>
        {substantive !== undefined && <div>
          <dt>Last substantive report</dt>
          <dd>{substantive ? <time dateTime={substantive}>{formattedInstant(substantive)}</time> : "None recorded"}</dd>
        </div>}
        <div><dt>Counts cover</dt><dd>{metrics.window_hours} hours</dd></div>
      </dl>
      <ul className="pulse-side-list">
        {reportTypes.map(type => {
          const run = metrics.runs[type];
          return (
            <li key={type}>
              <strong>{label(type)}</strong>
              <span className={`status ${run.missed ? "status-gap" : "status-neutral"}`}>
                {run.missed === null ? "Cadence monitoring off" : run.missed ? "Missed run" : "On cadence"}
              </span>
              <p className="micro-caption">
                {run.completed} completed · {run.no_change} no change · {run.partial} partial · {run.failed} failed
              </p>
              <p className="micro-caption">Last successful {run.last_success_at
                ? <time dateTime={run.last_success_at}>{formattedInstant(run.last_success_at)}</time>
                : "None recorded"}</p>
              <p className="micro-caption">Latest delivery {run.last_delivery_at
                ? <time dateTime={run.last_delivery_at}>{formattedInstant(run.last_delivery_at)}</time>
                : "None recorded"}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Intelligence({inbox, reload, metrics}: {
  inbox: InboxEntry[];
  reload: () => void;
  metrics?: StagingInboxMetrics;
}) {
  const received = [...inbox].sort((a, b) => b.receipt.received_at.localeCompare(a.receipt.received_at));
  return (
    <div className="pulse-content-grid">
      <section className="pulse-main" aria-labelledby="pulse-inbox-heading">
        <header className="pulse-section-heading">
          <div>
            <h2 id="pulse-inbox-heading">Research inbox</h2>
            <p className="subtle">Refreshes while this tab is visible.</p>
          </div>
          <button className="button secondary" type="button" onClick={reload}>Refresh inbox</button>
        </header>
        <p role="status" className="sr-only">
          {received.length > 0 ? `${received.length} intake receipts. Most recent receipt ${received[0]?.receipt.ingestion_id}.` : "No research receipts received."}
        </p>
        {received.length === 0 && <div className="empty-state"><strong>{metrics ? "No staging receipts received." : "No fixture receipts received."}</strong></div>}
        {received.map(entry => <InboxCard key={entry.receipt.ingestion_id} entry={entry} />)}
      </section>
      <aside className="pulse-aside" aria-label="Research and editorial review">
        {metrics && <DeliveryHealth metrics={metrics} />}
        <section className="card pulse-side-card">
          <p className="visual-kicker">Review boundary</p>
          <h2>Research to publication</h2>
          <ol className="pulse-side-list">
            <li><strong>Raw research</strong><span className="micro-caption">Discoveries, hypotheses, source leads, and questions.</span></li>
            <li><strong>Candidate claims</strong><span className="micro-caption">Structured claims awaiting independent verification.</span></li>
            {metrics && <li><strong>Independently reviewed evidence</strong><span className="micro-caption">Verified in a separate editorial workflow.</span></li>}
            <li><strong>Approved event ledger</strong><span className="micro-caption">Evidence-linked entries and separately labeled reviewed interpretations.</span></li>
          </ol>
          <Link className="text-button" to={ledgerPath}>View approved fixture ledger →</Link>
        </section>
      </aside>
    </div>
  );
}

export default function CommunityPulsePage({view}: {view: "ledger" | "intelligence"}) {
  const internal = view === "intelligence";
  const staged = internal && communityPulseStagingEnabled;
  const [params, setParams] = useSearchParams();
  const inspect = params.get("inspect");
  const history = internal && (inspect === "history" || (staged && inspect !== "receipts"));
  const threads = internal && !staged && inspect === "threads";
  const legacy = internal && staged && inspect === "receipts";
  const fixture = useCommunityPulseFeed(fixtureFeed, !staged && !history && !threads);
  const staging = useCommunityPulseFeed(stagingFeed, legacy);
  const {state, reload} = legacy ? staging : fixture;

  return (
    <section className="page page-stack pulse-page">
      <header className="page-heading pulse-heading">
        <p className="eyebrow">Local Context · Community Pulse</p>
        <h1>{internal ? "Intelligence Brief" : "Policy & Access Change Ledger"}</h1>
        <p>{internal
          ? "Inspect exploratory research, intake receipts, and evidence gaps before editorial review."
          : "Inspect policy, eligibility, and access changes with their effective dates, scope, and supporting evidence."}</p>
        <span className="status status-fixture">{internal ? (staged ? "Private staging inbox" : "Internal fixture preview") : "Synthetic ledger"}</span>
      </header>
      <nav className="pulse-nav" aria-label="Community Pulse views">
        <NavLink end to={ledgerPath}>Change ledger</NavLink>
        <NavLink to={ledgerPath + "/intelligence"}>Intelligence Brief</NavLink>
        <Link to="/local-context" className="pulse-back">← Local Context</Link>
      </nav>
      <div className="pulse-preview-note">
        {internal ? (staged ? "Reports and source leads await independent verification." :
          "Fictional reports and receipts. Agent assertions are research candidates.") :
          "Fictional records for evaluating the workflow. Source links point to placeholder documents."}
        {fixture.feed && !internal && <span>Snapshot created {formattedInstant(fixture.feed.snapshot.created_at)}</span>}
      </div>
      {internal && !staged && <nav className="pulse-history-tabs" aria-label="Intelligence workspace">
        <button className="text-button" type="button" aria-pressed={!history && !threads}
          onClick={() => setParams({})}>Fixture inbox</button>
        <button className="text-button" type="button" aria-pressed={history}
          onClick={() => setParams({ inspect: "history" })}>Research history</button>
        <button className="text-button" type="button" aria-pressed={threads}
          onClick={() => setParams({ inspect: "threads" })}>Intelligence threads</button>
      </nav>}
      {history ? <ResearchHistoryPanel renderReport={report => <ResearchSections report={report} />}
        renderHealth={health => <DeliveryHealth metrics={health.metrics} substantive={health.last_substantive_at} />} />
        : threads ? <ResearchThreadPanel renderReport={report => <ResearchSections report={report} />} />
        : legacy && staging.feed ? <Intelligence inbox={staging.feed.inbox} metrics={staging.feed.metrics} reload={reload} />
        : !staged && fixture.feed ? (internal
          ? <Intelligence inbox={fixture.feed.inbox} reload={reload} />
          : <Ledger snapshot={fixture.feed.snapshot} />)
        : <div className="state-card" role="status">
          {state === "loading" ? <strong>{staged ? "Loading staging inbox…" : "Loading synthetic intelligence…"}</strong> : <>
            <strong>{staged ? "Staging inbox is unavailable." : "Fixture intelligence is unavailable."}</strong>
            <p>Try refreshing, or continue using the existing Local Context indicators.</p>
            <button className="button secondary" type="button" onClick={reload}>Retry</button>
          </>}
        </div>}
    </section>
  );
}
