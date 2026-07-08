import type { NatalPreviewPayload } from "./chart-types";

export const DASHBOARD_CHART_DRAFT_STORAGE_KEY = "astroprocessor.dashboardChartDraft";
export const SAVED_PROFILE_OPEN_STORAGE_KEY = "astroprocessor.savedProfileToOpen";

export type DashboardChartDraft = {
  displayName: string;
  birthplaceName: string;
  countryCode?: string;
  natal: NatalPreviewPayload;
  createdAt: string;
};
