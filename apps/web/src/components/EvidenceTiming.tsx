import type { EvidenceFreshness } from "@diagnostic-odyssey/brief-core";
import "./EvidenceTiming.css";

const stateLabels = {
  fixed_vintage: "Fixed survey vintage",
  snapshot_as_of: "Dated snapshot",
  stale_snapshot: "Refresh for current use",
  unknown: "Snapshot freshness unknown"
} satisfies Record<EvidenceFreshness["freshness_state"], string>;

const snapshotNotice = "HRSA refreshes its downloads daily. Check a newer source before relying on a past snapshot for current designation status.";
const mixedVintageNotice = "Use each layer within its own observation period. A trend requires a comparable time series.";

export function EvidenceTiming({ entries }: { entries: readonly EvidenceFreshness[] }) {
  if (entries.length === 0) return null;
  const families = new Set(entries.map(entry => entry.source_family));
  return (
    <section className="evidence-timing" aria-label="Evidence timing">
      <strong>Evidence timing</strong>
      <ul className="evidence-timing-summary">
        {entries.map(entry => (
          <li key={entry.source_ref}>
            <strong>{entry.source_family === "meps" ? "AHRQ MEPS" : entry.source_name}</strong>
            <span>{entry.observation_vintage}</span>
            <span>{stateLabels[entry.freshness_state]}</span>
          </li>
        ))}
      </ul>
      {families.size > 1 && <p>{mixedVintageNotice}</p>}
      {families.has("hrsa_hpsa") && <p>{snapshotNotice}</p>}
      <details>
        <summary>Source release, retrieval and artifact details</summary>
        <dl className="evidence-timing-provenance">
          {entries.map(entry => (
            <div key={entry.source_ref}>
              <dt>{entry.source_name}</dt>
              <dd>
                {entry.source_release && <>{entry.source_family === "meps" ? "Published " : "Edition "}{entry.source_release} · </>}
                {entry.source_modified_on && <>Source resource modified <time dateTime={entry.source_modified_on}>{entry.source_modified_on}</time> · </>}
                {entry.retrieved_at ? <>Retrieved <time dateTime={entry.retrieved_at}>{entry.retrieved_at.slice(0, 10)}</time></> : "Retrieval date unavailable"}
                {entry.reviewed_at ? <> · Reviewed <time dateTime={entry.reviewed_at}>{entry.reviewed_at.slice(0, 10)}</time></> : " · Review date unavailable"}
                {entry.assessed_on && <> · Assessed <time dateTime={entry.assessed_on}>{entry.assessed_on}</time> UTC</>}
                {" · Artifact "}<code>{entry.artifact_version}</code>
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
