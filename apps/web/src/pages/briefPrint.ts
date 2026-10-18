import { getBrowserMediaQuery, readMediaQueryMatches, subscribeToMediaQuery, type MediaQuerySource } from "../browserMedia.ts";

/** Keep screen disclosure choices intact across both application and browser print. */
export interface PrintDisclosure {
  open: boolean;
}

export function createBriefPrintDisclosureState(
  getDisclosures: () => readonly PrintDisclosure[],
  viewport?: Pick<Window, "scrollX" | "scrollY" | "scrollTo"> & Partial<Pick<Window, "matchMedia">>
) {
  let original: ReadonlyArray<readonly [PrintDisclosure, boolean]> | null = null;
  let originalScroll: readonly [number, number] | null = null;

  return {
    prepare() {
      if (original !== null) return;
      if (viewport) originalScroll = [viewport.scrollX, viewport.scrollY];
      original = getDisclosures().map(disclosure => [disclosure, disclosure.open] as const);
      for (const [disclosure] of original) disclosure.open = true;
      // Chromium can omit a repeated fixed footer when print begins mid-scroll.
      viewport?.scrollTo(0, 0);
    },
    restore() {
      if (original !== null) {
        for (const [disclosure, wasOpen] of original) disclosure.open = wasOpen;
        original = null;
      }
      // afterprint may precede the browser leaving print media. Restore the
      // screen position only after that layout returns, retaining the snapshot.
      if (originalScroll && !readMediaQueryMatches(getBrowserMediaQuery("print", viewport))) {
        viewport?.scrollTo(...originalScroll);
        originalScroll = null;
      }
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
