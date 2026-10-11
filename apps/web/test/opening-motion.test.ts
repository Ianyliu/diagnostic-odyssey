import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  OPENING_SESSION_KEY,
  markOpeningSeen,
  reducedMotionRequested,
  sessionStorageOrNull,
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

test("sessionStorageOrNull handles missing window, accessible storage, and getter security errors", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    // 1. Accessible window.sessionStorage
    const dummyStorage = { getItem: () => null } as unknown as Storage;
    Object.defineProperty(globalThis, "window", {value: {sessionStorage: dummyStorage}, configurable: true, writable: true});
    assert.equal(sessionStorageOrNull(), dummyStorage);

    // 2. window.sessionStorage getter throws error (e.g. SecurityError / privacy settings)
    const errorWindow = {};
    Object.defineProperty(errorWindow, "sessionStorage", {
      get() {
        throw new Error("SecurityError: Access is denied");
      },
      configurable: true
    });
    Object.defineProperty(globalThis, "window", {value: errorWindow, configurable: true, writable: true});
    assert.equal(sessionStorageOrNull(), null);

    // 3. window is undefined
    delete (globalThis as Record<string, unknown>).window;
    assert.equal(sessionStorageOrNull(), null);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "window"), originalWindow);
});

test("reducedMotionRequested handles state, unavailable APIs, and missing window without global leakage", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    const cases = [
      [{matchMedia: () => ({matches: true})}, true],
      [{matchMedia: () => ({matches: false})}, false],
      [{matchMedia() {throw new Error("blocked");}}, true],
      [{}, true],
      [{matchMedia: () => ({})}, true],
      [{matchMedia: () => null}, true]
    ] as const;
    for (const [value, expected] of cases) {
      Object.defineProperty(globalThis, "window", {value, configurable: true, writable: true});
      assert.equal(reducedMotionRequested(), expected);
    }
    Reflect.deleteProperty(globalThis, "window");
    assert.equal(reducedMotionRequested(), true);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "window"), originalWindow);
});

test("opening uses session storage and remains decorative", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/pages/OpeningProvenance.tsx", import.meta.url)), "utf8"
  );
  const motionSource = readFileSync(
    fileURLToPath(new URL("../src/pages/openingMotion.ts", import.meta.url)), "utf8"
  );
  assert.match(source, /sessionStorageOrNull/);
  assert.match(motionSource, /window\.sessionStorage/);
  assert.doesNotMatch(source, /localStorage/);
  assert.match(source, /className="preview-lanes" role="group" aria-label="Evidence roles remain separate"/);
  assert.match(source, /Reviewed evidence/);
  assert.match(source, /Local context/);
  assert.match(source, /Analyst assumptions/);
  assert.doesNotMatch(source, /diagnostic-odyssey-icon\.png/);
  assert.match(source, /pointerdown/);
  assert.match(source, /keydown/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});
