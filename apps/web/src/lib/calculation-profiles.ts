export type CalculationRules = {
  version: 1;
  rulershipModel: "astroprocessor" | "traditional" | "modern";
  containedSignMinDegrees: number | null;
  lilithRulesEighthHouse: boolean;
  tenseHouses: number[];
};
export type CalculationProfileReference = { id?: string; name: string; revision: number };
export type CalculationProfileConfig = {
  calculationRules: CalculationRules;
  houseSystem: string;
  zodiac: "tropical" | "sidereal";
  pointOrbs: Record<string, number>;
  visiblePointKeys: Record<string, boolean>;
};
export type CalculationProfile = {
  id: string; name: string; revision: number; schemaVersion: number; builtIn: boolean;
  config: CalculationProfileConfig; createdAt?: string; updatedAt?: string;
};
export type CalculationProfilesResponse = { profiles: CalculationProfile[]; defaultProfileId: string | null };

export const legacyCalculationRules = (): CalculationRules => ({
  version: 1, rulershipModel: "astroprocessor", containedSignMinDegrees: 12.5,
  lilithRulesEighthHouse: true, tenseHouses: [6, 8, 12]
});
export const rulershipModelLabels: Record<CalculationRules["rulershipModel"], string> = {
  astroprocessor: "Astroprocessor: поточні правила", traditional: "Традиційні управителі", modern: "Сучасні управителі"
};
export const profileReference = (profile: CalculationProfile): CalculationProfileReference => ({
  id: profile.id, name: profile.name, revision: profile.revision
});
export const sameProfileConfig = (a: CalculationProfileConfig, b: CalculationProfileConfig): boolean => {
  const sameRecord = (left: Record<string, unknown>, right: Record<string, unknown>) =>
    Object.keys(left).length === Object.keys(right).length && Object.keys(left).every((key) => left[key] === right[key]);
  return a.houseSystem === b.houseSystem && a.zodiac === b.zodiac &&
    sameRecord(a.pointOrbs, b.pointOrbs) && sameRecord(a.visiblePointKeys, b.visiblePointKeys) &&
    a.calculationRules.version === b.calculationRules.version &&
    a.calculationRules.rulershipModel === b.calculationRules.rulershipModel &&
    a.calculationRules.containedSignMinDegrees === b.calculationRules.containedSignMinDegrees &&
    a.calculationRules.lilithRulesEighthHouse === b.calculationRules.lilithRulesEighthHouse &&
    [...a.calculationRules.tenseHouses].sort((x, y) => x - y).join(",") === [...b.calculationRules.tenseHouses].sort((x, y) => x - y).join(",");
};
