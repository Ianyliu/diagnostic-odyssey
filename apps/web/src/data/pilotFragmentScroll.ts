export const SENSITIVITY_FRAGMENT = "#sensitivity";

export function getPilotFragmentTargetId(hash: string): string | null {
  return hash === SENSITIVITY_FRAGMENT ? "sensitivity" : null;
}
