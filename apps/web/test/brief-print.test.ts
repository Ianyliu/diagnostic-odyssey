import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { pilotInputFields } from "../src/data/pilotInputDraft.ts";
import { formatAppliedAssumption } from "../src/pages/briefAssumptions.ts";
import {
  createBriefPrintDisclosureState,
  executeBriefPrint,
  watchBriefPrintMedia
} from "../src/pages/briefPrint.ts";

test("all eight applied Brief inputs retain precise assumption values", () => {
  const scenario: Scenario = {
    scenario_id: "print-check",
    eligible_population: 1000,
    reach: 0.2540000000000001,
    capacity: 250,
    baseline_window_months: 12,
    alternative_window_months: 6,
    horizon_months: 12,
    fixed_cost: 0.001,
    per_participant_cost: 25,
    target_pathway_step: "recognition-to-referral",
    mechanism: "navigation-support",
    assumption_refs: [],
    artifact_version: "test"
  };
  assert.equal(pilotInputFields.length, 8);
  const formatted = new Map(pilotInputFields.map(field =>
    [field.key, formatAppliedAssumption(scenario, field)]
  ));
  assert.match(formatted.get("reach") ?? "", /0\.2540000000000001/);
  assert.equal(formatted.get("fixed_cost"), "$0.001");
  assert.equal(formatted.get("baseline_window_months"), "12 months");
});

test("printing opens closed disclosures and restores each screen choice after cancellation", () => {
  const disclosures = [{open: false}, {open: true}, {open: false}];
  const state = createBriefPrintDisclosureState(() => disclosures);

  state.prepare();
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [true, true, true]);
  state.prepare();
  state.restore();
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [false, true, false]);

  disclosures[2]!.open = true;
  state.prepare();
  state.restore();
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [false, true, true]);
});

test("executeBriefPrint prepares disclosures and invokes print callback", () => {
  const disclosures = [{ open: false }, { open: true }];
  const state = createBriefPrintDisclosureState(() => disclosures);
  let printed = false;

  executeBriefPrint(state, () => {
    assert.deepEqual(disclosures.map(d => d.open), [true, true]);
    printed = true;
  });

  assert.equal(printed, true);
  // Browsers may return before the print dialog closes. Keep prepared state
  // until afterprint/media exit explicitly restores the original choices.
  assert.deepEqual(disclosures.map(d => d.open), [true, true]);
  state.prepare();
  state.restore();
  assert.deepEqual(disclosures.map(d => d.open), [false, true]);
  state.restore();
  assert.deepEqual(disclosures.map(d => d.open), [false, true]);
});

test("print preparation and cancellation restore the original scroll position once", () => {
  const viewport = {scrollX: 0, scrollY: 420, scrollTo(x?: number | ScrollToOptions, y?: number) {
    viewport.scrollX = typeof x === "number" ? x : x?.left ?? 0;
    viewport.scrollY = typeof x === "number" ? y ?? 0 : x?.top ?? 0;
  }};
  const state = createBriefPrintDisclosureState(() => [{open: false}], viewport);
  state.prepare();
  assert.equal(viewport.scrollY, 0);
  state.prepare();
  state.restore();
  assert.equal(viewport.scrollY, 420);
  viewport.scrollY = 600;
  state.restore();
  assert.equal(viewport.scrollY, 600);
});

test("executeBriefPrint restores disclosures and rethrows if print callback throws", () => {
  const disclosures = [{ open: false }, { open: true }, { open: false }];
  const state = createBriefPrintDisclosureState(() => disclosures);
  const printError = new Error("Print failed");

  assert.throws(
    () => {
      executeBriefPrint(state, () => {
        assert.deepEqual(disclosures.map(d => d.open), [true, true, true]);
        throw printError;
      });
    },
    (err: unknown) => err === printError
  );

  assert.deepEqual(disclosures.map(d => d.open), [false, true, false]);
});

test("executeBriefPrint gracefully handles null disclosure state", () => {
  let printed = false;
  executeBriefPrint(null, () => {
    printed = true;
  });
  assert.equal(printed, true);

  const printError = new Error("Print failed");
  assert.throws(
    () => {
      executeBriefPrint(null, () => {
        throw printError;
      });
    },
    (err: unknown) => err === printError
  );
});

test("Planning Brief wires print events for browser and application print", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/pages/BriefPage.tsx", import.meta.url)),
    "utf8"
  );
  assert.match(source, /addEventListener\("beforeprint", state\.prepare\)/);
  assert.match(source, /addEventListener\("afterprint", state\.restore\)/);
  assert.match(source, /executeBriefPrint\(printDisclosureState\.current\)/);
  assert.ok(source.includes("<BriefPrintControl onPrint={printBrief} pageRef={pageRef}"));
  assert.ok(source.includes("onClick={onPrint}"));
  assert.match(source, /data-print-details="summary"/);
  assert.ok(source.includes('setAttribute("data-print-details"'));
  assert.match(source, /All included records remain in the JSON export/);
  assert.match(source, /serializeBriefJson\(brief\)/);
});

test("applied Brief inputs and scenario outputs occupy separate document sections", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/pages/BriefPage.tsx", import.meta.url)),
    "utf8"
  );
  assert.match(source, /id="brief-pilot-assumptions"/);
  assert.match(source, /id="brief-scenario-outputs"/);
  assert.match(source, /pilotInputFields\.map\(field =>/);
  assert.match(source, /formatAppliedAssumption\(brief\.scenario!\.input, field\)/);
  assert.ok(source.indexOf("brief-applied-assumptions") < source.indexOf("brief-output-list"));
});

test("asynchronous print media preserves disclosure state until printing ends and detaches on cleanup", async () => {
  const disclosures = [{open:false}, {open:true}];
  const state = createBriefPrintDisclosureState(() => disclosures);
  const listeners = new Set<() => void>();
  const media = {
    matches: false,
    addEventListener(_type: string, callback: () => void) {listeners.add(callback);},
    removeEventListener(_type: string, callback: () => void) {listeners.delete(callback);}
  };
  const stop = watchBriefPrintMedia(state, {matchMedia: () => media as unknown as MediaQueryList});
  // Application print returns while the browser's print dialog remains active.
  state.prepare();
  await Promise.resolve();
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [true, true]);
  media.matches = true;
  listeners.forEach(callback => callback());
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [true, true]);
  media.matches = false;
  listeners.forEach(callback => callback());
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [false, true]);
  media.matches = true;
  listeners.forEach(callback => callback());
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [true, true]);
  stop();
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [false, true]);
  assert.equal(listeners.size, 0);
});

test("unavailable print-media APIs retain native print event restoration and unmount cleanup", () => {
  for (const source of [null, {}, {matchMedia() {throw new Error("blocked");}}, {matchMedia: () => ({matches:false}) as MediaQueryList}]) {
    const disclosure = {open:false};
    const state = createBriefPrintDisclosureState(() => [disclosure]);
    const stop = watchBriefPrintMedia(state, source);
    state.prepare();
    assert.equal(disclosure.open, true);
    state.restore(); // The browser's afterprint event remains an independent fallback.
    assert.equal(disclosure.open, false);
    state.prepare();
    stop();
    assert.equal(disclosure.open, false);
  }
});
