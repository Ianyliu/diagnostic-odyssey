export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value));

export const oneOf = <T extends readonly string[]>(value: unknown, choices: T): value is T[number] =>
  typeof value === "string" && choices.includes(value as T[number]);
