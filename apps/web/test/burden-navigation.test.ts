import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../src/pages/BurdenPage.tsx",import.meta.url),"utf8");
test("exactly the administrative category opens by default, rather than all three",()=>{
 assert.match(page,/defaultOpen=\{domain\.domain_id === "healthcare-work-admin"\}/);
 assert.doesNotMatch(page,/defaultOpen className|defaultOpen=\{index !== 0\}/);
});
test("direct burden links preserve standalone domain pages and U09 secondary navigation",()=>{
 assert.match(page,/to="\/burden\/admin"/);
 assert.match(page,/to="\/burden\/human"/);
 assert.match(page,/to="\/burden\/medical#linked-condition-secondary-heading"/);
 assert.match(page,/aria-label="Explore nonfinancial burden"/);
 assert.match(page,/href=\{`#burden-\$\{domain\.domain_id\}`\}/);
 assert.match(page,/<WorkspaceDisclosure/);
 assert.match(page,/<BurdenMeasureList estimates=\{domain\.measures\} \/>/);
});
