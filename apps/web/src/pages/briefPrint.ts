import { getBrowserMediaQuery, readMediaQueryMatches, subscribeToMediaQuery, type MediaQuerySource } from "../browserMedia.ts";

/** Keep screen disclosure choices intact across both application and browser print. */
export interface PrintDisclosure {
  open: boolean;
}

export function createBriefPrintDisclosureState(
  getDisclosures: () => readonly PrintDisclosure[]
) {
  let original: ReadonlyArray<readonly [PrintDisclosure, boolean]> | null = null;

  return {
    prepare() {
      if (original !== null) return;
      original = getDisclosures().map(disclosure => [disclosure, disclosure.open] as const);
      for (const [disclosure] of original) disclosure.open = true;
    },
    restore() {
      if (original === null) return;
      for (const [disclosure, wasOpen] of original) disclosure.open = wasOpen;
      original = null;
    }
  };
}

export type BriefPrintDisclosureState = ReturnType<typeof createBriefPrintDisclosureState>;

export function executeBriefPrint(
  state: BriefPrintDisclosureState | null,
  printFn: () => void = () => window.print()
) {
  state?.prepare();
  try {
    printFn();
  } catch (error) {
    state?.restore();
    throw error;
  }
}

/** Print may return before a browser's asynchronous dialog has closed. */
export function watchBriefPrintMedia(
  state: ReturnType<typeof createBriefPrintDisclosureState>,
  source?: MediaQuerySource
): () => void {
  const media = getBrowserMediaQuery("print", source);
  const onChange = () => {
    if (readMediaQueryMatches(media)) state.prepare();
    else state.restore();
  };
  const unsubscribe = subscribeToMediaQuery(media, onChange);
  if (readMediaQueryMatches(media)) state.prepare();
  return () => {
    unsubscribe();
    state.restore();
  };
}
