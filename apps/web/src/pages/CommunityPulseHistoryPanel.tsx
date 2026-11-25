import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  historyOutcomes, type HistoryFilters, type ResearchDetail, type ResearchHistoryPage,
} from "../../../../packages/community-pulse/src/history.ts";
import { reportTypes, type ReadableResearchReport } from "../../../../packages/community-pulse/src/research.ts";
import type { ThreadCitation, ThreadProjection } from "../../../../packages/community-pulse/src/threads.ts";
import {
  parseResearchDetail, parseResearchHealth, parseResearchHistory, parseThreadProjection,
  type ResearchHealth,
} from "../data/communityPulseHistory.ts";
import { boundedInboxText } from "../data/communityPulseResponse.ts";
import { useCommunityPulseFeed } from "../data/useCommunityPulseFeed.ts";

const endpoint = "/api/community-pulse-history";
const healthFeed = { path: endpoint + "?view=health", parse: parseResearchHealth, adaptive: true };
const initialFilters: HistoryFilters = { mode: "substantive", type: null, outcome: null, from: null, to: null };
const displayTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const typeLabels: Record<string, string> = {
  hourly_scout: "Hourly scout", daily_synthesis: "Daily synthesis", weekly_strategic_review: "Weekly strategic review",
  on_demand: "On-demand research", no_change: "No substantive change", independently_reviewed: "Independently reviewed",
};

function label(value: string) {
  return typeLabels[value] ?? value.replace(/_/g, " ").replace(/^./u, letter => letter.toUpperCase());
}

function Timestamp({ value }: { value: string | null }) {
  return value ? <time dateTime={value}>{displayTime.format(new Date(value))} UTC</time> : <>None recorded</>;
}

class HistoryError extends Error {
  status: number;
  constructor(status: number) {
    super("Research history unavailable");
    this.status = status;
  }
}

async function get<T>(params: URLSearchParams, signal: AbortSignal, parse: (value: unknown) => T | null): Promise<T> {
  const response = await fetch(endpoint + "?" + params, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]), credentials: "same-origin",
    cache: "no-store", redirect: "error", headers: { Accept: "application/json" },
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw new HistoryError(response.status);
  }
  const parsed = parse(JSON.parse(await boundedInboxText(response)) as unknown);
  if (!parsed) throw new HistoryError(503);
  return parsed;
}

function getPage(filters: HistoryFilters, cursor: string | null, signal: AbortSignal) {
  const params = new URLSearchParams({ view: "history", mode: filters.mode });
  for (const key of ["type", "outcome", "from", "to"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (cursor) params.set("cursor", cursor);
  return get(params, signal, parseResearchHistory);
}

function ReportDetail({ reference, citation, render }: {
  reference: string;
  citation?: ThreadCitation;
  render: (report: ReadableResearchReport) => ReactNode;
}) {
  const [detail, setDetail] = useState<ResearchDetail | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    void get(new URLSearchParams({ view: "report", ref: reference }), request.signal, parseResearchDetail)
      .then(report => { if (!request.signal.aborted) setDetail(report); })
      .catch(() => { if (!request.signal.aborted) setUnavailable(true); });
    return () => request.abort();
  }, [reference]);
  const item = citation && detail?.digest === citation.digest ? detail.report.items[citation.item_index] : undefined;
  if (unavailable || (citation && detail && !item)) {
    return <p role="status">This report is unavailable. It may have expired or been withdrawn.</p>;
  }
  if (!detail) return <p role="status">Loading research report…</p>;
  return <div className="pulse-disclosure-body">
    <p className="subtle">Untrusted research. Source URLs are shown as text.</p>
    {item ? <section><h4>{item.title}</h4><p>{item.text}</p></section> : render(detail.report)}
    <details className="pulse-disclosure">
      <summary>Report provenance</summary>
      <dl className="pulse-facts">
        <div><dt>Contract</dt><dd>{detail.report.schema_version}</dd></div>
        <div><dt>Run ID</dt><dd><code>{detail.report.run_id}</code></dd></div>
        <div><dt>Canonical report SHA-256</dt><dd><code>{detail.digest}</code></dd></div>
      </dl>
    </details>
  </div>;
}

