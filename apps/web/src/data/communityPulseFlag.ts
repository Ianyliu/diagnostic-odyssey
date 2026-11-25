/** Vite substitutes the preview-only fixture allowlist at build time. */
declare const __DO_COMMUNITY_PULSE_FIXTURES__: boolean;

export const communityPulseFixturesEnabled =
  typeof __DO_COMMUNITY_PULSE_FIXTURES__ !== "undefined" && __DO_COMMUNITY_PULSE_FIXTURES__;

declare const __DO_COMMUNITY_PULSE_STAGING__: boolean;

export const communityPulseStagingEnabled =
  typeof __DO_COMMUNITY_PULSE_STAGING__ !== "undefined" && __DO_COMMUNITY_PULSE_STAGING__;
