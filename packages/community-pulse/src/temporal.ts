import { validDate, validInstant } from "./schema.ts";
import type { DatePrecision } from "./vocabulary.ts";

export function dateMatchesPrecision(precision: DatePrecision, value: string | null): boolean {
  if (precision === "unknown") return value === null;
  if (value === null) return false;
  switch (precision) {
    case "year": return /^\d{4}$/.test(value);
    case "month": return /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value);
    case "date": return validDate(value);
    case "instant": return validInstant(value);
  }
}
