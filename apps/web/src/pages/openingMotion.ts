import { getBrowserMediaQuery, readMediaQueryMatches } from "../browserMedia.ts";

export const OPENING_SESSION_KEY = "diagnostic-odyssey.opening-seen";

export interface OpeningDecision {
  pathname: string;
  search: string;
  hash: string;
  reducedMotion: boolean;
  storage: Pick<Storage, "getItem"> | null;
}

export function shouldPlayOpening({
  pathname,
  search,
  hash,
  reducedMotion,
  storage
}: OpeningDecision): boolean {
  if (pathname !== "/" || search || hash || reducedMotion || !storage) return false;
  try {
    return storage.getItem(OPENING_SESSION_KEY) !== "seen";
  } catch {
    return false;
  }
}

export function sessionStorageOrNull(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function reducedMotionRequested(): boolean {
  return readMediaQueryMatches(getBrowserMediaQuery("(prefers-reduced-motion: reduce)"), true);
}

export function markOpeningSeen(storage: Pick<Storage, "setItem"> | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(OPENING_SESSION_KEY, "seen");
    return true;
  } catch {
    return false;
  }
}
