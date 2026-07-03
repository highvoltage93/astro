export type ChartPoint = {
  key: string;
  label: string;
  kind: string;
  longitude: number;
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

export type Aspect = {
  bodyA: string;
  bodyB: string;
  type: string;
  exactAngle: number;
  orb: number;
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
  };
  subject: {
    utcDateTime: string;
    birthTimeKnown: boolean;
    latitude: number;
    longitude: number;
  };
  angles: ChartPoint[];
  houses: HouseCusp[];
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
};

export type TransitPreviewPayload = {
  transitDateTime: string;
  natal: NatalPreviewPayload;
  zodiac?: "tropical" | "sidereal";
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
  strongestAspects: Aspect[];
};

export type TransitPreviewResult = {
  chartType: "transit";
  generatedAt: string;
  natal: ChartResult;
  transit: ChartResult;
  moonPhase: MoonPhase | null;
  transitToNatalAspects: Aspect[];
  weekAhead: TransitDayForecast[];
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
