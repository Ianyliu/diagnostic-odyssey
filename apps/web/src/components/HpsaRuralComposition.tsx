import { useId } from "react";
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

const VIEW_WIDTH = 1000;
const SEGMENT_GAP = 4;

export function HpsaRuralComposition({
  records,
  serviceLabel
}: {
  records: LocalContextRecord[];
  serviceLabel: string;
}) {
  const patternBaseId = useId();
  const segments = records
    .map(segmentFor)
    .filter((segment): segment is Segment => segment !== null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;

  const nonzero = segments.filter(segment => segment.value > 0);
  const aria = nonzero.map(segment => `${segment.label} ${segment.value}`).join(", ");
  const totalGap = Math.max(0, (nonzero.length - 1) * SEGMENT_GAP);
  const usableWidth = VIEW_WIDTH - totalGap;
  let cursor = 0;

  return (
    <div className="hpsa-composition">
      <div className="hpsa-composition-heading">
        <strong>{serviceLabel} designations by HRSA rural status</strong>
        <span>{total} distinct designations</span>
      </div>
      <svg
        className="hpsa-composition-svg"
        viewBox={`0 0 ${VIEW_WIDTH} 16`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${serviceLabel} HPSA designation composition: ${aria}.`}
      >
        <defs>
          <pattern id={`${patternBaseId}-partial`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="var(--do-surface)" />
            <path d="M0 0V8" stroke="var(--do-chart-3)" strokeWidth="4" />
          </pattern>
          <pattern id={`${patternBaseId}-other`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--do-chart-track)" />
            <circle cx="3" cy="3" r="1.4" fill="var(--do-chart-4)" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={VIEW_WIDTH} height="16" rx="8" className="hpsa-svg-track" />
        {nonzero.map(segment => {
          const width = Math.max(3, (segment.value / total) * usableWidth);
          const x = cursor;
          cursor += width + SEGMENT_GAP;
          const fill = segment.className === "partial"
            ? `url(#${patternBaseId}-partial)`
            : segment.className === "other"
              ? `url(#${patternBaseId}-other)`
              : undefined;
          return (
            <rect
              key={segment.label}
              x={x}
              y="0"
              width={width}
              height="16"
              rx="2"
              fill={fill}
              className={`hpsa-segment ${segment.className}`}
            >
              <title>{`${segment.label}: ${segment.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="hpsa-legend">
        {nonzero.map(segment => (
          <span key={segment.label}>
            <i className={`legend-swatch ${segment.className}`} aria-hidden="true" />
            {segment.label} <strong>{segment.value}</strong>
          </span>
        ))}
      </div>
      <p className="micro-caption">Designation counts only · not population share or shortage severity.</p>
    </div>
  );
}
