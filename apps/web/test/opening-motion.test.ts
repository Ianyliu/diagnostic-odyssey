import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  OPENING_SESSION_KEY,
  markOpeningSeen,
  reducedMotionRequested,
  shouldPlayOpening
} from "../src/pages/openingMotion.ts";

test("opening is confined to a normal first document entry at Overview", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }
  };
  const entry = { pathname: "/", search: "", hash: "", reducedMotion: false, storage };
  assert.equal(shouldPlayOpening(entry), true);
  assert.equal(markOpeningSeen(storage), true);
  assert.equal(values.get(OPENING_SESSION_KEY), "seen");
  assert.equal(shouldPlayOpening(entry), false);
  assert.equal(shouldPlayOpening({ ...entry, pathname: "/burden" }), false);
  assert.equal(shouldPlayOpening({ ...entry, hash: "#brief" }), false);
  assert.equal(shouldPlayOpening({ ...entry, search: "?section=pilot" }), false);

  const nextSession = new Map<string, string>();
  assert.equal(shouldPlayOpening({ ...entry, storage: {
    getItem: (key: string) => nextSession.get(key) ?? null
  } }), true);
});

test("reduced motion or storage failure produces the static composition", () => {
  const storage = { getItem: () => null };
  const entry = { pathname: "/", search: "", hash: "", reducedMotion: false, storage };
  assert.equal(shouldPlayOpening({ ...entry, reducedMotion: true }), false);
  assert.equal(shouldPlayOpening({ ...entry, storage: null }), false);
  assert.equal(shouldPlayOpening({ ...entry, storage: { getItem() { throw Error("blocked"); } } }), false);
  assert.equal(markOpeningSeen({ setItem() { throw Error("blocked"); } }), false);
});

test("reducedMotionRequested handles matchMedia state, error throwing, and missing window safely", () => {
  const originalWindow = globalThis.window;

  try {
    // 1. matchMedia returns matches: true
    globalThis.window = {
      matchMedia: ((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)"
      })) as typeof window.matchMedia
    } as unknown as Window & typeof globalThis;
    assert.equal(reducedMotionRequested(), true);

    // 2. matchMedia returns matches: false
    globalThis.window = {
      matchMedia: (() => ({
        matches: false
      })) as typeof window.matchMedia
    } as unknown as Window & typeof globalThis;
    assert.equal(reducedMotionRequested(), false);

    // 3. Error path: matchMedia throws an error
    globalThis.window = {
      matchMedia: () => {
        throw new Error("matchMedia access blocked or failed");
      }
    } as unknown as Window & typeof globalThis;
    assert.equal(reducedMotionRequested(), true);

    // 4. matchMedia is undefined / missing on window
    globalThis.window = {} as unknown as Window & typeof globalThis;
    assert.equal(reducedMotionRequested(), true);

    // 5. window is undefined
    // @ts-expect-error test window undefined
    delete globalThis.window;
    assert.equal(reducedMotionRequested(), true);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("opening uses session storage and remains decorative", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/pages/OpeningProvenance.tsx", import.meta.url)), "utf8"
  );
  assert.match(source, /window\.sessionStorage/);
  assert.doesNotMatch(source, /localStorage/);
  assert.match(source, /className="preview-lanes" aria-label="Evidence roles remain separate"/);
  assert.match(source, /Reviewed evidence/);
  assert.match(source, /Local context/);
  assert.match(source, /Analyst assumptions/);
  assert.doesNotMatch(source, /diagnostic-odyssey-icon\.png/);
  assert.match(source, /pointerdown/);
  assert.match(source, /keydown/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});
