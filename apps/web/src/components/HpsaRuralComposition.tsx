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
    return { label: "Rural", value: record.value, className: "rural" };
  }
  if (record.indicator_id.endsWith(".rural-status.partially-rural")) {
    return { label: "Partially rural", value: record.value, className: "partial" };
  }
  if (record.indicator_id.endsWith(".rural-status.non-rural")) {
    return { label: "Non-rural", value: record.value, className: "nonrural" };
  }
  if (record.indicator_id.endsWith(".rural-status.not-applicable")) {
    return { label: "Not applicable", value: record.value, className: "other" };
  }
  if (record.indicator_id.endsWith(".rural-status.unknown")) {
    return { label: "Unknown", value: record.value, className: "other" };
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
  const aria = nonzero.map(segment => `${segment.label} ${segment.value}`).join(", ");

  let cursor = 0;
  const positioned = nonzero.map(segment => {
    const w = (segment.value / total) * 300;
    const x = cursor;
    cursor += w;
    return { ...segment, x, w };
  });

  return (
    <div className="hpsa-composition">
      <div className="hpsa-composition-heading">
        <strong>{serviceLabel} rural composition</strong>
        <span>{total} designations</span>
      </div>
      <svg
        className="hpsa-composition-svg"
        viewBox="0 0 300 12"
        role="img"
        aria-label={`${serviceLabel} HPSA designation composition: ${aria}.`}
        preserveAspectRatio="none"
      >
        {positioned.map(segment => (
          <rect
            key={segment.label}
            className={`hpsa-svg-seg ${segment.className}`}
            x={segment.x}
            y="1"
            width={Math.max(1, segment.w)}
            height="10"
            rx="2"
          />
        ))}
      </svg>
      <div className="hpsa-legend">
        {nonzero.map(segment => (
          <span key={segment.label}>
            <i className={`legend-swatch ${segment.className}`} aria-hidden="true" />
            {segment.label} <strong>{segment.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
