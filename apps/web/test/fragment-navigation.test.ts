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

test("shell handles native same-page fragment clicks and history hash changes", () => {
  const shell = readFileSync(fileURLToPath(new URL("../src/components/AppShell.tsx", import.meta.url)), "utf8");
  assert.match(shell, /addEventListener\("hashchange", onHashChange\)/);
  assert.match(shell, /addEventListener\("click", onFragmentClick\)/);
  assert.match(shell, /scrollToFragment\(hash\)/);
});
