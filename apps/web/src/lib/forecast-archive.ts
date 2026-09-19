import type {
  ForecastPreviewPayload, ForecastPreviewResult, NatalInterpretationPreview, SynastryPreviewPayload,
  SynastryPreviewResult, TransitPreviewPayload, TransitPreviewResult
} from "./chart-types";

export type ForecastSubject = { displayName: string; birthplaceName: string; countryCode: string };
type ForecastContext = { subject: ForecastSubject; visiblePointKeys: Record<string, boolean> };

export type ForecastArchiveInput =
  | { kind: "forecast"; parameters: ForecastPreviewPayload & { targetYear: number }; context: ForecastContext }
  | { kind: "transit"; parameters: TransitPreviewPayload; context: ForecastContext }
  | { kind: "synastry"; parameters: SynastryPreviewPayload; context: ForecastContext & { partner: ForecastSubject } };

export type ForecastArchiveKind = ForecastArchiveInput["kind"];
export type ForecastArchiveDraft = { requestId: string; input: ForecastArchiveInput; title: string };
export type SaveForecastPayload = ForecastArchiveDraft & { notes: string };

export type SavedForecastSummary = {
  id: string;
  kind: ForecastArchiveKind;
  title: string;
  notes: string;
  schemaVersion: number;
  createdAt: string;
};

export type SavedForecast = SavedForecastSummary & { interpretation: NatalInterpretationPreview } & (
  | { kind: "forecast"; input: Extract<ForecastArchiveInput, { kind: "forecast" }>; result: ForecastPreviewResult }
  | { kind: "transit"; input: Extract<ForecastArchiveInput, { kind: "transit" }>; result: TransitPreviewResult }
  | { kind: "synastry"; input: Extract<ForecastArchiveInput, { kind: "synastry" }>; result: SynastryPreviewResult }
);

export const forecastKindLabels: Record<ForecastArchiveKind, string> = {
  forecast: "Соляр і прогностика",
  transit: "Транзити",
  synastry: "Синастрія"
};

export const forecastArchivePath = (id: string): string => `/workspace?forecastId=${encodeURIComponent(id)}`;

export const FORECAST_ARCHIVE_UPDATED_EVENT = "astroprocessor:forecast-archive-updated";

export type ForecastArchiveFilters = {
  query: string;
  kind: ForecastArchiveKind | "all";
  from: string;
  through: string;
  sort: "newest" | "oldest";
};

export const defaultArchiveFilters: ForecastArchiveFilters = {
  query: "", kind: "all", from: "", through: "", sort: "newest"
};

export const archiveFilterOptions = (filters: ForecastArchiveFilters) => {
  const midnight = (value: string): Date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Некоректна дата створення.");
    const date = new Date(`${value}T00:00:00`);
    const [year, month, day] = value.split("-").map(Number);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
      throw new Error("Некоректна дата створення.");
    }
    return date;
  };
  if (filters.from && filters.through && filters.from > filters.through) {
    throw new Error("Дата «До» не може бути раніше дати «Від».");
  }
  const start = filters.from ? midnight(filters.from) : undefined;
  const end = filters.through ? midnight(filters.through) : undefined;
  // Advance a local calendar day, not 24 hours: DST days can be shorter or longer.
  if (end) end.setDate(end.getDate() + 1);
  return {
    query: filters.query.trim(), kind: filters.kind === "all" ? undefined : filters.kind,
    createdFrom: start?.toISOString(), createdBefore: end?.toISOString(), sort: filters.sort
  };
};

export const toForecastDateTimeInput = (timestamp: string): string => {
  const date = new Date(timestamp);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, -1);
};

export const resolveForecastDateTime = (value: string, original?: string): Date => {
  // Reuse the exact instant when an unchanged local time occurs twice at a DST transition.
  return new Date(original && value === toForecastDateTimeInput(original) ? original : value);
};

export const createForecastRequestId = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // LAN development over HTTP does not expose randomUUID in every browser.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
