import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  OPENING_SESSION_KEY,
  markOpeningSeen,
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

test("opening uses session storage and remains decorative", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/pages/OpeningProvenance.tsx", import.meta.url)), "utf8"
  );
  assert.match(source, /window\.sessionStorage/);
  assert.doesNotMatch(source, /localStorage/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /pointerdown/);
  assert.match(source, /keydown/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});