function Filters({ onApply }: { onApply: (filters: HistoryFilters) => void }) {
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const getValue = (key: string) => String(data.get(key) ?? "") || null;
    const outcome = historyOutcomes.find(value => value === getValue("outcome")) ?? null;
    onApply({
      mode: data.get("mode") === "all" ? "all" : "substantive",
      type: reportTypes.find(value => value === getValue("type")) ?? null,
      outcome, from: getValue("from"), to: getValue("to"),
    });
  }
  return <form className="pulse-history-filters" aria-label="Research history filters" onSubmit={apply}>
    <div><label htmlFor="pulse-filter-mode">Show</label><select id="pulse-filter-mode" name="mode" defaultValue="substantive">
      <option value="substantive">Substantive reports</option><option value="all">All delivery outcomes</option>
    </select></div>
    <div><label htmlFor="pulse-filter-type">Report type</label><select id="pulse-filter-type" name="type">
      <option value="">All report types</option>
      {reportTypes.map(type => <option key={type} value={type}>{label(type)}</option>)}
    </select></div>
    <div><label htmlFor="pulse-filter-outcome">Outcome</label><select id="pulse-filter-outcome" name="outcome">
      <option value="">All outcomes</option>
      {historyOutcomes.map(outcome => <option key={outcome} value={outcome}>{label(outcome)}</option>)}
    </select></div>
    <div><label htmlFor="pulse-filter-from">From (UTC)</label><input id="pulse-filter-from" name="from" type="date" /></div>
    <div><label htmlFor="pulse-filter-to">Through (UTC)</label><input id="pulse-filter-to" name="to" type="date" /></div>
    <button className="button secondary" type="submit">Apply filters</button>
  </form>;
}

export function ResearchHistoryPanel({ renderReport, renderHealth }: {
  renderReport: (report: ReadableResearchReport) => ReactNode;
  renderHealth: (health: ResearchHealth) => ReactNode;
}) {
  const [request, setRequest] = useState({ filters: initialFilters, cursor: null as string | null });
  const [pages, setPages] = useState<ResearchHistoryPage[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const health = useCommunityPulseFeed(healthFeed, true);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    void getPage(request.filters, request.cursor, controller.signal)
      .then(page => {
        if (!controller.signal.aborted) {
          // Retain bounded summary pages for stable backwards navigation.
          setPages(pages => request.cursor ? [...pages.slice(-11), page] : [page]);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof HistoryError && (error.status === 401 || error.status === 403)) setPages([]);
        setError(error instanceof HistoryError && error.status === 410
          ? "This history snapshot expired. Refresh to start from the latest page."
          : "Research history could not be loaded. Check the date range or refresh.");
      })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [request]);

  const page = pages.at(-1);
  const latest = request.filters.mode === "all" ? health.feed?.latest_at : health.feed?.last_substantive_at;
  const newDeliveries = !!(latest && page && Date.parse(latest) >= Date.parse(page.as_of));
  function refresh(filters = request.filters) {
    setSelected(null);
    setPages([]);
    setRequest({ filters, cursor: null });
    health.reload();
  }

  return <div className="pulse-content-grid">
    <section className="pulse-main" aria-labelledby="history-heading" aria-busy={busy}>
      <header className="pulse-section-heading"><div><h2 id="history-heading">Research history</h2>
        <p className="subtle">Delivered reports and review candidates.</p></div>
        <button className="button secondary" type="button" onClick={() => refresh()}>Refresh history</button>
      </header>
      <Filters onApply={refresh} />
      {newDeliveries && <div className="pulse-preview-note">
        <span role="status">New deliveries available.</span>
        <button className="button secondary" type="button" onClick={() => refresh()}>Show new deliveries</button>
      </div>}
      {error && <p role="status">{error}</p>}
      {health.state === "unavailable" ? <p role="status">Private research history is unavailable.</p>
        : <div aria-live="polite" className="pulse-history-records">
          {!page && busy && <p>Loading research history…</p>}
          {page && page.records.length === 0 && <p>No deliveries match this page and filter.</p>}
          {page?.records.map(row => <article className="pulse-record" key={row.ref}>
            <header className="pulse-record-heading">
              <div>
                <p className="visual-kicker">{row.report_type ? label(row.report_type) : "Intake receipt"}</p>
                <h3>{row.title ?? label(row.outcome ?? row.disposition)}</h3>
              </div>
              <span className="status status-neutral">{label(row.outcome ?? row.disposition)}</span>
            </header>
            <p className="micro-caption"><Timestamp value={row.received_at} />
              {row.item_count !== null ? ` · ${row.item_count} research items` : null}
            </p>
            {row.disposition === "accepted" && <div>
              <button className="text-button" type="button" aria-expanded={selected === row.ref}
                aria-controls={"report-detail-" + row.ref}
                onClick={() => setSelected(selected === row.ref ? null : row.ref)}>
                {selected === row.ref ? "Close report" : "Open report"}
                <span className="sr-only"> {row.title ?? label(row.outcome ?? row.disposition)}</span>
              </button>
              <div id={"report-detail-" + row.ref} hidden={selected !== row.ref}>
                {selected === row.ref && <ReportDetail key={row.ref} reference={row.ref} render={renderReport} />}
              </div>
            </div>}
          </article>)}
        </div>}
      {page && health.state !== "unavailable" && <nav className="pulse-history-pagination" aria-label="Research history pages">
        <button className="button secondary" type="button" disabled={busy || pages.length < 2}
          onClick={() => { setSelected(null); setPages(pages => pages.slice(0, -1)); }}>Newer receipts</button>
        <button className="button secondary" type="button" disabled={busy || !page.next_cursor}
          onClick={() => { setSelected(null); setRequest({ filters: request.filters, cursor: page.next_cursor }); }}>
          Older receipts
        </button>
      </nav>}
    </section>
    <aside className="pulse-aside" aria-label="Research delivery health">
      {health.feed && renderHealth(health.feed)}
    </aside>
  </div>;
}

