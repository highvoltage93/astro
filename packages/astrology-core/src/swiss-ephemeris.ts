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
import { calculateAspectsBetween, calculateMajorAspects } from "./aspects";
import { ZODIAC_SIGNS } from "./constants";
import type {
  Ayanamsa,
  CalculationWarning,
  ChartPoint,
  ChartResult,
  HouseCusp,
  HouseSystem,
  MoonPhase,
  NatalCalculationInput,
  TransitDayForecast,
  TransitCalculationInput,
  TransitPreviewInput,
  TransitPreviewResult
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

const shortestForwardArc = (start: number, end: number): number => normalizeLongitude(end - start);

const toSign = (longitude: number): { sign: string; signDegree: number } => {
  const normalized = normalizeLongitude(longitude);
  const signIndex = Math.floor(normalized / 30);
  const sign = ZODIAC_SIGNS[signIndex] ?? "aries";

  return {
    sign,
    signDegree: round(normalized - signIndex * 30, 4)
  };
};

const normalizeBirthTime = (birthTime: string): string =>
  /^\d{2}:\d{2}$/.test(birthTime) ? `${birthTime}:00` : birthTime;

const localBirthTimeToUtc = (input: NatalCalculationInput, birthTime: string): DateTime => {
  const local = DateTime.fromISO(`${input.birthDate}T${normalizeBirthTime(birthTime)}`, {
    zone: input.timezone
  });

  if (!local.isValid) {
    throw new Error(local.invalidExplanation ?? `Invalid birth date, time, or timezone: ${input.timezone}`);
  }

  return local.toUTC();
};

const parseTransitDateTime = (dateTime: string): DateTime => {
  const parsed = DateTime.fromISO(dateTime, {
    setZone: true
  });

  if (!parsed.isValid) {
    throw new Error(parsed.invalidExplanation ?? `Invalid transit date/time: ${dateTime}`);
  }

  return parsed.toUTC();
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

const getMoonPhaseName = (phaseAngle: number): MoonPhase["name"] => {
  if (phaseAngle < 22.5 || phaseAngle >= 337.5) {
    return "new";
  }

  if (phaseAngle < 67.5) {
    return "waxing-crescent";
  }

  if (phaseAngle < 112.5) {
    return "first-quarter";
  }

  if (phaseAngle < 157.5) {
    return "waxing-gibbous";
  }

  if (phaseAngle < 202.5) {
    return "full";
  }

  if (phaseAngle < 247.5) {
    return "waning-gibbous";
  }

  if (phaseAngle < 292.5) {
    return "last-quarter";
  }

  return "waning-crescent";
};

const calculateMoonPhase = (bodies: ChartPoint[]): MoonPhase | null => {
  const sun = bodies.find((body) => body.key === "sun");
  const moon = bodies.find((body) => body.key === "moon");

  if (!sun || !moon) {
    return null;
  }

  const phaseAngle = round(shortestForwardArc(sun.longitude, moon.longitude), 4);
  const illuminatedFraction = round((1 - Math.cos((phaseAngle * Math.PI) / 180)) / 2, 4);

  return {
    name: getMoonPhaseName(phaseAngle),
    phaseAngle,
    illuminatedFraction,
    waxing: phaseAngle < 180
  };
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
  const birthTimeKnown = input.birthTimeKnown ?? true;
  const calculationBirthTime = birthTimeKnown ? input.birthTime : "12:00:00";
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

  if (!birthTimeKnown) {
    addCalculationWarning(
      warnings,
      "UNKNOWN_BIRTH_TIME",
      "Birth time is unknown. Planet positions are calculated for 12:00 local time; Ascendant, Midheaven, houses, and house placements are omitted."
    );
  }

  const utc = localBirthTimeToUtc(input, calculationBirthTime);
  const { jdEt, jdUt } = buildJulianDate(utc);
  const bodyFlags =
    constants.SEFLG_SWIEPH | constants.SEFLG_SPEED | (settings.zodiac === "sidereal" ? constants.SEFLG_SIDEREAL : 0);
  let houses: HouseCusp[] = [];
  let angles: ChartPoint[] = [];

  if (birthTimeKnown) {
    const houseFlags = settings.zodiac === "sidereal" ? constants.SEFLG_SIDEREAL : 0;
    const houseSystemCode = HOUSE_SYSTEM_CODES[settings.houseSystem];
    const houseResult = houses_ex2(jdUt, houseFlags, input.latitude, input.longitude, houseSystemCode);

    if (houseResult.error) {
      addCalculationWarning(warnings, "HOUSE_CALCULATION_WARNING", houseResult.error.trim());
    }

    houses = houseResult.data.houses.map((longitude, index) => ({
      house: index + 1,
      longitude: round(normalizeLongitude(longitude)),
      ...toSign(longitude)
    }));

    const ascendant = houseResult.data.points[0];
    const midheaven = houseResult.data.points[1];
    const descendant = normalizeLongitude(ascendant + 180);
    const imumCoeli = normalizeLongitude(midheaven + 180);
    angles = [
      buildPoint({
        key: "asc",
        label: "Ascendant",
        kind: "angle",
        longitude: ascendant,
        house: 1
      }),
      buildPoint({
        key: "desc",
        label: "Descendant",
        kind: "angle",
        longitude: descendant,
        house: 7
      }),
      buildPoint({
        key: "ic",
        label: "Imum Coeli",
        kind: "angle",
        longitude: imumCoeli,
        house: 4
      }),
      buildPoint({
        key: "mc",
        label: "Midheaven",
        kind: "angle",
        longitude: midheaven,
        house: findHouse(midheaven, houses)
      })
    ];
  }

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

  const aspectAngles = angles.filter((angle) => angle.key === "asc" || angle.key === "mc");

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
      birthTimeKnown,
      latitude: input.latitude,
      longitude: input.longitude
    },
    angles,
    houses,
    bodies,
    aspects: calculateMajorAspects([...aspectAngles, ...bodies]),
    warnings
  };
};

