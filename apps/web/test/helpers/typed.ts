/**
 * Type-safety helpers for tests.
 *
 * These exist so that test files can be type-checked under the repository's
 * strict compiler settings (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
 * without weakening those settings or scattering ad-hoc casts.
 */

/** Narrow a possibly-missing value, failing the test with a clear message when absent. */
export function defined<T>(value: T | null | undefined, what = "value"): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected ${what} to be defined`);
  }
  return value;
}

/**
 * Deliberately violate a static type to exercise a *runtime* guard.
 *
 * Use only in negative tests that feed forged or out-of-contract data to code
 * that must reject it at runtime. The name is the documentation: every call
 * site is an intentional contract violation that a reviewer can grep for.
 */
export function invalidInput<T>(value: unknown): T {
  return value as T;
}
