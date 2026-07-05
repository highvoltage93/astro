export type ZodiacType = "tropical" | "sidereal";

export type Ayanamsa = "lahiri" | "fagan-bradley";

export type HouseSystem =
  | "placidus"
  | "whole-sign"
  | "equal"
  | "koch"
  | "campanus"
  | "regiomontanus"
  | "porphyry";

export type ChartType = "natal" | "transit" | "synastry" | "progression" | "return";

export type ChartPointKind = "body" | "angle" | "node" | "asteroid" | "calculated";

export type ChartPoint = {
  key: string;
  label: string;
  kind: ChartPointKind;
  longitude: number;
  latitude?: number;
  speed?: number;
  sign: string;
  signDegree: number;
  house?: number;
};

export type HouseCusp = {
  house: number;
  longitude: number;
  sign: string;
  signDegree: number;
};

export type RulerType = "direct" | "retrograde";

export type PlanetMotion = "direct" | "retrograde" | "stationary";

export type HouseRuler = {
  house: number;
  sign: string;
  signCoverageDegrees?: number;
  rulerSource?: "cusp" | "contained-sign";
  rulerKey: string;
  rulerLabel: string;
  rulerType: RulerType;
  rulerHouse?: number;
  motion?: PlanetMotion;
};

export type PlanetRulership = {
  pointKey: string;
  pointLabel: string;
  houses: number[];
  directHouses: number[];
  retrogradeHouses: number[];
};

export type BalanceScore = {
  key: string;
  score: number;
};

export type SyntheticSignature = {
  sign: BalanceScore;
  element: BalanceScore;
  cross: BalanceScore;
  polarity: BalanceScore;
  scores: {
    signs: BalanceScore[];
    elements: BalanceScore[];
    crosses: BalanceScore[];
    polarities: BalanceScore[];
    total: number;
  };
};

export type AspectType = "conjunction" | "opposition" | "trine" | "square" | "sextile";

export type Aspect = {
  bodyA: string;
  bodyB: string;
  type: AspectType;
  exactAngle: number;
  orb: number;
};

export type HouseConnectionRole = "placement" | "ruler";

export type HouseConnectionTone = "harmonious" | "tense" | "neutral";

export type HouseConnectionDetail = {
  source: "ruler-position" | "aspect";
  tone: HouseConnectionTone;
  planetA: string;
  planetB?: string;
  fromRole: HouseConnectionRole;
  toRole: HouseConnectionRole;
  aspectType?: AspectType;
};

export type HouseConnection = {
  fromHouse: number;
  toHouse: number;
  harmonious: number;
  tense: number;
  neutral: number;
  total: number;
  details: HouseConnectionDetail[];
};

export type EssentialDignityType = "domicile" | "exaltation" | "detriment" | "fall" | "peregrine";

export type EssentialDignity = {
  pointKey: string;
  pointLabel: string;
  sign: string;
  dignity: EssentialDignityType;
  score: number;
  dispositorKey?: string;
  dispositorLabel?: string;
  chain: string[];
  cycle: boolean;
};

export type PointOrbSettings = Partial<Record<string, number>>;

export type TransitAspectPhase = "applying" | "separating" | "exact" | "stationary";

export type TransitAspectStrength = "high" | "medium" | "low";

export type TransitAspect = Aspect & {
  phase: TransitAspectPhase;
  exactAt: string | null;
  daysToExact: number | null;
  activeFrom: string | null;
  activeUntil: string | null;
  durationDays: number | null;
  score: number;
  strength: TransitAspectStrength;
};

export type CalculationWarning = {
  code: string;
  message: string;
};

export type ChartSettings = {
  zodiac: ZodiacType;
  ayanamsa?: Ayanamsa;
  houseSystem: HouseSystem;
  pointOrbs?: PointOrbSettings;
};

export type ChartSubject = {
  utcDateTime: string;
  birthTimeKnown: boolean;
  latitude: number;
  longitude: number;
};

export type ChartResult = {
  chartType: ChartType;
  engine: {
    name: string;
    version: string;
    status: "stub" | "swiss-ephemeris";
  };
  settings: ChartSettings;
  subject: ChartSubject;
  angles: ChartPoint[];
  houses: HouseCusp[];
  houseConnections?: HouseConnection[];
  houseRulers?: HouseRuler[];
  planetRulerships?: PlanetRulership[];
  syntheticSignature?: SyntheticSignature;
  essentialDignities?: EssentialDignity[];
  bodies: ChartPoint[];
  aspects: Aspect[];
  warnings: CalculationWarning[];
};

