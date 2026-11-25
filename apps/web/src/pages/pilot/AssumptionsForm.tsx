import type { Scenario } from "@diagnostic-odyssey/contracts";
import { formatPilotInputHelper, pilotInputFields, type PilotDraftEvaluation, type PilotInputDraft, type PilotNumericField } from "../../data/pilotInputDraft";
import { PILOT_STRATEGY_PRESETS, type PilotStrategyPreset } from "../../data/planningScenarioDefaults";
import { presetMatchesScenario } from "../../data/scenarioComparison";
import { EXTRA_FIELDS, SLIDERS } from "./pilotConfig";

export function AssumptionsForm({
  scenario,
  draft,
  evaluation,
  showExtraFields,
  updateDraft,
  applyPreset,
  onToggleMore
}: {
  scenario: Scenario;
  draft: PilotInputDraft;
  evaluation: PilotDraftEvaluation;
  showExtraFields: boolean;
  updateDraft: (key: PilotNumericField, raw: string) => void;
  applyPreset: (preset: PilotStrategyPreset) => void;
  onToggleMore: () => void;
}) {
  return (
    <form id="pilot-assumptions" className="card atlas-studio-controls" onSubmit={event => event.preventDefault()}>
      <div className="atlas-presets" role="group" aria-label="Strategy presets">
        {PILOT_STRATEGY_PRESETS.map(preset => {
          const active = presetMatchesScenario(preset, scenario);
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              className={`atlas-preset-card${active ? " is-active" : ""}`}
              onClick={() => applyPreset(preset)}
            >
              <strong>{preset.label}</strong>
              <span>{preset.summary}</span>
            </button>
          );
        })}
      </div>

      <div className="atlas-slider-stack">
        {SLIDERS.map(spec => {
          const field = pilotInputFields.find(item => item.key === spec.key)!;
          const inputId = `pilot-${spec.key}`;
          const rangeId = `${inputId}-range`;
          const helperId = `${inputId}-helper`;
          const errorId = `${inputId}-error`;
          const error = evaluation.errors[spec.key];
          const helper = error ? null : formatPilotInputHelper(spec.key, draft[spec.key]);
          const numericVal = Number(draft[spec.key]);
          const appliedNumeric = spec.key === "reach" ? scenario.reach * 100 : scenario[spec.key];
          const appliedSliderVal = Number.isFinite(appliedNumeric)
            ? Math.min(spec.max, Math.max(spec.min, appliedNumeric))
            : spec.min;
          const sliderDecoupled = Boolean(error) || !Number.isFinite(numericVal);
          const sliderVal = sliderDecoupled
            ? appliedSliderVal
            : Math.min(spec.max, Math.max(spec.min, numericVal));
          const describedBy = [helper ? helperId : null, error ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined;

          return (
            <div className="atlas-slider-row" key={spec.key}>
              <div className="atlas-slider-head">
                <label htmlFor={inputId}>{spec.shortLabel}</label>
                <div className={`input-wrap atlas-slider-num${error ? " invalid" : ""}`}>
                  <input
                    id={inputId}
                    type="text"
                    inputMode="decimal"
                    value={draft[spec.key]}
                    onChange={event => updateDraft(spec.key, event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-label={field.label}
                    aria-describedby={describedBy}
                  />
                  {field.suffix && <small aria-hidden="true">{field.suffix}</small>}
                </div>
              </div>
              <input
                id={rangeId}
                type="range"
                className={`atlas-range${sliderDecoupled ? " is-decoupled" : ""}`}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={sliderVal}
                aria-label={`${field.label} slider`}
                onChange={event => updateDraft(spec.key, event.target.value)}
              />
              {helper && <small id={helperId} className="subtle">{helper}</small>}
              {sliderDecoupled && (
                <small className="subtle">Slider reflects last applied scenario until draft is fixed.</small>
              )}
              {error && <span id={errorId} className="field-error" aria-live="polite">{error}</span>}
            </div>
          );
        })}
      </div>

      <div className="atlas-more-params">
        <button
          type="button"
          className="text-button"
          onClick={onToggleMore}
          aria-expanded={showExtraFields}
        >
          {showExtraFields ? "Hide base parameters" : "More parameters (Population, Horizon, Fixed cost)"}
        </button>

        {showExtraFields && (
          <div className="atlas-extra-grid">
            {EXTRA_FIELDS.map(key => {
              const field = pilotInputFields.find(item => item.key === key)!;
              const inputId = `pilot-${key}`;
              const helperId = `${inputId}-helper`;
              const errorId = `${inputId}-error`;
              const error = evaluation.errors[key];
              const helper = error ? null : formatPilotInputHelper(key, draft[key]);
              const describedBy = [helper ? helperId : null, error ? errorId : null]
                .filter(Boolean)
                .join(" ") || undefined;
              return (
                <div className="atlas-extra-field" key={key}>
                  <label htmlFor={inputId}>{field.label}</label>
                  <div className={`input-wrap atlas-slider-num${error ? " invalid" : ""}`}>
                    <input
                      id={inputId}
                      type="text"
                      inputMode="decimal"
                      value={draft[key]}
                      onChange={event => updateDraft(key, event.target.value)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={describedBy}
                    />
                    {field.suffix && <small aria-hidden="true">{field.suffix}</small>}
                  </div>
                  {helper && !error && <small id={helperId} className="subtle">{helper}</small>}
                  {error && <span id={errorId} className="field-error" aria-live="polite">{error}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {evaluation.formError && (
        <p className="field-error form-error" aria-live="polite">{evaluation.formError}</p>
      )}
    </form>
  );
}
