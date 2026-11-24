import { createContext, useContext } from "react";

interface EditionDrawerContextValue {
  openEdition: (editionId?: string) => void;
}

export const EditionDrawerContext = createContext<EditionDrawerContextValue>({
  openEdition: () => {}
});

export function useEditionDrawer() {
  return useContext(EditionDrawerContext);
}
