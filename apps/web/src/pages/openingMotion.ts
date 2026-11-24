import { getBrowserMediaQuery, readMediaQueryMatches } from "../browserMedia.ts";

export const OPENING_SESSION_KEY = "diagnostic-odyssey.opening-seen";
export const JOURNEY_SESSION_KEY = "diagnostic-odyssey.journey-seen";
export const OPENING_DURATION_MS = 3800;
export const JOURNEY_DURATION_MS = 4000;

export interface OpeningDecision {
  pathname: string;
  search: string;
  hash: string;
  reducedMotion: boolean;
  storage: Pick<Storage, "getItem"> | null;
}

export function shouldPlayOpeningForKey(
  {
    pathname,
    search,
    hash,
    reducedMotion,
    storage
  }: OpeningDecision,
  storageKey: string
): boolean {
  if (pathname !== "/" || search || hash || reducedMotion || !storage) return false;
  try {
    return storage.getItem(storageKey) !== "seen";
  } catch {
    return false;
  }
}

export function shouldPlayOpening(decision: OpeningDecision): boolean {
  return shouldPlayOpeningForKey(decision, OPENING_SESSION_KEY);
}

export function shouldPlayJourney(decision: OpeningDecision): boolean {
  return shouldPlayOpeningForKey(decision, JOURNEY_SESSION_KEY);
}

/** Replay is intentionally independent of the one-time autoplay storage flag. */
export function canReplayOpening(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

export function sessionStorageOrNull(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function reducedMotionRequested(): boolean {
  return readMediaQueryMatches(getBrowserMediaQuery("(prefers-reduced-motion: reduce)"), true);
}

export function markOpeningSeen(
  storage: Pick<Storage, "setItem"> | null,
  storageKey: string = OPENING_SESSION_KEY
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey, "seen");
    return true;
  } catch {
    return false;
  }
}
