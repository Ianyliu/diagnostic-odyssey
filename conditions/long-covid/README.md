# Long COVID condition adapter

Long COVID is the **Edition 01: Long COVID · U.S. National & West Virginia** reference implementation (`apps/web/src/data/coverageCatalog.ts`), currently scoped to U.S. adults ages 18–64 (21 reviewed 2024 MEPS estimates across 3 populated domains—13 economic/healthcare, 4 administrative, 4 mental-health; Work & Function stays unavailable—paired separately with 34 statewide West Virginia HRSA + ACS indicators).

This directory holds condition-specific source definitions and approved estimand availability. Generic UI and contracts must not depend directly on Long COVID-specific fields.

Current code adapter: [`packages/condition-adapters/src/index.ts`](../../packages/condition-adapters/src/index.ts).
