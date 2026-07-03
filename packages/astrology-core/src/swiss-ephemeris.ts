import { DateTime } from "luxon";
import {
  calc,
  constants,
  houses_ex2,
  set_ephe_path,
  set_sid_mode,
  utc_to_jd,
  type Calc,
  type HouseSystems
} from "sweph";
import { calculateMajorAspects } from "./aspects";
import { ZODIAC_SIGNS } from "./constants";
import type {
  Ayanamsa,
  CalculationWarning,
  ChartPoint,
  ChartResult,
  HouseCusp,
  HouseSystem,
  NatalCalculationInput
} from "./types";

type BodyDefinition = {
  key: string;
  label: string;
  swephId: number;
  kind: ChartPoint["kind"];
};

const HOUSE_SYSTEM_CODES: Record<HouseSystem, HouseSystems> = {
  placidus: "P",
  "whole-sign": "W",
  equal: "A",
  koch: "K",
  campanus: "C",
  regiomontanus: "R",
  porphyry: "O"
};

const AYANAMSA_CODES: Record<Ayanamsa, number> = {
  lahiri: constants.SE_SIDM_LAHIRI,
  "fagan-bradley": constants.SE_SIDM_FAGAN_BRADLEY
};

const BODY_DEFINITIONS: BodyDefinition[] = [
  { key: "sun", label: "Sun", swephId: constants.SE_SUN, kind: "body" },
  { key: "moon", label: "Moon", swephId: constants.SE_MOON, kind: "body" },
  { key: "mercury", label: "Mercury", swephId: constants.SE_MERCURY, kind: "body" },
  { key: "venus", label: "Venus", swephId: constants.SE_VENUS, kind: "body" },
  { key: "mars", label: "Mars", swephId: constants.SE_MARS, kind: "body" },
  { key: "jupiter", label: "Jupiter", swephId: constants.SE_JUPITER, kind: "body" },
  { key: "saturn", label: "Saturn", swephId: constants.SE_SATURN, kind: "body" },
  { key: "uranus", label: "Uranus", swephId: constants.SE_URANUS, kind: "body" },
  { key: "neptune", label: "Neptune", swephId: constants.SE_NEPTUNE, kind: "body" },
  { key: "pluto", label: "Pluto", swephId: constants.SE_PLUTO, kind: "body" },
  { key: "north-node", label: "North Node", swephId: constants.SE_TRUE_NODE, kind: "node" },
  { key: "chiron", label: "Chiron", swephId: constants.SE_CHIRON, kind: "body" },
  { key: "lilith", label: "Lilith", swephId: constants.SE_MEAN_APOG, kind: "calculated" }
];

const normalizeLongitude = (longitude: number): number => ((longitude % 360) + 360) % 360;

const round = (value: number, digits = 6): number => Number(value.toFixed(digits));

const toSign = (longitude: number): { sign: string; signDegree: number } => {
  const normalized = normalizeLongitude(longitude);
  const signIndex = Math.floor(normalized / 30);
  const sign = ZODIAC_SIGNS[signIndex] ?? "aries";

  return {
    sign,
    signDegree: round(normalized - signIndex * 30, 4)
  };
};

const localBirthTimeToUtc = (input: NatalCalculationInput): DateTime => {
  const local = DateTime.fromISO(`${input.birthDate}T${input.birthTime}:00`, {
    zone: input.timezone
  });

  if (!local.isValid) {
    throw new Error(local.invalidExplanation ?? `Invalid birth date, time, or timezone: ${input.timezone}`);
  }

  return local.toUTC();
};

const buildJulianDate = (utc: DateTime): { jdEt: number; jdUt: number } => {
  const converted = utc_to_jd(
    utc.year,
    utc.month,
    utc.day,
    utc.hour,
    utc.minute,
    utc.second + utc.millisecond / 1000,
    constants.SE_GREG_CAL
  );

  if (converted.flag !== constants.OK) {
    throw new Error(converted.error || "Swiss Ephemeris failed to convert UTC time to Julian date.");
  }

  return {
    jdEt: converted.data[0],
    jdUt: converted.data[1]
  };
};

const longitudeInArc = (longitude: number, start: number, end: number): boolean => {
  const normalizedLongitude = normalizeLongitude(longitude);
  const normalizedStart = normalizeLongitude(start);
  const normalizedEnd = normalizeLongitude(end);

  if (normalizedStart <= normalizedEnd) {
    return normalizedLongitude >= normalizedStart && normalizedLongitude < normalizedEnd;
  }

  return normalizedLongitude >= normalizedStart || normalizedLongitude < normalizedEnd;
};

const findHouse = (longitude: number, cusps: HouseCusp[]): number | undefined => {
  for (let index = 0; index < cusps.length; index += 1) {
    const current = cusps[index];
    const next = cusps[(index + 1) % cusps.length];

    if (!current || !next) {
      continue;
    }

    if (longitudeInArc(longitude, current.longitude, next.longitude)) {
      return current.house;
    }
  }

  return undefined;
};

