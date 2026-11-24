/** Navigation describes evidence roles; it does not gate or score progress. */
export const workspaceStages = [
  {to: "/burden", label: "Costs", shortLabel: "Costs", role: "National descriptive evidence"},
  {to: "/local-context", label: "Terrain", shortLabel: "Terrain", role: "Implementation constraints"},
  {to: "/pilot", label: "Simulate", shortLabel: "Simulate", role: "Explicit planning assumptions"},
  {to: "/brief", label: "Brief", shortLabel: "Brief", role: "Evidence into a decision"}
] as const;

export function workspaceStageForPath(path: string): string | null {
  if (path === "/evidence" || path.startsWith("/burden")) return "/burden";
  if (path === "/data-requests") return "/pilot";
  if (path.startsWith("/concept/") || path === "/advisor") return "/brief";
  return workspaceStages.find(stage => stage.to === path)?.to ?? null;
}
