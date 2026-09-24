import "./HpsaRuralComposition.css";
import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";

interface Segment {
  label: string;
  value: number;
  className: string;
}

function segmentFor(record: LocalContextRecord): Segment | null {
  if (typeof record.value !== "number") return null;
  if (record.indicator_id.endsWith(".rural-status.rural")) {
    return {label: "Rural", value: record.value, className: "rural"};
  }
  if (record.indicator_id.endsWith(".rural-status.partially-rural")) {
    return {label: "Partially rural", value: record.value, className: "partial"};
  }
  if (record.indicator_id.endsWith(".rural-status.non-rural")) {
    return {label: "Non-rural", value: record.value, className: "nonrural"};
  }
  if (record.indicator_id.endsWith(".rural-status.not-applicable")) {
    return {label: "Not applicable", value: record.value, className: "other"};
  }
  if (record.indicator_id.endsWith(".rural-status.unknown")) {
    return {label: "Unknown", value: record.value, className: "other"};
  }
  return null;
}

export function HpsaRuralComposition({
  records,
  serviceLabel
}: {
  records: LocalContextRecord[];
  serviceLabel: string;
}) {
  const segments = records
    .map(segmentFor)
    .filter((segment): segment is Segment => segment !== null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;

  const nonzero = segments.filter(segment => segment.value > 0);
  const aria = nonzero
    .map(segment => `${segment.label} ${segment.value}`)
    .join(", ");

  return <div className="hpsa-composition">
    <div className="hpsa-composition-heading">
      <strong>{serviceLabel} designations by HRSA rural-status category</strong>
      <span>{total} included distinct designations</span>
    </div>
    <div
      className="hpsa-composition-track"
      role="img"
      aria-label={`${serviceLabel} HPSA designation composition: ${aria}.`}
    >
      {nonzero.map(segment => <span
        key={segment.label}
        className={`hpsa-segment ${segment.className}`}
        style={{width: `${(segment.value / total) * 100}%`}}
        title={`${segment.label}: ${segment.value}`}
      />)}
    </div>
    <div className="hpsa-legend">
      {nonzero.map(segment => <span key={segment.label}>
        <i className={`legend-swatch ${segment.className}`} aria-hidden="true" />
        {segment.label} <strong>{segment.value}</strong>
      </span>)}
    </div>
    <p className="visual-note">Composition of included HPSA designations only—not population share, county coverage, or statewide shortage severity.</p>
  </div>;
}
