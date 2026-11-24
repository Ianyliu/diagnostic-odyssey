import assert from "node:assert/strict";
import test from "node:test";
import {
  THEME_STORAGE_KEY,
  getThemeColor,
  parseThemePreference,
  persistThemePreference,
  readThemePreference,
  resolveTheme
} from "../src/theme.ts";

test("theme preference accepts explicit modes and defaults unstored/unexpected values to dark", () => {
  assert.equal(parseThemePreference("light"), "light");
  assert.equal(parseThemePreference("dark"), "dark");
  assert.equal(parseThemePreference("system"), "system");
  assert.equal(parseThemePreference("unexpected"), "dark");
  assert.equal(parseThemePreference(null), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("browser theme color uses the Obsidian Command resolved appearance", () => {
  assert.equal(getThemeColor(resolveTheme("system", false)), "#f4f3ee");
  assert.equal(getThemeColor(resolveTheme("system", true)), "#0a0b0e");
  assert.equal(getThemeColor(resolveTheme("light", true)), "#f4f3ee");
  assert.equal(getThemeColor(resolveTheme("dark", false)), "#0a0b0e");
});

test("unavailable storage falls back to dark without blocking theme selection", () => {
  const unavailable = {
    getItem(): string { throw new Error("storage unavailable"); },
    setItem(): void { throw new Error("storage unavailable"); }
  };
  assert.equal(readThemePreference(unavailable), "dark");
  assert.doesNotThrow(() => persistThemePreference(unavailable, "dark"));
  let saved = "";
  persistThemePreference({ setItem: (key, value) => {
    assert.equal(key, THEME_STORAGE_KEY);
    saved = value;
  } }, "light");
  assert.equal(saved, "light");
});
