# MEPS review tooling

This directory contains **review-only analytical tooling**, not normal candidate-generation entrypoints.

## Variance-policy review

`meps_variance_policy_review.R` preserves the executable review used to adjudicate the MEPS 2024 Long COVID lonely-PSU/domain-variance policy.

- Historical source branch: `methods-variance-review`
- Historical source commit: `c33812d1f8be91727860682425b11957795c427c`
- Reviewed real-data workflow/run: `35730539778`
- Purpose: variance-policy sensitivity/review, **not** normal candidate generation
- Adopted production policy: `survey.lonely.psu="adjust"`
- Adopted domain policy: `survey.adjust.domain.lonely=FALSE`
- Reviewed finding: the full PERSON, ESAQ, and PSAQ designs each had 105 strata, 264 unique `VARSTR`/`VARPSU` combinations, zero true singleton strata, and survey df 159.

The policy values in current configuration/methods documentation remain the reviewed source of truth. This archived script does not silently change them and should not be used to manufacture a replacement review result without a separate methods re-review.
