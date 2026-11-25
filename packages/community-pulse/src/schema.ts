// Small JSON Schema vocabulary shared by the wire descriptions and runtime validator.
type ObjectSchema = {
  type: "object";
  properties: Record<string, Schema>;
  required: string[];
  additionalProperties: false;
};

export type Schema =
  | ObjectSchema
  | { type: "array"; items: Schema; minItems: number; maxItems: number; uniqueItems?: true }
  | { type: "string"; minLength: number; maxLength: number; pattern?: string; format?: "date" | "date-time" | "uri" }
  | { type: "integer"; minimum: number; maximum: number }
  | { type: "null" }
  | { enum: readonly string[] }
  | { anyOf: Schema[] };

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

const unsafeText = /[\p{Cc}\p{Cf}]/u;

export const wireVersion = "0.2.1";
export const identifier = { type: "string", minLength: 1, maxLength: 96, pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$" } as const;
export const uuid = { type: "string", minLength: 36, maxLength: 36, pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" } as const;
export const date = {
  type: "string", minLength: 10, maxLength: 10, format: "date"
} as const;
export const instant = {
  type: "string", minLength: 20, maxLength: 24,
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$", format: "date-time"
} as const;
export const url = { type: "string", minLength: 1, maxLength: 2048, format: "uri", pattern: "^https://" } as const;

export const choice = (values: readonly string[]): Schema => ({ enum: values });
export const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: "null" }] });
export const line = (maxLength: number): Schema => ({
  type: "string", minLength: 1, maxLength, pattern: "\\S"
});
export const count = (minimum: number, maximum: number): Schema => ({ type: "integer", minimum, maximum });
export const list = (schema: Schema, maxItems: number, minItems = 0): Schema => ({
  type: "array", items: schema, minItems, maxItems
});
export const unique = (schema: Schema, maxItems: number, minItems = 0): Schema => ({
  type: "array", items: schema, minItems, maxItems, uniqueItems: true
});
export const object = (properties: ObjectSchema["properties"], optional: string[] = []): ObjectSchema => ({
  type: "object", properties, required: Object.keys(properties).filter(key => !optional.includes(key)),
  additionalProperties: false
});

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function validInstant(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  const normalized = value.length === 20 ? value.replace(/Z$/, ".000Z") : value;
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === normalized;
}

export function validLink(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      && !parsed.username && !parsed.password && !parsed.port
      && !/[\\\s]/u.test(value)
      && /\.[a-z][a-z0-9-]*$/i.test(parsed.hostname)
      && !/\.(?:local|localhost|internal|test)$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

const formats = { date: validDate, "date-time": validInstant, uri: validLink };

function plainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(issues: string[], path: string, expectation: string): void {
  if (issues.length < 32) issues.push(`${path}: ${expectation}`);
}

function validate(schema: Schema, value: unknown, path: string, issues: string[]): void {
  if (issues.length >= 32) return;
  if ("anyOf" in schema) {
    if (!schema.anyOf.some(alternative => {
      const errors: string[] = [];
      validate(alternative, value, path, errors);
      return errors.length === 0;
    })) fail(issues, path, "does not match a permitted shape");
    return;
  }
  if ("enum" in schema) {
    if (typeof value !== "string" || !schema.enum.includes(value)) fail(issues, path, "not a permitted value");
    return;
  }
  switch (schema.type) {
    case "object":
      if (!plainObject(value)) {
        fail(issues, path, "expected a plain object");
        return;
      }
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.properties, key)) fail(issues, path, "contains an unexpected field");
      }
      for (const [key, field] of Object.entries(schema.properties)) {
        if (Object.hasOwn(value, key)) validate(field, value[key], `${path}.${key}`, issues);
        else if (schema.required.includes(key)) fail(issues, `${path}.${key}`, "required");
      }
      return;
    case "array":
      if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) {
        fail(issues, path, "expected an array within length limits");
        return;
      }
      if (schema.uniqueItems && new Set(value).size !== value.length) fail(issues, path, "contains duplicate values");
      for (let index = 0; index < value.length; index++) validate(schema.items, value[index], `${path}[${index}]`, issues);
      return;
    case "string":
      if (typeof value !== "string" || value.length < schema.minLength || value.length > schema.maxLength
        || unsafeText.test(value) || (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value))
        || (schema.format !== undefined && !formats[schema.format](value))) {
        fail(issues, path, "expected bounded text in the specified format");
      }
      return;
    case "integer":
      if (typeof value !== "number" || !Number.isSafeInteger(value)
        || value < schema.minimum || value > schema.maximum) fail(issues, path, "expected an integer within bounds");
      return;
    case "null":
      if (value !== null) fail(issues, path, "expected null");
  }
}

export function validateShape<T>(schema: Schema, value: unknown): ValidationResult<T> {
  const issues: string[] = [];
  validate(schema, value, "$", issues);
  return issues.length === 0 ? { ok: true, value: value as T } : { ok: false, issues };
}