export type NatalPreviewInput = {
  birthDate: string;
  birthTime: string;
  birthTimeKnown?: boolean;
  timezone: string;
  latitude: number;
  longitude: number;
  houseSystem?: HouseSystem;
  zodiac?: ZodiacType;
  ayanamsa?: Ayanamsa;
  pointOrbs?: PointOrbSettings;
  ephemerisPath?: string;
};

export type NatalCalculationInput = NatalPreviewInput;

export type TransitCalculationInput = {
  transitDateTime: string;
  latitude: number;
  longitude: number;
  zodiac?: ZodiacType;
  ayanamsa?: Ayanamsa;
  houseSystem?: HouseSystem;
  pointOrbs?: PointOrbSettings;
  ephemerisPath?: string;
};

export type TransitPreviewInput = {
  transitDateTime: string;
  natal: NatalPreviewInput;
  zodiac?: ZodiacType;
  ayanamsa?: Ayanamsa;
  pointOrbs?: PointOrbSettings;
  ephemerisPath?: string;
};

export type ReturnKind = "solar" | "lunar";

export type ReturnEvent = {
  kind: ReturnKind;
  exactAt: string;
  targetPointKey: "sun" | "moon";
  natalLongitude: number;
  returnLongitude: number;
  chart: ChartResult;
};

export type ExactTransitEvent = TransitAspect & {
  transitPointLabel: string;
  natalPointLabel: string;
  natalHouse?: number;
};

export type ForecastPreviewInput = {
  natal: NatalPreviewInput;
  fromDateTime: string;
  targetYear?: number;
  days?: number;
  zodiac?: ZodiacType;
  ayanamsa?: Ayanamsa;
  pointOrbs?: PointOrbSettings;
  ephemerisPath?: string;
};

export type MoonPhaseName =
  | "new"
  | "waxing-crescent"
  | "first-quarter"
  | "waxing-gibbous"
  | "full"
  | "waning-gibbous"
  | "last-quarter"
  | "waning-crescent";

export type MoonPhase = {
  name: MoonPhaseName;
  phaseAngle: number;
  illuminatedFraction: number;
  waxing: boolean;
};

export type TransitDayForecast = {
  date: string;
  transitDateTime: string;
  moon: ChartPoint | null;
  moonPhase: MoonPhase | null;
  strongestAspects: TransitAspect[];
};

export type TransitPreviewResult = {
  chartType: "transit";
  generatedAt: string;
  natal: ChartResult;
  transit: ChartResult;
  moonPhase: MoonPhase | null;
  transitHousePlacements: ChartPoint[];
  transitToNatalAspects: TransitAspect[];
  weekAhead: TransitDayForecast[];
  warnings: CalculationWarning[];
};

export type ForecastPreviewResult = {
  chartType: "forecast";
  generatedAt: string;
  natal: ChartResult;
  solarReturn: ReturnEvent | null;
  lunarReturn: ReturnEvent | null;
  exactTransits: ExactTransitEvent[];
  warnings: CalculationWarning[];
};

export type SynastryPreviewInput = {
  subjectA: NatalPreviewInput;
  subjectB: NatalPreviewInput;
  zodiac?: ZodiacType;
  ayanamsa?: Ayanamsa;
  pointOrbs?: PointOrbSettings;
  ephemerisPath?: string;
};

export type SynastrySummary = {
  totalAspects: number;
  harmoniousAspects: number;
  tenseAspects: number;
  conjunctions: number;
  exactAspects: number;
};

export type SynastryPreviewResult = {
  chartType: "synastry";
  generatedAt: string;
  subjectA: ChartResult;
  subjectB: ChartResult;
  interAspects: Aspect[];
  summary: SynastrySummary;
  warnings: CalculationWarning[];
};

export type InterpretationHighlight = {
  factorKey: string;
  title: string;
  body: string;
  source: "seed";
};

export type NatalInterpretationPreview = {
  locale: "uk";
  summary: string;
  highlights: InterpretationHighlight[];
  missingFactorKeys: string[];
};
