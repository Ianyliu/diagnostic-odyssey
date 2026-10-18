import {prepareWorkspace, navigateWorkspace} from "./workspace-helpers.mjs";
/* global process, window, URL, console */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, writeFile} from "node:fs/promises";
const require = createRequire(process.env.PLAYWRIGHT_RUNNER ?? import.meta.url);
const {chromium} = require("playwright");
const browser = await chromium.launch(process.env.QA_CHROME ? {executablePath: process.env.QA_CHROME} : {channel: "chrome"});
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:4175";
const output = process.env.QA_OUTPUT ?? "/tmp/workspace-continuity";
await mkdir(output, {recursive: true});
const results = [];
async function check(name, body) {
  const page = await browser.newPage({reducedMotion: "reduce"});
  try { await body(page); results.push({name, status: "PASS"}); }
  catch (error) { results.push({name, status: "FAIL", error: String(error)}); }
  finally { await page.close(); }
}
await check("Incomplete Pilot draft survives navigation; canonical export retains the last valid input", async page => {
  await page.goto(base + "/pilot");
  await page.locator("main h1").waitFor(); await prepareWorkspace(page);
  const capacity = page.locator("#pilot-capacity");
  await capacity.fill("2400");
  await capacity.fill("2e");
  await navigateWorkspace(page, "Planning brief");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", {name: /Export.*JSON/i}).click();
  const download = await downloadPromise;
  let bytes = "";
  for await (const chunk of await download.createReadStream()) bytes += chunk;
  assert.equal(JSON.parse(bytes).scenario.input.capacity, 2400);
  await navigateWorkspace(page, "Pilot planner");
  assert.equal(await capacity.inputValue(), "2e");
  assert.equal(await capacity.getAttribute("aria-invalid"), "true");
  await capacity.fill("1800");
  assert.notEqual(await capacity.getAttribute("aria-invalid"), "true");
});
await check("JSON download failure is announced, recoverable, and preserves the Brief", async page => {
  const errors = []; page.on("pageerror", error => errors.push(String(error)));
  await page.goto(base + "/brief");
  await page.locator("main h1").waitFor(); await prepareWorkspace(page);
  await page.evaluate(() => {window.originalCreateObjectURL = URL.createObjectURL; URL.createObjectURL = () => {throw new Error("Synthetic browser download failure");};});
  await page.getByRole("button", {name: /Export.*JSON/i}).click();
  await page.getByRole("status").filter({hasText: "JSON download could not start"}).waitFor();
  assert.deepEqual(errors, []);
  await page.evaluate(() => {URL.createObjectURL = window.originalCreateObjectURL;});
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", {name: /Export.*JSON/i}).click();
  assert.ok((await downloadPromise).suggestedFilename().endsWith(".json"));
});
await writeFile(`${output}/results.json`, JSON.stringify({results}, null, 2));
await browser.close();
console.log(JSON.stringify(results));
if (results.some(row => row.status !== "PASS")) process.exitCode = 1;
