import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { useArtifact } from "../data/ArtifactContext";
import { createPilotInputDraft } from "../data/pilotInputDraft";
import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting";
import { PILOT_STRATEGY_PRESETS, type PilotStrategyPreset } from "../data/planningScenarioDefaults";
import { createTeaserScenario } from "../data/strategyTeaser";
import "./StrategyTeaserSandbox.css";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const SVG_WIDTH = 320;

export function StrategyTeaserSandbox() {
  const { setScenario, setPilotInputDraft } = useArtifact();
  const navigate = useNavigate();

  const initialPreset = PILOT_STRATEGY_PRESETS[1] ?? PILOT_STRATEGY_PRESETS[0]!;
  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPreset.id);
  const [reachPercent, setReachPercent] = useState<number>(Math.round(initialPreset.values.reach * 100));

  const activePreset = useMemo<PilotStrategyPreset>(
    () => PILOT_STRATEGY_PRESETS.find(item => item.id === selectedPresetId) ?? initialPreset,
    [selectedPresetId, initialPreset]
  );

  const previewScenario = useMemo(() => createTeaserScenario(activePreset, reachPercent), [activePreset, reachPercent]);

  const result = useMemo(() => calculateScenario(previewScenario), [previewScenario]);

  const coverageScale = Math.max(result.intended_reach, 1);
  const reachedWidth = Math.round((result.reached_participants / coverageScale) * SVG_WIDTH);
  const gapWidth = Math.max(0, Math.min(SVG_WIDTH - reachedWidth, Math.round((result.capacity_gap / coverageScale) * SVG_WIDTH)));
  const coveragePct = result.intended_reach > 0
    ? Math.round((result.reached_participants / result.intended_reach) * 100)
    : 0;

  const resourceTotal = Math.max(result.program_resource_requirement, 1);
  const fixedWidth = Math.round((result.fixed_program_cost / resourceTotal) * SVG_WIDTH);
  const variableWidth = Math.round((result.variable_program_cost / resourceTotal) * SVG_WIDTH);

  const handleSelectPreset = (preset: PilotStrategyPreset) => {
    setSelectedPresetId(preset.id);
    setReachPercent(Math.round(preset.values.reach * 100));
  };

  const handleLoadIntoLab = () => {
    setScenario(previewScenario);
    setPilotInputDraft(createPilotInputDraft(previewScenario));
    navigate("/pilot");
  };

  return (
    <section className="teaser-sandbox" aria-labelledby="teaser-sandbox-title" data-reveal="visible">
      <div className="teaser-sandbox-header">
        <div>
          <p className="eyebrow">INTERACTIVE STRATEGY SANDBOX</p>
          <h2 id="teaser-sandbox-title">Planning starts after the statistic.</h2>
          <p className="subtle">
            Try an illustrative program and adjust intended reach. Preview capacity and resources using the actual planning engine. Nothing is applied to your workspace until you choose to load the scenario.
          </p>
        </div>
        <span className="teaser-boundary-badge">SEPARATE PLANNING LAYER</span>
      </div>

      <div className="teaser-sandbox-grid">
        <div className="teaser-controls">
          <div className="teaser-presets">
            <span className="teaser-presets-label">Strategy preset</span>
            <div className="teaser-preset-list" role="group" aria-label="Sample strategy presets">
              {PILOT_STRATEGY_PRESETS.map(preset => {
                const pressed = preset.id === activePreset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className="teaser-preset-btn"
                    aria-pressed={pressed}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    <strong>{preset.label}</strong>
                    <small>{preset.summary}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="teaser-slider-box">
            <div className="teaser-slider-row">
              <label htmlFor="teaser-reach-slider">Intended program reach</label>
              <span className="teaser-slider-value">{reachPercent}%</span>
            </div>
            <input
              id="teaser-reach-slider"
              className="teaser-range-input"
              type="range"
              min={0}
              max={100}
              step={1}
              value={reachPercent}
              aria-valuetext={`${reachPercent}% of ${formatPlanningNumber(previewScenario.eligible_population, integer)} eligible adults (${formatPlanningNumber(result.intended_reach, integer)} intended participants)`}
              onChange={event => setReachPercent(Number(event.target.value))}
            />
            <div className="teaser-slider-meta">
              <span>Eligible: {formatPlanningNumber(previewScenario.eligible_population, integer)}</span>
              <span>Capacity cap: {formatPlanningNumber(previewScenario.capacity, integer)}</span>
            </div>
          </div>
        </div>

        <div className="teaser-results">
          <dl className="teaser-metrics" aria-label="Deterministic scenario preview metrics" aria-live="polite">
            <div>
              <dt>Participants reached</dt>
              <dd>{formatPlanningNumber(result.reached_participants, integer)}</dd>
            </div>
            <div>
              <dt>Unmet capacity gap</dt>
              <dd>{formatPlanningNumber(result.capacity_gap, integer)}</dd>
            </div>
            <div>
              <dt>Person-month exposure difference</dt>
              <dd>{formatPlanningNumber(result.difference_person_months, integer)}</dd>
            </div>
            <div>
              <dt>Program-resource requirement</dt>
              <dd>{formatPlanningCurrency(result.program_resource_requirement, currency)}</dd>
            </div>
          </dl>

          <div className="teaser-svg-bars">
            <div className="teaser-svg-block">
              <div className="teaser-svg-head">
                <span>Capacity coverage</span>
                <strong>{result.intended_reach > 0 ? `${coveragePct}% of intended reach covered` : "No intended participants"}</strong>
              </div>
              <svg
                className="teaser-bar-svg"
                viewBox={`0 0 ${SVG_WIDTH} 22`}
                role="img"
                aria-label={`Capacity coverage: ${formatPlanningNumber(result.reached_participants, integer)} reached within capacity, ${formatPlanningNumber(result.capacity_gap, integer)} capacity gap.`}
              >
                <rect className="teaser-svg-track" x="0" y="4" width={SVG_WIDTH} height="14" rx="2" />
                <rect className="teaser-svg-fill-primary" x="0" y="4" width={reachedWidth} height="14" rx="2" />
                {gapWidth > 0 && (
                  <rect className="teaser-svg-fill-gap" x={reachedWidth} y="4" width={gapWidth} height="14" rx="2" />
                )}
              </svg>
              <div className="teaser-svg-legend">
                <span><i className="teaser-swatch teaser-swatch-primary" aria-hidden="true" />Within capacity: {formatPlanningNumber(result.reached_participants, integer)}</span>
                <span><i className="teaser-swatch teaser-swatch-gap" aria-hidden="true" />Capacity gap: {formatPlanningNumber(result.capacity_gap, integer)}</span>
              </div>
            </div>

            <div className="teaser-svg-block">
              <div className="teaser-svg-head">
                <span>Resource composition (fixed vs participant-dependent)</span>
                <strong>{formatPlanningCurrency(result.program_resource_requirement, currency)}</strong>
              </div>
              <svg
                className="teaser-bar-svg"
                viewBox={`0 0 ${SVG_WIDTH} 22`}
                role="img"
                aria-label={`Program resources: ${formatPlanningCurrency(result.fixed_program_cost, currency)} fixed, ${formatPlanningCurrency(result.variable_program_cost, currency)} participant-dependent.`}
              >
                <rect className="teaser-svg-track" x="0" y="4" width={SVG_WIDTH} height="14" rx="2" />
                <rect className="teaser-svg-fill-fixed" x="0" y="4" width={fixedWidth} height="14" rx="2" />
                <rect className="teaser-svg-fill-variable" x={fixedWidth} y="4" width={variableWidth} height="14" rx="2" />
              </svg>
              <div className="teaser-svg-legend">
                <span><i className="teaser-swatch teaser-swatch-fixed" aria-hidden="true" />Fixed: {formatPlanningCurrency(result.fixed_program_cost, currency)}</span>
                <span><i className="teaser-swatch teaser-swatch-primary" aria-hidden="true" />Participant-dependent: {formatPlanningCurrency(result.variable_program_cost, currency)}</span>
              </div>
            </div>
          </div>

          <div className="teaser-footer">
            <p className="teaser-disclaimer">
              Illustrative scenario math — not a forecast, observed improvement, savings, or ROI.
            </p>
            <button type="button" className="button" onClick={handleLoadIntoLab}>
              Load into Strategy Lab →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
