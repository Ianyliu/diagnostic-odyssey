// Public build configuration only. No endpoint, credentials, or inference dependency.
export const planningInsightsEnabled = import.meta.env?.VITE_PLANNING_INSIGHTS_PREVIEW !== "off";
