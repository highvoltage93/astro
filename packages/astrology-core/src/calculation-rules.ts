export type RulershipModel = "astroprocessor" | "traditional" | "modern";

export type CalculationRules = {
  version: 1;
  rulershipModel: RulershipModel;
  containedSignMinDegrees: number | null;
  lilithRulesEighthHouse: boolean;
  tenseHouses: number[];
};

export type CalculationProfileReference = { id?: string; name: string; revision: number };
export type CalculationRuleSettings = {
  calculationRules?: CalculationRules;
  calculationProfile?: CalculationProfileReference;
  visiblePointKeys?: Record<string, boolean>;
};

// Version 1 mappings are immutable contracts for archived calculations.
const LEGACY_DIRECT: Record<string, string[]> = {
  sun: ["leo"], moon: ["cancer"], mercury: ["virgo", "gemini"], venus: ["taurus", "libra"],
  mars: ["scorpio"], jupiter: ["sagittarius"], saturn: ["capricorn"],
  uranus: ["aquarius"], neptune: ["pisces"], pluto: ["aries"]
};
const LEGACY_RETROGRADE: Record<string, string[]> = {
  mars: ["scorpio", "aries"], jupiter: ["pisces", "sagittarius"], saturn: ["capricorn", "aquarius"],
  uranus: ["aquarius", "capricorn"], neptune: ["pisces", "sagittarius"], pluto: ["aries", "scorpio"]
};
const TRADITIONAL_DIRECT: Record<string, string[]> = {
  sun: ["leo"], moon: ["cancer"], mercury: ["virgo", "gemini"], venus: ["taurus", "libra"],
  mars: ["aries", "scorpio"], jupiter: ["sagittarius", "pisces"], saturn: ["capricorn", "aquarius"]
};
const MODERN_DIRECT: Record<string, string[]> = {
  sun: ["leo"], moon: ["cancer"], mercury: ["virgo", "gemini"], venus: ["taurus", "libra"],
  mars: ["aries"], jupiter: ["sagittarius"], saturn: ["capricorn"],
  uranus: ["aquarius"], neptune: ["pisces"], pluto: ["scorpio"]
};

export const defaultCalculationRules = (model: RulershipModel = "astroprocessor"): CalculationRules => ({
  version: 1,
  rulershipModel: model,
  containedSignMinDegrees: model === "astroprocessor" ? 12.5 : null,
  lilithRulesEighthHouse: model === "astroprocessor",
  tenseHouses: model === "astroprocessor" ? [6, 8, 12] : []
});

export const resolveCalculationRules = (rules?: CalculationRules): CalculationRules => {
  if (!rules) return defaultCalculationRules();
  if (rules.version !== 1 || !["astroprocessor", "traditional", "modern"].includes(rules.rulershipModel)) {
    throw new Error("Unsupported calculation rules version or rulership model");
  }
  if (rules.containedSignMinDegrees !== null &&
    (!Number.isFinite(rules.containedSignMinDegrees) || rules.containedSignMinDegrees < 0 || rules.containedSignMinDegrees > 30)) {
    throw new Error("Contained sign threshold must be between 0 and 30 degrees");
  }
  if (typeof rules.lilithRulesEighthHouse !== "boolean" || !Array.isArray(rules.tenseHouses) ||
    rules.tenseHouses.some((house) => !Number.isInteger(house) || house < 1 || house > 12)) {
    throw new Error("Invalid house connection rules");
  }
  return { ...rules, tenseHouses: [...new Set(rules.tenseHouses)].sort((a, b) => a - b) };
};

export const rulershipTables = (rules: CalculationRules): {
  direct: Record<string, string[]>; retrograde: Record<string, string[]>;
} => {
  const direct = rules.rulershipModel === "traditional" ? TRADITIONAL_DIRECT
    : rules.rulershipModel === "modern" ? MODERN_DIRECT : LEGACY_DIRECT;
  const retrograde = rules.rulershipModel === "astroprocessor" ? LEGACY_RETROGRADE
    : Object.fromEntries(Object.entries(direct).filter(([key]) => key !== "sun" && key !== "moon"));
  return {
    direct: Object.fromEntries(Object.entries(direct).map(([key, signs]) => [key, [...signs]])),
    retrograde: Object.fromEntries(Object.entries(retrograde).map(([key, signs]) => [key, [...signs]]))
  };
};
