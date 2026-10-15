import fixture from "../../../../docs/ai-experience-preview/prototype-stories.v1.json" with {type: "json"};

/** Local presentation fixtures. These are never evidence or an inference response. */
export const conceptLabel = fixture.global_required_label;
export const illustrativeLabel = "Illustrative / not source-verified";
export const goals = [
  {id: "explain_brief", title: "Explain my Brief", subtitle: "Understand the evidence", icon: "story"},
  {id: "explore_interventions", title: "Explore interventions", subtitle: "Frame the research", icon: "research"},
  {id: "identify_data_gaps", title: "Identify data gaps", subtitle: "Connect questions to data", icon: "map"},
  {id: "compare_strategies", title: "Compare strategies", subtitle: "Examine the unknowns", icon: "compare"}
] as const;
export type GoalId = typeof goals[number]["id"];
export const researchTargets = fixture.goals.find(goal => goal.id === "explore_interventions")!.research_targets!;
export const gapExamples = fixture.goals.find(goal => goal.id === "identify_data_gaps")!.examples!;
export const strategyOptions = fixture.goals.find(goal => goal.id === "compare_strategies")!.options!;
export type ResearchTarget = typeof researchTargets[number];
export type StrategyOption = typeof strategyOptions[number];

// Fail closed if a later fixture edit accidentally turns a research target into a claim.
if (fixture.is_live_ai || fixture.research_performed || fixture.reviewed_recommendations ||
    researchTargets.some(topic => topic.kind !== "research_topic_not_recommendation" ||
      [topic.citation, topic.doi, topic.pmcid, topic.source_url, topic.effectiveness, topic.cost_savings].some(value => value !== null))) {
  throw new Error("Concept storyboard must contain only unverified research questions.");
}
