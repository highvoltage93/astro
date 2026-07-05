export type ChartPoint = {
  key: string;
  label: string;
  kind: string;
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

export type HouseRuler = {
  house: number;
  sign: string;
  signCoverageDegrees?: number;
  rulerSource?: "cusp" | "contained-sign" | "fixed-house";
  rulerKey: string;
  rulerLabel: string;
  rulerType: "direct" | "retrograde";
  rulerHouse?: number;
  motion?: "direct" | "retrograde" | "stationary";
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
  polarity?: BalanceScore;
  scores: {
    signs: BalanceScore[];
    elements: BalanceScore[];
    crosses: BalanceScore[];
    polarities?: BalanceScore[];
    total: number;
  };
};

export type Aspect = {
  bodyA: string;
  bodyB: string;
  type: string;
  exactAngle: number;
  orb: number;
};

export type HouseConnectionDetail = {
  source: "ruler-position" | "rulership" | "aspect";
  tone: "harmonious" | "tense" | "neutral";
  planetA: string;
  planetB?: string;
  fromRole: "placement" | "ruler";
  toRole: "placement" | "ruler";
  aspectType?: string;
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

export type EssentialDignity = {
  pointKey: string;
  pointLabel: string;
  sign: string;
  dignity: "domicile" | "exaltation" | "detriment" | "fall" | "peregrine";
  score: number;
  dispositorKey?: string;
  dispositorLabel?: string;
  chain: string[];
  cycle: boolean;
};

export type TransitAspect = Aspect & {
  phase: "applying" | "separating" | "exact" | "stationary";
  exactAt: string | null;
  daysToExact: number | null;
  activeFrom: string | null;
  activeUntil: string | null;
  durationDays: number | null;
  score: number;
  strength: "high" | "medium" | "low";
};

export type ChartResult = {
  chartType: string;
  engine: {
    name: string;
    version: string;
    status: "stub" | "swiss-ephemeris";
  };
  settings: {
    zodiac: string;
    houseSystem: string;
    pointOrbs?: Record<string, number>;
  };
  subject: {
    utcDateTime: string;
    birthTimeKnown: boolean;
    latitude: number;
    longitude: number;
  };
  angles: ChartPoint[];
  houses: HouseCusp[];
  houseConnections?: HouseConnection[];
  houseRulers?: HouseRuler[];
  planetRulerships?: PlanetRulership[];
  syntheticSignature?: SyntheticSignature;
  essentialDignities?: EssentialDignity[];
  bodies: ChartPoint[];
  aspects: Aspect[];
  warnings: Array<{
    code: string;
    message: string;
  }>;
};

export type NatalPreviewPayload = {
  birthDate: string;
  birthTime: string;
  birthTimeKnown: boolean;
  timezone: string;
  latitude: number;
  longitude: number;
  houseSystem: string;
  zodiac: "tropical" | "sidereal";
  pointOrbs?: Record<string, number>;
};

export type TransitPreviewPayload = {
  transitDateTime: string;
  natal: NatalPreviewPayload;
  zodiac?: "tropical" | "sidereal";
  pointOrbs?: Record<string, number>;
};

export type ForecastPreviewPayload = {
  fromDateTime: string;
  natal: NatalPreviewPayload;
  targetYear?: number;
  days?: number;
  zodiac?: "tropical" | "sidereal";
  pointOrbs?: Record<string, number>;
};

export type SynastryPreviewPayload = {
  subjectA: NatalPreviewPayload;
  subjectB: NatalPreviewPayload;
  zodiac?: "tropical" | "sidereal";
  pointOrbs?: Record<string, number>;
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
  warnings: Array<{
    code: string;
    message: string;
  }>;
};

export type ReturnEvent = {
  kind: "solar" | "lunar";
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

export type ForecastPreviewResult = {
  chartType: "forecast";
  generatedAt: string;
  natal: ChartResult;
  solarReturn: ReturnEvent | null;
  lunarReturn: ReturnEvent | null;
  exactTransits: ExactTransitEvent[];
  warnings: Array<{
    code: string;
    message: string;
  }>;
};

export type SynastryPreviewResult = {
  chartType: "synastry";
  generatedAt: string;
  subjectA: ChartResult;
  subjectB: ChartResult;
  interAspects: Aspect[];
  summary: {
    totalAspects: number;
    harmoniousAspects: number;
    tenseAspects: number;
    conjunctions: number;
    exactAspects: number;
  };
  warnings: Array<{
    code: string;
    message: string;
  }>;
};

export type SaveBirthProfilePayload = NatalPreviewPayload & {
  displayName: string;
  birthplaceName: string;
  countryCode?: string;
};

export type SaveBirthProfileResult = {
  birthProfile: {
    id: string;
    displayName: string;
    birthplaceName: string;
    timezone: string;
    createdAt: string;
  };
  chartCalculation: {
    id: string;
    chartType: string;
    engineVersion: string;
    calculatedAt: string;
  } | null;
};

export type SavedChartCalculationSummary = {
  id: string;
  chartType: string;
  zodiacType: "tropical" | "sidereal";
  houseSystem: string;
  engineVersion: string;
  calculatedAt: string;
};

export type SavedBirthProfile = {
  id: string;
  displayName: string;
  birthDate: string;
  birthTime: string | null;
  birthTimeKnown: boolean;
  birthplaceName: string;
  countryCode?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  createdAt: string;
  latestCalculation: SavedChartCalculationSummary | null;
};

export type ListBirthProfilesResponse = {
  profiles: SavedBirthProfile[];
};

export type BirthProfileDetailResponse = {
  profile: SavedBirthProfile;
  latestCalculation: (SavedChartCalculationSummary & {
    result: ChartResult;
  }) | null;
  interpretation: NatalInterpretationPreview | null;
};

export type DeleteBirthProfileResponse = {
  deletedProfileId: string;
};

export type PlaceSearchResult = {
  provider: "open-meteo";
  providerId: string;
  name: string;
  displayName: string;
  country?: string;
  countryCode?: string;
  admin1?: string;
  admin2?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  elevation?: number;
  population?: number;
};

export type PlaceSearchResponse = {
  results: PlaceSearchResult[];
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
