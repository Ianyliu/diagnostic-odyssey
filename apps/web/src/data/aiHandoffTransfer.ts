import type { AiHandoffTextV1 } from "./aiHandoff.ts";
import type { AiHandoffProvider } from "./aiHandoffProviders.ts";

export type ClipboardOutcome = "copied" | "insecure" | "unsupported" | "denied";

/** Called only by a user action; no fallback writes or persistence. */
export async function copyAiHandoffText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined,
  secureContext: boolean
): Promise<ClipboardOutcome> {
  if (!secureContext) return "insecure";
  if (!clipboard?.writeText) return "unsupported";
  try { await clipboard.writeText(text); return "copied"; }
  catch { return "denied"; }
}

/**
 * Call from one direct user gesture: write to the clipboard and open a safe
 * provider home page before awaiting the clipboard promise. noopener may make
 * window.open return null even when successful; never claim launch succeeded.
 */
export function copyAndOpenAiProvider(
  text: string,
  provider: AiHandoffProvider,
  clipboard: Pick<Clipboard, "writeText"> | undefined,
  secureContext: boolean,
  openWindow: (url: string, target: string, features: string) => unknown
): {readonly copy: Promise<ClipboardOutcome>; readonly launch: "attempted" | "failed"} {
  const copy = copyAiHandoffText(text, clipboard, secureContext);
  let launch: "attempted" | "failed" = "attempted";
  try { openWindow(provider.home, "_blank", "noopener,noreferrer"); }
  catch { launch = "failed"; }
  return {copy, launch};
}

export function aiHandoffFilename(snapshot: AiHandoffTextV1): string {
  const safePart = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "brief";
  return `diagnostic-odyssey-${safePart(snapshot.envelope.provenance.national_artifact_version)}-${safePart(snapshot.envelope.analysis_goal)}-${safePart(snapshot.envelope.generated_at.slice(0, 10))}-ai-handoff.md`;
}

/** Blob bytes are the frozen preview, with no BOM, newline conversion or truncation. */
export function downloadAiHandoff(snapshot: AiHandoffTextV1): void {
  const url = URL.createObjectURL(new Blob([snapshot.markdown], {type: "text/markdown;charset=utf-8"}));
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = aiHandoffFilename(snapshot);
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Allow the browser to consume the object URL before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
