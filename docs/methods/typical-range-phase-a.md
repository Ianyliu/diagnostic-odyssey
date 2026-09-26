# Survey-weighted Typical Range — Issue #19 Phase A

This phase adds descriptive survey-weighted distribution summaries to exactly two existing MEPS parent mean estimands:

- `meps24-gross-all-cause-spending-mean` from `TOTEXP24`, in `USD/person/year`, using the PERSON design and `PERWT24F`;
- `meps24-healthcare-paperwork-time-mean` from `EQPPAM53`, in `hours/person/year`, using the ESAQ design and `ESAQWT24F`.

The existing means, cohort definitions, cleaners, denominators, universes, source locators, and interpretation boundaries remain unchanged.

## Statistical definition

For each selected parent estimate, the pipeline constructs the full survey design first and then uses the existing current-Long-COVID domain/subset pathway. The same analytical cleaner used by the parent mean is applied before computing the distribution summary.

The summary is computed with:

`survey::svyquantile(..., quantiles=c(0.25,0.50,0.75), na.rm=TRUE, ci=FALSE, qrule="math")`

The returned p25, p50, and p75 are descriptive survey-weighted quantiles. The 25th–75th percentile interval is an interquartile range, not a confidence interval and not an expected patient range. Valid unweighted n and the survey-weighted denominator are calculated from the same cleaned survey-domain design.

The `DistributionSummary` is embedded in its parent `Estimate`; it has no independent release status and therefore inherits the parent's scientific release gate. A future reviewed estimate may display its mean, Typical Range (25th–75th percentile), and median in the parent's native unit. Preliminary or invalid summaries remain ineligible for released presentation/export.

## Scientific boundaries

The spending distribution remains national, all-cause, and descriptive. It is not spending attributable to Long COVID, diagnostic delay, preventable spending, savings, or local/state spending.

The paperwork/navigation distribution remains the annualized AHRQ ESAQ `EQPPAM53` measure among later ESAQ respondents previously classified operational-current at the earlier Round 3/1 anchor. It remains subject to item nonresponse and the 520-hour top code; it is not diagnostic-delay time, time caused by Long COVID, a monetized burden, or additive with the other ESAQ time domains.

## Pilot calibration remains disabled

No current reviewed MEPS distribution exactly matches a Pilot assumption in construct, population/denominator, and unit. Typical Range summaries therefore remain descriptive burden evidence and do not calibrate Pilot inputs.

Phase B / Issue #19 calibration remains pending until an exact construct, population/denominator, and unit match is available and independently reviewed.
