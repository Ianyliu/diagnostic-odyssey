import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { scrollToFragment } from "../src/data/fragmentNavigation.ts";

test("same-document fragment focuses its heading and scrolls the section", () => {
  let focused = false;
  let scrolled = false;
  const heading = {
    matches: () => true,
    hasAttribute: () => false,
    tabIndex: 0,
    focus(options: FocusOptions) {
      assert.deepEqual(options, { preventScroll: true });
      focused = true;
    }
  } as unknown as HTMLElement;
  const section = {
    matches: () => false,
    querySelector: () => heading,
    scrollIntoView(options: ScrollIntoViewOptions) {
      assert.deepEqual(options, { block: "start" });
      scrolled = true;
    }
  } as unknown as HTMLElement;

  assert.equal(scrollToFragment("#pilot-results", id => id === "pilot-results" ? section : null), true);
  assert.equal(focused, true);
  assert.equal(scrolled, true);
  assert.equal(heading.tabIndex, -1);
  assert.equal(scrollToFragment("#missing", () => null), false);
});

test("scrollToFragment falls back to literal fragment when decodeURIComponent throws on malformed URI", () => {
  let queriedId = "";
  let focused = false;
  let scrolled = false;
  const mockElement = {
    matches: () => true,
    hasAttribute: () => true,
    focus(options: FocusOptions) {
      assert.deepEqual(options, {preventScroll: true});
      focused = true;
    },
    scrollIntoView(options: ScrollIntoViewOptions) {
      assert.deepEqual(options, {block: "start"});
      scrolled = true;
    }
  } as unknown as HTMLElement;

  const malformedHash = "#%E0%A4%A";
  const result = scrollToFragment(malformedHash, id => {
    queriedId = id;
    return id === "%E0%A4%A" ? mockElement : null;
  });

  assert.equal(queriedId, "%E0%A4%A");
  assert.equal(result, true);
  assert.equal(focused, true);
  assert.equal(scrolled, true);
  assert.equal(scrollToFragment("#%E0%A4%A", () => null), false);
});

test("shell handles native same-page fragment clicks and history hash changes", () => {
  const shell = readFileSync(fileURLToPath(new URL("../src/components/AppShell.tsx", import.meta.url)), "utf8");
  assert.match(shell, /addEventListener\("hashchange", onHashChange\)/);
  assert.match(shell, /addEventListener\("click", onFragmentClick\)/);
  assert.match(shell, /scrollToFragment\(hash\)/);
});

test("route restoration saves the last observed scroll before replacing route content", () => {
  const shell = readFileSync(fileURLToPath(new URL("../src/components/AppShell.tsx", import.meta.url)), "utf8");
  assert.match(shell, /useLayoutEffect\(\(\) => \{[\s\S]*?addEventListener\("scroll", recordScroll/);
  assert.match(shell, /savedScroll\.set\(location\.key, lastScrollY\.current\)/);
  assert.match(shell, /navigationType === "POP" && savedScroll\.has\(location\.key\)/);
  assert.doesNotMatch(shell, /savedScroll\.set\(location\.key, window\.scrollY\)/);
});
