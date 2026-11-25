import { formatPlanningCurrency, formatPlanningNumber, isScientificNotationText } from "../../data/planningNumberFormatting.ts";

export const resultNumber = new Intl.NumberFormat("en-US");

export function renderPlanningText(text: string) {
  return isScientificNotationText(text) ? <span className="scientific-value">{text}</span> : text;
}

export function formatSignedDelta(value: number | null, isCurrency = false): string | null {
  if (value === null || value === 0 || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "−";
  const absText = isCurrency
    ? formatPlanningCurrency(Math.abs(value))
    : formatPlanningNumber(Math.abs(value), resultNumber);
  return `${sign}${absText}`;
}