const buildPoint = ({
  house,
  key,
  kind,
  label,
  latitude,
  longitude,
  speed
}: {
  house?: number;
  key: string;
  kind: ChartPoint["kind"];
  label: string;
  latitude?: number;
  longitude: number;
  speed?: number;
}): ChartPoint => {
  const normalizedLongitude = round(normalizeLongitude(longitude));

  return {
    key,
    label,
    kind,
    longitude: normalizedLongitude,
    latitude: latitude === undefined ? undefined : round(latitude),
    speed: speed === undefined ? undefined : round(speed),
    house,
    ...toSign(normalizedLongitude)
  };
};

const addCalculationWarning = (
  warnings: CalculationWarning[],
  code: string,
  message: string
): void => {
  if (!warnings.some((warning) => warning.code === code && warning.message === message)) {
    warnings.push({ code, message });
  }
};

const calculateBody = ({
  body,
  flags,
  houses,
  jdEt,
  warnings
}: {
  body: BodyDefinition;
  flags: number;
  houses: HouseCusp[];
  jdEt: number;
  warnings: CalculationWarning[];
}): ChartPoint | null => {
  const result: Calc = calc(jdEt, body.swephId, flags);

  if (result.error) {
    const fallback = result.flag >= 0 && result.data?.[0] !== undefined;
    addCalculationWarning(
      warnings,
      fallback ? "EPHEMERIS_FALLBACK" : "BODY_UNAVAILABLE",
      `${body.label}: ${result.error.trim()}`
    );

    if (!fallback) {
      return null;
    }
  }

  const longitude = result.data[0];
  const latitude = result.data[1];
  const speed = result.data[3];

  return buildPoint({
    key: body.key,
    label: body.label,
    kind: body.kind,
    longitude,
    latitude,
    speed,
    house: findHouse(longitude, houses)
  });
};

export const calculateNatalChart = (input: NatalCalculationInput): ChartResult => {
  const warnings: CalculationWarning[] = [];
  const settings = {
    zodiac: input.zodiac ?? "tropical",
    ayanamsa: input.zodiac === "sidereal" ? input.ayanamsa ?? "lahiri" : undefined,
    houseSystem: input.houseSystem ?? "placidus"
  };

  if (input.ephemerisPath) {
    set_ephe_path(input.ephemerisPath);
  } else {
    addCalculationWarning(
      warnings,
      "EPHEMERIS_PATH_NOT_SET",
      "SWISSEPH_EPHE_PATH is not set. Calculations may fall back to lower-precision Moshier ephemeris."
    );
  }

  if (settings.zodiac === "sidereal") {
    set_sid_mode(AYANAMSA_CODES[settings.ayanamsa ?? "lahiri"], 0, 0);
  }

  const utc = localBirthTimeToUtc(input);
  const { jdEt, jdUt } = buildJulianDate(utc);
  const bodyFlags =
    constants.SEFLG_SWIEPH | constants.SEFLG_SPEED | (settings.zodiac === "sidereal" ? constants.SEFLG_SIDEREAL : 0);
  const houseFlags = settings.zodiac === "sidereal" ? constants.SEFLG_SIDEREAL : 0;
  const houseSystemCode = HOUSE_SYSTEM_CODES[settings.houseSystem];
  const houseResult = houses_ex2(jdUt, houseFlags, input.latitude, input.longitude, houseSystemCode);

  if (houseResult.error) {
    addCalculationWarning(warnings, "HOUSE_CALCULATION_WARNING", houseResult.error.trim());
  }

  const houses: HouseCusp[] = houseResult.data.houses.map((longitude, index) => ({
    house: index + 1,
    longitude: round(normalizeLongitude(longitude)),
    ...toSign(longitude)
  }));

  const ascendant = houseResult.data.points[0];
  const midheaven = houseResult.data.points[1];
  const angles = [
    buildPoint({
      key: "asc",
      label: "Ascendant",
      kind: "angle",
      longitude: ascendant,
      house: 1
    }),
    buildPoint({
      key: "mc",
      label: "Midheaven",
      kind: "angle",
      longitude: midheaven,
      house: findHouse(midheaven, houses)
    })
  ];

  const bodies = BODY_DEFINITIONS.map((body) =>
    calculateBody({
      body,
      flags: bodyFlags,
      houses,
      jdEt,
      warnings
    })
  ).filter((point): point is ChartPoint => point !== null);

  const northNode = bodies.find((body) => body.key === "north-node");

  if (northNode) {
    const southNodeLongitude = normalizeLongitude(northNode.longitude + 180);
    bodies.push(
      buildPoint({
        key: "south-node",
        label: "South Node",
        kind: "node",
        longitude: southNodeLongitude,
        speed: northNode.speed,
        house: findHouse(southNodeLongitude, houses)
      })
    );
  }

  return {
    chartType: "natal",
    engine: {
      name: "swiss-ephemeris",
      version: "sweph-2.10.3-7",
      status: "swiss-ephemeris"
    },
    settings,
    subject: {
      utcDateTime: utc.toISO({ suppressMilliseconds: false }) ?? utc.toString(),
      latitude: input.latitude,
      longitude: input.longitude
    },
    angles,
    houses,
    bodies,
    aspects: calculateMajorAspects([...angles, ...bodies]),
    warnings
  };
};
