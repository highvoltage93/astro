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

export type AspectType = "conjunction" | "opposition" | "trine" | "square" | "sextile";

export type Aspect = {
  bodyA: string;
  bodyB: string;
  type: AspectType;
  exactAngle: number;
  orb: number;
};

export type CalculationWarning = {
  code: string;
  message: string;
};

export type ChartSettings = {
  zodiac: ZodiacType;
  ayanamsa?: Ayanamsa;
  houseSystem: HouseSystem;
};

export type ChartSubject = {
  utcDateTime: string;
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
  bodies: ChartPoint[];
  aspects: Aspect[];
  warnings: CalculationWarning[];
};

export type NatalPreviewInput = {
  birthDate: string;
  birthTime: string;
  timezone: string;
  latitude: number;
  longitude: number;
  houseSystem?: HouseSystem;
  zodiac?: ZodiacType;
  ayanamsa?: Ayanamsa;
  ephemerisPath?: string;
};

export type NatalCalculationInput = NatalPreviewInput;
