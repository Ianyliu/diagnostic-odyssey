const integer = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0});
const currency = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0
});

function needsScientificNotation(value: number): boolean {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot display a non-finite planning value. Correct the planning inputs first.");
  }
  // Keep ordinary planning quantities on their existing locale formatters;
  // trillion-scale values need a bounded label even at narrow viewport widths.
  return Math.abs(value) >= 1e12;
}

/** toExponential() without a precision argument preserves the number's round trip. */
export function formatPlanningNumber(value: number, formatter = integer): string {
  return needsScientificNotation(value) ? value.toExponential() : formatter.format(value);
}

export function formatPlanningCurrency(value: number, formatter = currency): string {
  if (!needsScientificNotation(value)) return formatter.format(value);
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toExponential()}`;
}
