export type AstroEventCategory = "lunar-days" | "void-moon" | "moon-phases" | "retrograde" | "eclipses" | "ingress";
export type AstroEventRow = {
  id: string; kind: string; start: string; end?: string; pointKey?: string; sign?: string; toSign?: string;
  degree?: number; motion?: "direct" | "retrograde"; day?: number; aspectAngle?: number;
  clippedStart?: boolean; clippedEnd?: boolean; eclipses?: { at: string; kind: string; type: string }[];
};
export type AstroEventsResult = {
  from: string; until: string; category: AstroEventCategory; lunarDayMethod: "moonrise" | "tithi";
  zodiac: "tropical"; timeToleranceSeconds: number; rows: AstroEventRow[]; warnings: { code: string; message: string }[];
};
export const astroEventLabels: Record<string, string> = {
  "lunar-day": "Місячний день", "void-moon": "Місяць без курсу", "new-moon": "Молодик",
  "first-quarter": "Перша чверть", "full-moon": "Повня", "last-quarter": "Остання чверть",
  retrograde: "Ретроградність", ingress: "Зміна знака", "eclipse-corridor": "Коридор затемнень",
  "solar-eclipse": "Сонячне затемнення", "lunar-eclipse": "Місячне затемнення"
};
