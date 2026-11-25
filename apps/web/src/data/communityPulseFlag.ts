/** Vite substitutes the preview-only fixture allowlist at build time. */
declare const __DO_COMMUNITY_PULSE_FIXTURES__: boolean;

export const communityPulseFixturesEnabled =
  typeof __DO_COMMUNITY_PULSE_FIXTURES__ !== "undefined" && __DO_COMMUNITY_PULSE_FIXTURES__;
