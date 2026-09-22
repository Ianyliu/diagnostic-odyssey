source(file.path("analysis", "r", "lib", "survey_helpers.R"))

valid_design_rows <- function(data, weight_variable) {
  !is.na(data[[weight_variable]]) &
    as.numeric(data[[weight_variable]]) > 0 &
    !is.na(data$VARSTR) &
    !is.na(data$VARPSU)
}

build_meps_design <- function(data, weight_variable, eligibility = rep(TRUE, nrow(data))) {
  assert_survey_available()
  configure_meps_survey_options()

  keep <- eligibility & valid_design_rows(data, weight_variable)
  if (!any(keep)) {
    stop("No eligible positive-weight records for design ", weight_variable, call. = FALSE)
  }

  frame <- data[keep, , drop = FALSE]
  weight_formula <- stats::as.formula(paste0("~", weight_variable))
  design <- survey::svydesign(
    ids = ~VARPSU,
    strata = ~VARSTR,
    weights = weight_formula,
    data = frame,
    nest = TRUE
  )
  attr(design, "do_weight_variable") <- weight_variable
  attr(design, "do_variance_stratum") <- "VARSTR"
  attr(design, "do_variance_psu") <- "VARPSU"
  design
}

build_meps_designs <- function(data) {
  required <- c(
    "PERWT24F", "ESAQWT24F", "SAQWT24F", "PESAQWT24F",
    "ESAQELIG", "SAQELIG", "VARSTR", "VARPSU"
  )
  missing <- setdiff(required, names(data))
  if (length(missing)) {
    stop("Cannot construct MEPS survey designs; missing: ", paste(missing, collapse = ", "), call. = FALSE)
  }

  list(
    person = build_meps_design(data, "PERWT24F"),
    esaq = build_meps_design(
      data, "ESAQWT24F",
      eligibility = !is.na(data$ESAQELIG) & as.numeric(data$ESAQELIG) == 1
    ),
    psaq = build_meps_design(
      data, "SAQWT24F",
      eligibility = !is.na(data$SAQELIG) & as.numeric(data$SAQELIG) == 1
    ),
    metadata = list(
      person_weight = "PERWT24F",
      esaq_weight = "ESAQWT24F",
      psaq_weight = "SAQWT24F",
      joint_psaq_esaq_weight = "PESAQWT24F",
      joint_weight_status = "not_used_in_current_pipeline",
      variance_stratum = "VARSTR",
      variance_psu = "VARPSU",
      variance_method = "Taylor series linearization; with-replacement design",
      lonely_psu_policy = paste(
        "survey.lonely.psu='adjust' for any actual full-design lonely PSU;",
        "survey.adjust.domain.lonely=FALSE for ordinary full-design domain variance"
      )
    )
  )
}

current_long_covid_domain <- function(design) {
  base::subset(
    design,
    do_age_18_64 & !is.na(do_current_long_covid) & do_current_long_covid
  )
}