export function ResearchThreadPanel({ renderReport }: { renderReport: (report: ReadableResearchReport) => ReactNode }) {
  const [thread, setThread] = useState<ThreadProjection | null>(null);
  const [error, setError] = useState(false);
  const [citation, setCitation] = useState<{ key: string; value: ThreadCitation } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void get(new URLSearchParams({ view: "thread" }), controller.signal, parseThreadProjection)
      .then(thread => { if (!controller.signal.aborted) setThread(thread); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  if (!thread) return <p role="status">{error ? "Synthetic intelligence thread unavailable." : "Loading synthetic intelligence thread…"}</p>;
  const superseded = new Set(thread.timeline.map(row => row.supersedes));
  return <section className="card pulse-thread" aria-labelledby="thread-heading">
    <p className="eyebrow">Synthetic reviewer workspace</p>
    <h2 id="thread-heading">{thread.topic}</h2>
    <p>{thread.description}</p>
    <ol className="pulse-thread-timeline" aria-label="Versioned reviewer timeline">
      {thread.timeline.map(row => <li key={row.id} className="pulse-record">
        <header className="pulse-record-heading">
          <div><p className="visual-kicker">Revision {row.revision} · {label(row.kind)}</p><h3>{row.title}</h3></div>
          <span className="status status-neutral">{superseded.has(row.id) ? "Superseded" : label(row.review_status)}</span>
        </header>
        <p>{row.note}</p>
        <p className="micro-caption">{row.reviewer} · <Timestamp value={row.at} /> · {label(row.evidence_status)}</p>
        {row.due_on && <p>Due <time dateTime={row.due_on}>{row.due_on}</time></p>}
        {row.supersedes && <p>Corrects revision {thread.timeline.find(entry => entry.id === row.supersedes)?.revision}.</p>}
        {row.citations.map((cite, index) => {
          const key = row.id + "-" + index;
          return <div key={key}>
            {cite.availability === "available" ? <button className="text-button" type="button"
              aria-expanded={citation?.key === key} aria-controls={"citation-" + key}
              onClick={() => setCitation(citation?.key === key ? null : { key, value: cite })}>
              {citation?.key === key ? "Close cited item" : "Open cited item " + (cite.item_index + 1)}
            </button> : <p>Cited report item is unavailable.</p>}
            <div id={"citation-" + key} hidden={citation?.key !== key}>
              {citation?.key === key && <ReportDetail key={key} reference={cite.ref} citation={citation.value} render={renderReport} />}
            </div>
          </div>;
        })}
      </li>)}
    </ol>
  </section>;
}
