/** Existing analytical suites use the expanded workspace. The guided-workspace
 * suite separately checks default collapsed state, discoverability and opening. */
export async function prepareWorkspace(page) {
  for (const disclosure of await page.locator("details.workspace-disclosure").all()) {
    if (!await disclosure.evaluate(element => element.open) && await disclosure.locator(":scope > summary").isVisible()) {
      await disclosure.locator(":scope > summary").click();
    }
  }
}

export async function navigateWorkspace(page, name) {
  const label = name === "Burden" ? "Reviewed evidence" : name === "Evidence" ? "Intervention evidence & limits" : name;
  const primary = page.getByRole("navigation", {name: "Primary navigation"}).getByRole("link", {name: label, exact: true});
  if (await primary.count()) await primary.click();
  else {
    const toggle = page.getByRole("button", {name: "Menu", exact: true});
    if (await toggle.count()) await toggle.click();
    await page.getByRole("navigation", {name: "Supporting navigation"}).getByRole("link", {name: label, exact: true}).click();
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
