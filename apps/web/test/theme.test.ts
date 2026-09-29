import assert from "node:assert/strict";
import test from "node:test";
import {
  THEME_STORAGE_KEY,
  parseThemePreference,
  persistThemePreference,
  readThemePreference,
  resolveTheme
} from "../src/theme.ts";

test("theme preference accepts only explicit modes and System follows OS", () => {
  assert.equal(parseThemePreference("light"), "light");
  assert.equal(parseThemePreference("dark"), "dark");
  assert.equal(parseThemePreference("system"), "system");
  assert.equal(parseThemePreference("unexpected"), "system");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("unavailable storage cannot block theme selection", () => {
  const unavailable = {
    getItem(): string { throw new Error("storage unavailable"); },
    setItem(): void { throw new Error("storage unavailable"); }
  };
  assert.equal(readThemePreference(unavailable), "system");
  assert.doesNotThrow(() => persistThemePreference(unavailable, "dark"));
  let saved = "";
  persistThemePreference({ setItem: (key, value) => {
    assert.equal(key, THEME_STORAGE_KEY);
    saved = value;
  } }, "light");
  assert.equal(saved, "light");
});
