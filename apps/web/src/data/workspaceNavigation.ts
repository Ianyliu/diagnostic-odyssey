/** Navigation describes evidence roles; it does not gate or score progress. */
export const workspaceStages = [
  {to: "/burden", label: "Burden", shortLabel: "Burden", role: "National descriptive evidence"},
  {to: "/local-context", label: "Local context", shortLabel: "Local context", role: "Implementation constraints"},
  {to: "/pilot", label: "Strategy Lab", shortLabel: "Strategy Lab", role: "Explicit planning assumptions"},
  {to: "/brief", label: "Planning Brief", shortLabel: "Planning Brief", role: "Evidence into a decision"}
] as const;

export function workspaceStageForPath(path: string): string | null {
  if (path === "/evidence" || path.startsWith("/burden")) return "/burden";
  if (path === "/data-requests") return null;
  if (path.startsWith("/concept/") || path === "/advisor") return null;
  return workspaceStages.find(stage => stage.to === path)?.to ?? null;
}

export function pageTitleForPath(path: string): string {
  if (path === "/") return "Diagnostic Odyssey | Evidence & Pilot Strategy Workspace";
  if (path === "/burden/medical") return "Medical & Service Use · Burden | Diagnostic Odyssey";
  if (path === "/burden/work") return "Work & Function · Burden | Diagnostic Odyssey";
  if (path === "/burden/admin") return "Administrative Time · Burden | Diagnostic Odyssey";
  if (path === "/burden/human") return "Human & Distress · Burden | Diagnostic Odyssey";
  if (path.startsWith("/burden")) return "Burden | Diagnostic Odyssey";
  if (path === "/local-context") return "Local context | Diagnostic Odyssey";
  if (path === "/pilot") return "Strategy Lab | Diagnostic Odyssey";
  if (path === "/data-requests") return "Data requests | Diagnostic Odyssey";
  if (path === "/brief") return "Planning Brief | Diagnostic Odyssey";
  if (path === "/evidence") return "Intervention Evidence & Limits | Diagnostic Odyssey";
  if (path === "/advisor" || path === "/concept/future-ai") return "Strategy AI Studio | Diagnostic Odyssey";
  return "Diagnostic Odyssey";
}
