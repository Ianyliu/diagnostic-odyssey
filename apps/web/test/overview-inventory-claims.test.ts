import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const readRepo = (relPath: string) =>
  readFileSync(new URL(`../../../${relPath}`, import.meta.url), "utf8");

test("reviewed inventory counts and domains match public claims (SA-02)", () => {
  const bundle = JSON.parse(
    readRepo("artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json")
  ) as {
    burden_domains: Array<{ domain_id?: string; id?: string; measures: Array<unknown> }>;
  };
  const local = JSON.parse(
    readRepo("artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json")
  ) as {
    geography?: { geography_name?: string; geography_type?: string; county_fips?: string | null };
    indicators: Array<{
      geography_name?: string;
      geography_type?: string;
      county_fips?: string | null;
    }>;
  };

  const domainCounts = new Map<string, number>();
  for (const domain of bundle.burden_domains) {
    const key = domain.domain_id ?? domain.id ?? "unknown";
    domainCounts.set(key, domain.measures.length);
  }

  assert.equal(domainCounts.get("economic-healthcare"), 13);
  assert.equal(domainCounts.get("healthcare-work-admin"), 4);
  assert.equal(domainCounts.get("mental-human"), 4);
  assert.equal([...domainCounts.values()].reduce((a, b) => a + b, 0), 21);
  assert.equal(domainCounts.get("work-function") ?? 0, 0);

  assert.equal(local.indicators.length, 34);
  assert.equal(local.geography?.geography_name, "West Virginia");
  assert.equal(local.geography?.geography_type, "state");
  assert.equal(local.geography?.county_fips ?? null, null);
  assert.ok(
    local.indicators.every(
      ind =>
        ind.geography_name === "West Virginia" &&
        ind.geography_type === "state" &&
        (ind.county_fips ?? null) === null
    ),
    "All reviewed local-context indicators must remain statewide West Virginia with no county-level records"
  );
});

test("landing, burden tabs, coverage catalog, OG metadata, and README never overclaim work-loss or county data", () => {
  const overview = readRepo("apps/web/src/pages/OverviewPage.tsx");
  const burden = readRepo("apps/web/src/pages/BurdenPage.tsx");
  const catalog = readRepo("apps/web/src/data/coverageCatalog.ts");
  const html = readRepo("apps/web/index.html");
  const ogScript = readRepo("scripts/og/render-og-image.mjs");
  const readme = readRepo("README.md");

  assert.doesNotMatch(overview, /across county geography/i);
  assert.doesNotMatch(overview, /limitations, and work loss/i);
  assert.doesNotMatch(overview, /health-status limitations/i);
  assert.doesNotMatch(overview, /care supply/i);
  assert.doesNotMatch(overview, /\btransit\b/i);
  assert.match(overview, /13 economic\/healthcare, 4 administrative, 4 mental-health/i);
  assert.match(overview, /HRSA shortage designations/i);
  assert.match(overview, /household vehicle/i);
  assert.match(overview, /statewide West Virginia/i);
  assert.match(overview, /work-loss measures remain unavailable/i);

  assert.doesNotMatch(burden, /label:\s*"Work & Time"/);
  assert.match(burden, /label:\s*"Admin & Care Time"/);
  assert.match(burden, /Work & function \(unavailable\)/);

  assert.match(catalog, /13 economic\/healthcare, 4 administrative, 4 mental-health; work & function unavailable/);
  assert.match(catalog, /Statewide HRSA & 2024 ACS · 34 access & shortage indicators \(no county data\)/);

  assert.match(html, /statewide West Virginia/i);
  assert.doesNotMatch(html, /\bcounty\b/i);
  assert.match(ogScript, /WV HRSA \+ CENSUS ACS \(STATEWIDE\)/);

  assert.match(readme, /13 economic\/healthcare, 4 administrative, 4 mental-health; Work & Function stays explicitly missing/);
  assert.match(readme, /\*{0,2}34\*{0,2} reviewed West Virginia state-level HRSA \+ ACS indicators \(no county-level data\)/);
});
