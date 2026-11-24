/** Navigation labels and route-to-stage mapping for Cupertino Clarity. */
export const workspaceStages = [
  {to: "/", label: "Overview", shortLabel: "Overview", role: "Platform overview"},
  {to: "/burden", label: "Costs", shortLabel: "Costs", role: "National descriptive evidence"},
  {to: "/local-context", label: "Terrain", shortLabel: "Terrain", role: "Implementation constraints"},
  {to: "/pilot", label: "Simulate", shortLabel: "Simulate", role: "Explicit planning assumptions"},
  {to: "/brief", label: "Brief", shortLabel: "Brief", role: "Evidence into a decision"},
  {to: "/advisor", label: "Advisor", shortLabel: "Advisor", role: "Strategy AI Studio"}
] as const;

export function workspaceStageForPath(path: string): string | null {
  if (path === "/") return "/";
  if (path === "/evidence" || path.startsWith("/burden")) return "/burden";
  if (path === "/local-context") return "/local-context";
  if (path === "/pilot" || path === "/data-requests") return "/pilot";
  if (path === "/brief") return "/brief";
  if (path === "/advisor" || path.startsWith("/concept/")) return "/advisor";
  return workspaceStages.find(stage => stage.to === path)?.to ?? null;
}