export const calculateTransitChart = (input: TransitCalculationInput): ChartResult => {
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

  const utc = parseTransitDateTime(input.transitDateTime);
  const { jdEt } = buildJulianDate(utc);
  const bodyFlags =
    constants.SEFLG_SWIEPH | constants.SEFLG_SPEED | (settings.zodiac === "sidereal" ? constants.SEFLG_SIDEREAL : 0);
  const bodies = BODY_DEFINITIONS.map((body) =>
    calculateBody({
      body,
      flags: bodyFlags,
      houses: [],
      jdEt,
      warnings
    })
  ).filter((point): point is ChartPoint => point !== null);

  const northNode = bodies.find((body) => body.key === "north-node");

  if (northNode) {
    bodies.push(
      buildPoint({
        key: "south-node",
        label: "South Node",
        kind: "node",
        longitude: normalizeLongitude(northNode.longitude + 180),
        speed: northNode.speed
      })
    );
  }

  return {
    chartType: "transit",
    engine: {
      name: "swiss-ephemeris",
      version: "sweph-2.10.3-7",
      status: "swiss-ephemeris"
    },
    settings,
    subject: {
      utcDateTime: utc.toISO({ suppressMilliseconds: false }) ?? utc.toString(),
      birthTimeKnown: true,
      latitude: input.latitude,
      longitude: input.longitude
    },
    angles: [],
    houses: [],
    bodies,
    aspects: calculateMajorAspects(bodies),
    warnings
  };
};

export const calculateTransitPreview = (input: TransitPreviewInput): TransitPreviewResult => {
  const baseTransitDateTime = parseTransitDateTime(input.transitDateTime);
  const natal = calculateNatalChart({
    ...input.natal,
    ephemerisPath: input.ephemerisPath
  });
  const transit = calculateTransitChart({
    transitDateTime: input.transitDateTime,
    latitude: natal.subject.latitude,
    longitude: natal.subject.longitude,
    zodiac: input.zodiac ?? natal.settings.zodiac,
    ayanamsa: input.ayanamsa ?? natal.settings.ayanamsa,
    houseSystem: natal.settings.houseSystem,
    ephemerisPath: input.ephemerisPath
  });
  const natalPoints = [...natal.angles, ...natal.bodies];
  const transitToNatalAspects = calculateAspectsBetween(transit.bodies, natalPoints);
  const weekAhead: TransitDayForecast[] = Array.from({ length: 7 }, (_, dayIndex) => {
    const dayTransitDateTime = baseTransitDateTime.plus({ days: dayIndex });
    const dayTransit = calculateTransitChart({
      transitDateTime: dayTransitDateTime.toISO({ suppressMilliseconds: false }) ?? dayTransitDateTime.toString(),
      latitude: natal.subject.latitude,
      longitude: natal.subject.longitude,
      zodiac: input.zodiac ?? natal.settings.zodiac,
      ayanamsa: input.ayanamsa ?? natal.settings.ayanamsa,
      houseSystem: natal.settings.houseSystem,
      ephemerisPath: input.ephemerisPath
    });

    return {
      date: dayTransitDateTime.toISODate() ?? dayTransitDateTime.toFormat("yyyy-MM-dd"),
      transitDateTime: dayTransit.subject.utcDateTime,
      moon: dayTransit.bodies.find((body) => body.key === "moon") ?? null,
      moonPhase: calculateMoonPhase(dayTransit.bodies),
      strongestAspects: calculateAspectsBetween(dayTransit.bodies, natalPoints).slice(0, 5)
    };
  });

  return {
    chartType: "transit",
    generatedAt: new Date().toISOString(),
    natal,
    transit,
    moonPhase: calculateMoonPhase(transit.bodies),
    transitToNatalAspects,
    weekAhead,
    warnings: [...natal.warnings, ...transit.warnings]
  };
};
