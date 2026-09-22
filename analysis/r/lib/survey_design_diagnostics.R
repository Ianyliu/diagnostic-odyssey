design_psu_counts <- function(design) {
  required <- c("VARSTR", "VARPSU")
  missing <- setdiff(required, names(design$variables))
  if (length(missing)) {
    stop("Survey design lacks variance variables: ", paste(missing, collapse = ", "), call. = FALSE)
  }

  combos <- unique(data.frame(
    VARSTR = as.numeric(design$variables$VARSTR),
    VARPSU = as.numeric(design$variables$VARPSU)
  ))
  counts <- stats::aggregate(
    VARPSU ~ VARSTR,
    data = combos,
    FUN = function(x) length(unique(x))
  )
  names(counts)[2] <- "n_psu"
  counts[order(counts$VARSTR), , drop = FALSE]
}

survey_design_psu_diagnostics <- function(design, label) {
  counts <- design_psu_counts(design)
  distribution <- table(counts$n_psu)
  singleton <- counts$VARSTR[counts$n_psu == 1]

  list(
    label = label,
    weight_variable = attr(design, "do_weight_variable"),
    unweighted_design_n = nrow(design$variables),
    variance_strata_n = nrow(counts),
    unique_varstr_varpsu_n = sum(counts$n_psu),
    minimum_psus_per_stratum = min(counts$n_psu),
    maximum_psus_per_stratum = max(counts$n_psu),
    psus_per_stratum_distribution = as.list(stats::setNames(
      as.integer(distribution),
      paste0("n_psu_", names(distribution))
    )),
    true_or_represented_singleton_strata_n = length(singleton),
    singleton_strata = as.list(as.numeric(singleton)),
    survey_degf = survey_df(design, label)
  )
}

build_variance_design_diagnostics <- function(designs) {
  person_domain <- current_long_covid_domain(designs$person)
  esaq_domain <- current_long_covid_domain(designs$esaq)
  psaq_domain <- current_long_covid_domain(designs$psaq)

  full <- list(
    person = survey_design_psu_diagnostics(
      designs$person, "full PERSON / PERWT24F survey design"
    ),
    esaq = survey_design_psu_diagnostics(
      designs$esaq, "full ESAQ / ESAQWT24F survey design"
    ),
    psaq = survey_design_psu_diagnostics(
      designs$psaq, "full PSAQ / SAQWT24F survey design"
    )
  )
  domain <- list(
    person_current_case = survey_design_psu_diagnostics(
      person_domain, "current-case PERSON domain"
    ),
    esaq_current_case = survey_design_psu_diagnostics(
      esaq_domain, "current-case ESAQ domain"
    ),
    psaq_current_case = survey_design_psu_diagnostics(
      psaq_domain, "current-case PSAQ domain"
    )
  )

  for (name in names(full)) {
    full[[name]]$true_full_design_singleton_strata_n <-
      full[[name]]$true_or_represented_singleton_strata_n
    full[[name]]$true_full_design_singleton_strata <-
      full[[name]]$singleton_strata
  }
  for (name in names(domain)) {
    domain[[name]]$domain_singleton_strata_n <-
      domain[[name]]$true_or_represented_singleton_strata_n
    domain[[name]]$domain_singleton_strata <-
      domain[[name]]$singleton_strata
  }

  list(
    variance_policy = list(
      estimator = "Taylor series linearization on full weight-specific survey design with survey-domain restriction",
      survey_lonely_psu = "adjust",
      survey_adjust_domain_lonely = FALSE,
      full_design_lonely_psu_role = "Reserved for an actual one-PSU stratum in a full weight-specific design.",
      domain_singleton_role = paste(
        "No additional domain-singleton heuristic adjustment;",
        "variance is computed by ordinary full-design domain estimation."
      )
    ),
    full_designs = full,
    current_case_domains = domain,
    any_true_full_design_singleton = any(vapply(
      full,
      function(x) x$true_full_design_singleton_strata_n > 0,
      logical(1)
    ))
  )
}

ci_df_diagnostics <- function(records) {
  lapply(records, function(record) {
    list(
      estimate_id = record$estimate_id,
      measure_id = record$measure_id,
      weight_variable = record$weight_variable,
      ci_degrees_of_freedom = record$ci_degrees_of_freedom,
      ci_df_source = record$ci_df_source
    )
  })
}
