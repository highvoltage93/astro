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
  timezone: string;
  latitude: number;
  longitude: number;
  houseSystem: string;
  zodiac: "tropical" | "sidereal";
};

export type SaveBirthProfilePayload = NatalPreviewPayload & {
  displayName: string;
  birthTimeKnown: boolean;
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
