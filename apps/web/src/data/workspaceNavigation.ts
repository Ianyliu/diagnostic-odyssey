/** Navigation describes evidence roles; it does not gate or score progress. */
export const workspaceStages = [
  {to: "/burden", label: "Reviewed evidence", shortLabel: "Burden", role: "National descriptive evidence"},
  {to: "/local-context", label: "Local context", shortLabel: "Context", role: "Implementation constraints"},
  {to: "/pilot", label: "Pilot planner", shortLabel: "Pilot", role: "Explicit planning assumptions"},
  {to: "/brief", label: "Planning brief", shortLabel: "Brief", role: "Evidence into a decision"}
] as const;

/** Companion entries sit beside the workflow: persistently discoverable without renumbering the four stages. */
export const workspaceCompanions = [
  {to: "/data-requests", label: "Data requests", shortLabel: "Requests", role: "Uncertainty into a concrete request"}
] as const;

/** Exact-path companion destination, or null when the path belongs to a numbered stage. */
export function workspaceCompanionForPath(path: string): string | null {
  return workspaceCompanions.find(entry => entry.to === path)?.to ?? null;
}

export function workspaceStageForPath(path: string): string | null {
  if (path === "/evidence" || path.startsWith("/burden")) return "/burden";
  if (path === "/data-requests") return "/pilot";
  if (path.startsWith("/concept/")) return "/brief";
  return workspaceStages.find(stage => stage.to === path)?.to ?? null;
}
