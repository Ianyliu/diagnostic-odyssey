/** Public, non-sensitive source-revision identity injected by Vite at build time. */
export interface BuildProvenance {
  sourceSha: string | null;
  sourceCommitDate: string | null;
  buildDate: string | null;
}

export interface DisplayBuildProvenance {
  label: string;
  url: string | null;
}

export function displayBuildProvenance(input: BuildProvenance): DisplayBuildProvenance {
  const validSha = input.sourceSha && /^[0-9a-f]{40}$/.test(input.sourceSha) ? input.sourceSha : null;
  const validCommitDate = input.sourceCommitDate && /^\d{4}-\d{2}-\d{2}$/.test(input.sourceCommitDate) ? input.sourceCommitDate : null;
  const validBuildDate = input.buildDate && /^\d{4}-\d{2}-\d{2}$/.test(input.buildDate) ? input.buildDate : null;
  if (!validSha) return { label: "Source revision unavailable", url: null };
  const label = [
    `Source ${validSha.slice(0, 10)}`,
    validCommitDate ? `committed ${validCommitDate}` : null,
    validBuildDate ? `built ${validBuildDate}` : null
  ].filter(Boolean).join(" · ");
  return {
    label,
    url: `https://github.com/Ianyliu/diagnostic-odyssey/commit/${validSha}`
  };
}
