/** Shared design roles. CSS custom properties are the browser source of truth. */
export const designTokens = {
  light: {
    canvas: "#f6f3ed",
    surface: "#fffdfa",
    surfaceElevated: "#ffffff",
    text: "#252724",
    textMuted: "#62665f",
    border: "#d6d3cb",
    controlBorder: "#7a7e75",
    accent: "#762f3c",
    accentContrast: "#ffffff",
    focus: "#285d8a",
    reviewedText: "#286247",
    reviewedBackground: "#eaf2ea",
    warningText: "#825508",
    warningBackground: "#fbf0d8",
    selectionText: "#3f5870",
    selectionBackground: "#ebf0f4",
    assumptionText: "#665a3b",
    assumptionBackground: "#f1eddf",
    errorText: "#a13225",
    errorBackground: "#fbeae5",
    chart: ["#43647c", "#747443", "#7c6280", "#776451"]
  },
  radius: { control: 6, card: 6 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }
} as const;
