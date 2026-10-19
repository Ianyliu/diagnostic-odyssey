/** Navigation describes evidence roles; it does not gate or score progress. */
export const workspaceStages = [
  {to: "/burden", label: "Reviewed evidence", shortLabel: "Burden", role: "National descriptive evidence"},
  {to: "/local-context", label: "Local context", shortLabel: "Context", role: "Implementation constraints"},
  {to: "/pilot", label: "Pilot planner", shortLabel: "Pilot", role: "Explicit planning assumptions"},
  {to: "/brief", label: "Planning brief", shortLabel: "Brief", role: "Evidence into a decision"}
] as const;

export function workspaceStageForPath(path: string): string | null {
  if (path === "/evidence" || path.startsWith("/burden")) return "/burden";
  if (path === "/data-requests") return "/pilot";
  if (path.startsWith("/concept/")) return "/brief";
  return workspaceStages.find(stage => stage.to === path)?.to ?? null;
}
