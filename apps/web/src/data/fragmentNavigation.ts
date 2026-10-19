/** Focus the destination heading and align its section after a fragment change. */
export function focusTarget(target: HTMLElement): void {
  const focusElement = target.matches("h1, h2, h3")
    ? target
    : target.querySelector<HTMLElement>("h1, h2, h3") ?? target;
  if (!focusElement.hasAttribute("tabindex")) focusElement.tabIndex = -1;
  focusElement.focus({ preventScroll: true });
}

export function scrollToFragment(
  hash: string,
  findTarget: (id: string) => HTMLElement | null = id => document.getElementById(id)
): boolean {
  if (!hash) return false;
  let id = hash.slice(1);
  try { id = decodeURIComponent(id); } catch { /* Use literal fragment. */ }
  const target = findTarget(id);
  if (!target) return false;
  // Open from outside in before measuring/focusing. Native details remain mounted,
  // so both same-page and router links can reveal arbitrarily nested content.
  const disclosures: HTMLDetailsElement[] = [];
  for (let element: HTMLElement | null = target; element; element = element.parentElement) {
    if (element.tagName === "DETAILS") disclosures.unshift(element as HTMLDetailsElement);
  }
  for (const disclosure of disclosures) disclosure.open = true;
  focusTarget(target);
  target.scrollIntoView({ block: "start" });
  return true;
}
