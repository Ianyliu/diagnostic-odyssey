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

export function printWithDisclosureState(
  disclosureState: ReturnType<typeof createBriefPrintDisclosureState> | null,
  printFn: () => void = () => window.print()
) {
  disclosureState?.prepare();
  try {
    printFn();
  } catch (error) {
    disclosureState?.restore();
    throw error;
  }
}
