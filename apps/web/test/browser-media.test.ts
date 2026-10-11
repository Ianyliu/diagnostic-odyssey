import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  getBrowserMediaQuery,
  readMediaQueryMatches,
  subscribeToMediaQuery,
  type MediaQuerySource
} from "../src/browserMedia.ts";
import { resolveTheme } from "../src/theme.ts";

const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
after(() => assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "window"), windowDescriptor));

function sourceFor(media: Partial<MediaQueryList>): MediaQuerySource {
  return {matchMedia: () => media as MediaQueryList};
}

test("missing, throwing, and malformed media-query APIs use explicit fallback values", () => {
  for (const source of [null, {}, {matchMedia() { throw new Error("blocked"); }}]) {
    assert.equal(getBrowserMediaQuery("print", source), null);
  }
  for (const media of [{}, {matches: undefined}, {get matches(): boolean { throw new Error("blocked"); }}]) {
    assert.equal(getBrowserMediaQuery("print", sourceFor(media)), null);
  }
  const throwingGetter = Object.defineProperty({}, "matchMedia", {get() {throw new Error("blocked");}});
  assert.equal(getBrowserMediaQuery("print", throwingGetter), null);
  assert.equal(readMediaQueryMatches(null), false);
  assert.equal(readMediaQueryMatches(null, true), true);
  const media = {get matches(): boolean {throw new Error("blocked");}} as MediaQueryList;
  assert.equal(readMediaQueryMatches(media), false);
  assert.equal(readMediaQueryMatches(media, true), true);
});

test("system theme can be read without subscription APIs and remains manually overridable", () => {
  const media = getBrowserMediaQuery("(prefers-color-scheme: dark)", sourceFor({matches:true}));
  assert.equal(readMediaQueryMatches(media), true);
  assert.equal(resolveTheme("light", readMediaQueryMatches(media)), "light");
  assert.equal(resolveTheme("dark", readMediaQueryMatches(null)), "dark");
  assert.doesNotThrow(() => subscribeToMediaQuery(media, () => {})());
});

test("modern media subscriptions preserve callback identity, receiver, and cleanup", () => {
  const listeners = new Set<() => void>();
  const media = {
    matches: false,
    addEventListener(type: string, callback: () => void) {
      assert.equal(this, media);
      assert.equal(type, "change");
      listeners.add(callback);
    },
    removeEventListener(type: string, callback: () => void) {
      assert.equal(this, media);
      assert.equal(type, "change");
      listeners.delete(callback);
    }
  };
  let observed = false;
  const query = media as unknown as MediaQueryList;
  const stop = subscribeToMediaQuery(query, () => { observed = readMediaQueryMatches(query); });
  assert.equal(listeners.size, 1);
  media.matches = true;
  listeners.forEach(callback => callback());
  assert.equal(observed, true);
  stop();
  assert.equal(listeners.size, 0);
  media.matches = false;
  listeners.forEach(callback => callback());
  assert.equal(observed, true);
});

test("legacy media subscriptions have matching cleanup and incomplete APIs never leak listeners", () => {
  const listeners = new Set<() => void>();
  const legacy = {
    matches: false,
    addListener(callback: () => void) {listeners.add(callback);},
    removeListener(callback: () => void) {listeners.delete(callback);}
  } as unknown as MediaQueryList;
  const stop = subscribeToMediaQuery(legacy, () => {});
  assert.equal(listeners.size, 1);
  stop();
  assert.equal(listeners.size, 0);
  for (const partial of [
    {matches:false, addEventListener() {throw new Error("must not subscribe without cleanup");}},
    {matches:false, addListener() {throw new Error("must not subscribe without cleanup");}},
    {matches:false, get addEventListener() {throw new Error("getter unavailable");}}
  ]) {
    assert.doesNotThrow(() => subscribeToMediaQuery(partial as unknown as MediaQueryList, () => {})());
  }
});

test("registration and cleanup failures cannot crash the application", () => {
  let removed = false;
  const media = {
    matches: false,
    addEventListener() {throw new Error("subscription unavailable");},
    removeEventListener() {removed = true;}
  } as unknown as MediaQueryList;
  assert.doesNotThrow(() => subscribeToMediaQuery(media, () => {})());
  assert.equal(removed, true);
  const cleanupFailure = {
    matches: false, addEventListener() {}, removeEventListener() {throw new Error("cleanup unavailable");}
  } as unknown as MediaQueryList;
  assert.doesNotThrow(() => subscribeToMediaQuery(cleanupFailure, () => {})());
});
