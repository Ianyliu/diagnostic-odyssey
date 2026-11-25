export interface CommunityPulseEnvironment {
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_TARGET_ENV?: string;
  COMMUNITY_PULSE_MODE?: string;
  VITE_COMMUNITY_PULSE_ENABLED?: string;
}

function isVercelContext(env: CommunityPulseEnvironment): boolean {
  return env.VERCEL !== undefined
    || env.VERCEL_ENV !== undefined
    || env.VERCEL_TARGET_ENV !== undefined;
}

export function isProtectedFixturePreview(env: CommunityPulseEnvironment): boolean {
  return env.VERCEL === "1"
    && env.VERCEL_ENV === "preview"
    && (env.VERCEL_TARGET_ENV === undefined || env.VERCEL_TARGET_ENV === "preview")
    && env.COMMUNITY_PULSE_MODE === "fixture";
}

export function showCommunityPulseFixtures(env: CommunityPulseEnvironment): boolean {
  return env.VITE_COMMUNITY_PULSE_ENABLED === "on"
    && (isProtectedFixturePreview(env) || allowLocalCommunityPulseFixtures(env));
}

export function allowLocalCommunityPulseFixtures(env: CommunityPulseEnvironment): boolean {
  return !isVercelContext(env)
    && env.VITE_COMMUNITY_PULSE_ENABLED === "on"
    && env.COMMUNITY_PULSE_MODE === "fixture";
}
