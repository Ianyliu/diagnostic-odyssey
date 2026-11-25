export interface CommunityPulseEnvironment {
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_TARGET_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  COMMUNITY_PULSE_MODE?: string;
  VITE_COMMUNITY_PULSE_ENABLED?: string;
  PULSE_STAGING_INBOX_ENABLED?: string;
  PULSE_STAGING_WORKER_URL?: string;
  PULSE_STAGING_WORKER_TOKEN?: string;
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

const stagingBranch = "feat/community-pulse-fixture-phase-f";

/** Deployment Protection must be enabled on this preview before activating the inbox. */
export function isProtectedStagingPreview(env: CommunityPulseEnvironment): boolean {
  return isProtectedFixturePreview(env)
    && env.VERCEL_GIT_COMMIT_REF === stagingBranch
    && env.PULSE_STAGING_INBOX_ENABLED === "on";
}

export function showCommunityPulseStaging(env: CommunityPulseEnvironment): boolean {
  return showCommunityPulseFixtures(env) && isProtectedStagingPreview(env);
}
