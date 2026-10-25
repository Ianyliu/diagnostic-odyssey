/* global process, console */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {navigateWorkspace, prepareWorkspace} from "./workspace-helpers.mjs";

const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const output = process.env.QA_OUTPUT ?? "/tmp/planning-request-exports";
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: "chrome", headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: "reduce"});
await page.clock.setFixedTime(new Date("2026-10-25T15:00:00Z"));
const snapshots = {};
async function capture(name) {
  await navigateWorkspace(page, "Planning brief");
  const download = page.waitForEvent("download");
  await page.getByRole("button", {name: "Export JSON companion", exact: true}).click();
  const path = `${output}/${name}.json`;
  await (await download).saveAs(path);
  snapshots[name] = JSON.parse(await readFile(path, "utf8"));
  await page.emulateMedia({media: "print"});
  await page.pdf({path: `${output}/${name}.pdf`, format: "Letter", printBackground: true});
  await page.emulateMedia({media: "screen"});
}
try {
  await page.goto(`${process.env.QA_BASE_URL ?? "http://127.0.0.1:4198"}/data-requests`);
  await page.locator("main h1").waitFor();
  await capture("empty");
  await navigateWorkspace(page, "Pilot planner");
  await page.getByRole("button", {name: "Add to data requests", exact: true}).click();
  await navigateWorkspace(page, "Data requests");
  await page.screenshot({path: `${output}/request.png`, fullPage: true});
  await capture("created");
  await navigateWorkspace(page, "Pilot planner");
  await page.locator("#pilot-capacity").fill("2000");
  await capture("stale");
  await navigateWorkspace(page, "Data requests");
  await page.getByRole("checkbox", {name: /Include in Planning Brief/}).uncheck();
  await page.getByRole("button", {name: "Refresh data request", exact: true}).click();
  await capture("refreshed-unselected");
  await navigateWorkspace(page, "Data requests");
  await page.getByRole("checkbox", {name: /Include in Planning Brief/}).check();
  await capture("refreshed-selected");
  await navigateWorkspace(page, "Data requests");
  await prepareWorkspace(page);
  await page.getByRole("button", {name: "Remove session request", exact: true}).click();
  await capture("removed");
  const base = snapshots.empty;
  assert.equal(base.burden_findings.length, 21);
  assert.equal(base.local_context.length, 34);
  for (const brief of Object.values(snapshots)) {
    for (const key of ["burden_findings", "local_context", "evidence"]) assert.deepEqual(brief[key], base[key]);
    assert.equal(brief.acquisition_guidance, undefined);
    assert.ok(brief.data_requests.every(request => request.acquisition_hint === undefined));
  }
  assert.equal(snapshots.created.data_requests.length, 1);
  assert.equal(snapshots.stale.data_requests.length, 0);
  assert.ok(snapshots.stale.warnings.some(warning => /stale/.test(warning)));
  assert.equal(snapshots["refreshed-unselected"].data_requests.length, 0);
  assert.equal(snapshots["refreshed-selected"].data_requests.length, 1);
  assert.equal(snapshots.removed.data_requests.length, 0);
  await writeFile(`${output}/snapshots.json`, JSON.stringify(snapshots, null, 2));
  console.log("PASS: six real canonical JSON/PDF stages; 21 national and 34 local records unchanged.");
} finally {
  await browser.close();
}
