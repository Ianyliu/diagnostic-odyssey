/** Existing analytical suites use the expanded workspace. The guided-workspace
 * suite separately checks default collapsed state, discoverability and opening. */
export async function prepareWorkspace(page) {
  const local = page.locator(".local-ledger-page");
  const overview = local.getByRole("button", {name: "Overview", exact: true, pressed: false});
  if (await overview.isVisible()) await overview.click();
  for (const disclosure of await page.locator("details.workspace-disclosure").all()) {
    if (!await disclosure.evaluate(element => element.open) && await disclosure.locator(":scope > summary").isVisible()) {
      await disclosure.locator(":scope > summary").click();
    }
  }
}

export async function navigateWorkspace(page, name) {
  const labelPattern =
    name === "Burden" || name === "Reviewed evidence"
      ? /^(?:01\s+)?(?:Burden|Reviewed evidence)$/
      : name === "Local context"
        ? /^(?:02\s+)?Local context$/
        : name === "Pilot planner" || name === "Strategy Lab"
          ? /^(?:03\s+)?(?:Strategy Lab|Pilot planner)$/
          : name === "Planning brief" || name === "Planning Brief"
            ? /^(?:05\s+)?Planning [Bb]rief$/
            : name === "Evidence" || name === "Intervention evidence & limits"
              ? "Evidence limits"
              : name;
  const primary = page.getByRole("navigation", {name: "Primary navigation"}).getByRole("link", {name: labelPattern, exact: true});
  if (await primary.isVisible()) await primary.click();
  else {
    const toggle = page.getByRole("button", {name: "Menu", exact: true});
    if (await toggle.count() && await toggle.isVisible()) await toggle.click();
    await page.getByRole("navigation", {name: /Primary navigation|Supporting navigation/}).getByRole("link", {name: labelPattern, exact: true}).first().click();
  }
  await page.locator("main h1").waitFor();
  await prepareWorkspace(page);
}

export async function setAppearance(page, value) {
  const control = page.getByLabel("Appearance", {exact: true});
  if (!await control.isVisible()) await page.getByRole("button", {name: "Menu", exact: true}).click();
  await control.selectOption(value);
  await page.keyboard.press("Escape");
}
