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
import { DEFAULT_MAJOR_ASPECT_ORBS, MAJOR_ASPECT_ANGLES, ZODIAC_SIGNS } from "./constants";
import type {
  Ayanamsa,
  Aspect,
  AspectType,
  CalculationWarning,
  ChartPoint,
  ChartResult,
  EssentialDignity,
  EssentialDignityType,
  ExactTransitEvent,
  ForecastPreviewInput,
  ForecastPreviewResult,
  HouseConnection,
  HouseConnectionDetail,
  HouseConnectionRole,
  HouseConnectionTone,
  HouseCusp,
  HouseRuler,
  HouseSystem,
  MoonPhase,
  NatalCalculationInput,
  PlanetMotion,
  PlanetRulership,
  PointOrbSettings,
  RulerType,
  ReturnEvent,
  SecondaryProgressionAspect,
  SecondaryProgressionInput,
  SecondaryProgressionResult,
  SolarArcDirectionAspect,
  SolarArcDirectionResult,
  SyntheticSignature,
  SynastryPreviewInput,
  SynastryPreviewResult,
  TransitAspect,
  TransitAspectStrength,
  TransitDayForecast,
  TransitCalculationInput,
  TransitPreviewInput,
  TransitPreviewResult,
  ZodiacType
} from "./types";

type BodyDefinition = {
  key: string;
  label: string;
  swephId: number;
  kind: ChartPoint["kind"];
};

type SignRulerDefinition = {
  key: string;
  label: string;
  rulerType: RulerType;
};

type HouseSignSegment = {
  house: number;
  sign: string;
  coverageDegrees: number;
  source: "cusp" | "contained-sign";
};

type PlanetHouseResponsibility = {
  house: number;
  role: HouseConnectionRole;
  planetKey: string;
};

type FixedHouseRulerDefinition = {
  house: number;
  key: string;
  rulerType: RulerType;
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

const BODY_DEFINITION_BY_KEY = new Map(BODY_DEFINITIONS.map((body) => [body.key, body]));

const PLANET_DIRECT_RULERS: Record<string, string[]> = {
  sun: ["leo"],
  moon: ["cancer"],
  mercury: ["virgo", "gemini"],
  venus: ["taurus", "libra"],
  mars: ["scorpio"],
  jupiter: ["sagittarius"],
  saturn: ["capricorn"],
  uranus: ["aquarius"],
  neptune: ["pisces"],
  pluto: ["aries"]
};

const PLANET_RETROGRADE_RULERS: Record<string, string[]> = {
  mars: ["scorpio", "aries"],
  jupiter: ["pisces", "sagittarius"],
  saturn: ["capricorn", "aquarius"],
  uranus: ["aquarius", "capricorn"],
  neptune: ["pisces", "sagittarius"],
  pluto: ["aries", "scorpio"]
};

const FIXED_HOUSE_RULERS: FixedHouseRulerDefinition[] = [{ house: 8, key: "lilith", rulerType: "direct" }];

const SIGN_RULERS: Record<string, SignRulerDefinition[]> = Object.fromEntries(
  ZODIAC_SIGNS.map((sign) => {
    const directRulers = Object.entries(PLANET_DIRECT_RULERS)
      .filter(([, signs]) => signs.includes(sign))
      .map(([key]) => ({
        key,
        label: BODY_DEFINITION_BY_KEY.get(key)?.label ?? key,
        rulerType: "direct" as const
      }));
    const retrogradeRulers = Object.entries(PLANET_RETROGRADE_RULERS)
      .filter(([, signs]) => signs.includes(sign))
      .map(([key]) => ({
        key,
        label: BODY_DEFINITION_BY_KEY.get(key)?.label ?? key,
        rulerType: "retrograde" as const
      }));

    return [sign, [...directRulers, ...retrogradeRulers]];
  })
) as Record<string, SignRulerDefinition[]>;

const isRetrograde = (point: ChartPoint | undefined): boolean => (point?.speed ?? 0) < -0.0001;

const createSignRuler = (key: string, rulerType: RulerType): SignRulerDefinition => ({
  key,
  label: BODY_DEFINITION_BY_KEY.get(key)?.label ?? key,
  rulerType
});

const activeSignRulers = (sign: string, pointsByKey: Map<string, ChartPoint>): SignRulerDefinition[] => {
  const directRulers = Object.entries(PLANET_DIRECT_RULERS)
    .filter(([key, signs]) => {
      const hasRetrogradeModel = (PLANET_RETROGRADE_RULERS[key]?.length ?? 0) > 0;
      return signs.includes(sign) && (!isRetrograde(pointsByKey.get(key)) || !hasRetrogradeModel);
    })
    .map(([key]) => createSignRuler(key, "direct"));

  const retrogradeRulers = Object.entries(PLANET_RETROGRADE_RULERS)
    .filter(([key, signs]) => signs.includes(sign) && isRetrograde(pointsByKey.get(key)))
    .map(([key]) => createSignRuler(key, "retrograde"));

  return [...directRulers, ...retrogradeRulers];
};

const primaryActiveSignRuler = (sign: string, pointsByKey: Map<string, ChartPoint>): SignRulerDefinition | undefined =>
  activeSignRulers(sign, pointsByKey)[0] ?? SIGN_RULERS[sign]?.[0];

const PLANET_EXALTATIONS: Record<string, string> = {
  sun: "aries",
  moon: "taurus",
  mercury: "virgo",
  venus: "pisces",
  mars: "capricorn",
  jupiter: "cancer",
  saturn: "libra"
};

const OPPOSITE_SIGNS: Record<string, string> = {
  aries: "libra",
  taurus: "scorpio",
  gemini: "sagittarius",
  cancer: "capricorn",
  leo: "aquarius",
  virgo: "pisces",
  libra: "aries",
  scorpio: "taurus",
  sagittarius: "gemini",
  capricorn: "cancer",
  aquarius: "leo",
  pisces: "virgo"
};

const SIGN_ELEMENTS: Record<string, string> = {
  aries: "fire",
  taurus: "earth",
  gemini: "air",
  cancer: "water",
  leo: "fire",
  virgo: "earth",
  libra: "air",
  scorpio: "water",
  sagittarius: "fire",
  capricorn: "earth",
  aquarius: "air",
  pisces: "water"
};

const SIGN_CROSSES: Record<string, string> = {
  aries: "cardinal",
  taurus: "fixed",
  gemini: "mutable",
  cancer: "cardinal",
  leo: "fixed",
  virgo: "mutable",
  libra: "cardinal",
  scorpio: "fixed",
  sagittarius: "mutable",
  capricorn: "cardinal",
  aquarius: "fixed",
  pisces: "mutable"
};

const SIGN_POLARITIES: Record<string, string> = {
  aries: "masculine",
  taurus: "feminine",
  gemini: "masculine",
  cancer: "feminine",
  leo: "masculine",
  virgo: "feminine",
  libra: "masculine",
  scorpio: "feminine",
  sagittarius: "masculine",
  capricorn: "feminine",
  aquarius: "masculine",
  pisces: "feminine"
};

const SYNTHETIC_POINT_WEIGHTS: Record<string, number> = {
  sun: 2,
  moon: 2,
  mercury: 1.5,
  venus: 1.5,
  mars: 1.5,
  asc: 1.5,
  jupiter: 1,
  saturn: 1,
  uranus: 1,
  neptune: 1,
  pluto: 1,
  "north-node": 0.5,
  "south-node": 0.5
};

const ASPECT_SCORE_WEIGHTS: Record<AspectType, number> = {
  conjunction: 1,
  opposition: 0.95,
  square: 0.9,
  trine: 0.75,
  sextile: 0.65
};

const TRANSIT_BODY_SCORE_WEIGHTS: Record<string, number> = {
  sun: 0.72,
  moon: 0.55,
  mercury: 0.58,
  venus: 0.62,
  mars: 0.7,
  jupiter: 0.82,
  saturn: 0.92,
  uranus: 0.86,
  neptune: 0.82,
  pluto: 0.9,
  "north-node": 0.68,
  "south-node": 0.68,
  chiron: 0.72,
  lilith: 0.55
};

const FORECAST_DEFAULT_DAYS = 90;
const FORECAST_MAX_DAYS = 366;
const FORECAST_EXACT_TRANSIT_BODY_KEYS = [...BODY_DEFINITIONS.map((body) => body.key), "south-node"];
const EXACT_CROSSING_EPSILON = 0.00001;
const CONTAINED_HOUSE_SIGN_MIN_DEGREES = 12.5;
const SECONDARY_PROGRESSION_YEAR_DAYS = 365.2425;
const SECONDARY_PROGRESSION_ASPECT_ORB = 1;
const SECONDARY_PROGRESSION_MAX_EXACT_YEARS = 120;
const SECONDARY_PROGRESSION_ASPECT_ORBS: Record<AspectType, number> = {
  conjunction: SECONDARY_PROGRESSION_ASPECT_ORB,
  opposition: SECONDARY_PROGRESSION_ASPECT_ORB,
  trine: SECONDARY_PROGRESSION_ASPECT_ORB,
  square: SECONDARY_PROGRESSION_ASPECT_ORB,
  sextile: SECONDARY_PROGRESSION_ASPECT_ORB
};
const SOLAR_ARC_ASPECT_ORB = 1;
const SOLAR_ARC_ASPECT_ORBS: Record<AspectType, number> = {
  conjunction: SOLAR_ARC_ASPECT_ORB,
  opposition: SOLAR_ARC_ASPECT_ORB,
  trine: SOLAR_ARC_ASPECT_ORB,
  square: SOLAR_ARC_ASPECT_ORB,
  sextile: SOLAR_ARC_ASPECT_ORB
};

const normalizeLongitude = (longitude: number): number => ((longitude % 360) + 360) % 360;

const round = (value: number, digits = 6): number => Number(value.toFixed(digits));

const cleanPointOrbs = (pointOrbs: PointOrbSettings | undefined): PointOrbSettings | undefined => {
  if (!pointOrbs) {
    return undefined;
  }

  const cleaned: PointOrbSettings = {};

  for (const [key, value] of Object.entries(pointOrbs)) {
    if (value !== undefined && Number.isFinite(value) && value >= 0) {
      cleaned[key] = round(value, 2);
    }
  }

  return cleaned;
};

const buildBodyFlags = (settings: { zodiac: ZodiacType }): number =>
  constants.SEFLG_SWIEPH | constants.SEFLG_SPEED | (settings.zodiac === "sidereal" ? constants.SEFLG_SIDEREAL : 0);

const setEphemerisContext = ({
  ephemerisPath,
  settings,
  warnings
}: {
  ephemerisPath?: string;
  settings: { zodiac: ZodiacType; ayanamsa?: Ayanamsa };
  warnings: CalculationWarning[];
}): void => {
  if (ephemerisPath) {
    set_ephe_path(ephemerisPath);
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
};

const shortestForwardArc = (start: number, end: number): number => normalizeLongitude(end - start);

const signedAngularDistance = (from: number, to: number): number => {
  const distance = normalizeLongitude(to - from);

  return distance > 180 ? distance - 360 : distance;
};

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

const calculateHouseSignSegments = (houses: HouseCusp[]): HouseSignSegment[] => {
  const segments: HouseSignSegment[] = [];

  for (let index = 0; index < houses.length; index += 1) {
    const house = houses[index];
    const next = houses[(index + 1) % houses.length];

    if (!house || !next) {
      continue;
    }

    const houseLength = shortestForwardArc(house.longitude, next.longitude);

    for (const sign of ZODIAC_SIGNS) {
      const signIndex = ZODIAC_SIGNS.indexOf(sign);
      const signStart = signIndex * 30;
      const signEnd = signStart + 30;
      const isCuspSign = sign === house.sign;
      const startsAfterCusp = shortestForwardArc(house.longitude, signStart);
      const endsAfterCusp = shortestForwardArc(house.longitude, signEnd);
      const segmentStart = isCuspSign ? 0 : startsAfterCusp;
      const segmentEnd = Math.min(houseLength, endsAfterCusp);
      const coverageDegrees = round(segmentEnd - segmentStart, 4);

      if (coverageDegrees <= 0) {
        continue;
      }

      if (!isCuspSign && coverageDegrees <= CONTAINED_HOUSE_SIGN_MIN_DEGREES) {
        continue;
      }

      segments.push({
        house: house.house,
        sign,
        coverageDegrees,
        source: isCuspSign ? "cusp" : "contained-sign"
      });
    }
  }

  return segments.sort((a, b) => a.house - b.house || (a.source === b.source ? 0 : a.source === "cusp" ? -1 : 1));
};

const MALEFIC_HOUSES = new Set([6, 8, 12]);
const HOUSE_CONNECTION_EXCLUDED_POINT_KEYS = new Set(["chiron"]);

const hasMaleficHouse = (...houses: number[]): boolean => houses.some((house) => MALEFIC_HOUSES.has(house));

const aspectTone = (aspectType: AspectType): HouseConnectionTone => {
  if (aspectType === "trine" || aspectType === "sextile") {
    return "harmonious";
  }

  if (aspectType === "square" || aspectType === "opposition") {
    return "tense";
  }

  return "neutral";
};

const conjunctionToneForHousePair = (fromHouse: number, toHouse: number): HouseConnectionTone =>
  hasMaleficHouse(fromHouse, toHouse) ? "tense" : "harmonious";

const responsibilityToneForHousePair = (fromHouse: number, toHouse: number): HouseConnectionTone =>
  hasMaleficHouse(fromHouse, toHouse) ? "tense" : "harmonious";

const aspectToneForHousePair = (aspectType: AspectType, fromHouse: number, toHouse: number): HouseConnectionTone =>
  aspectType === "conjunction" ? conjunctionToneForHousePair(fromHouse, toHouse) : aspectTone(aspectType);

const motionForPoint = (point: ChartPoint | undefined): PlanetMotion | undefined => {
  if (!point || point.speed === undefined) {
    return undefined;
  }

  if (Math.abs(point.speed) < 0.0001) {
    return "stationary";
  }

  return point.speed < 0 ? "retrograde" : "direct";
};

const calculateHouseRulers = (houses: HouseCusp[], bodies: ChartPoint[]): HouseRuler[] => {
  if (houses.length === 0) {
    return [];
  }

  const pointsByKey = new Map(bodies.map((body) => [body.key, body]));
  const signSegments = calculateHouseSignSegments(houses);
  const houseByNumber = new Map(houses.map((house) => [house.house, house]));

  const signRulers = signSegments.flatMap((segment) =>
    activeSignRulers(segment.sign, pointsByKey).map((ruler) => {
      const rulerPoint = pointsByKey.get(ruler.key);

      return {
        house: segment.house,
        sign: segment.sign,
        signCoverageDegrees: segment.coverageDegrees,
        rulerSource: segment.source,
        rulerKey: ruler.key,
        rulerLabel: ruler.label,
        rulerType: ruler.rulerType,
        rulerHouse: rulerPoint?.house,
        motion: motionForPoint(rulerPoint)
      };
    })
  );

  const fixedHouseRulers = FIXED_HOUSE_RULERS.map((ruler) => {
    const house = houseByNumber.get(ruler.house);
    const rulerPoint = pointsByKey.get(ruler.key);

    return {
      house: ruler.house,
      sign: house?.sign ?? "fixed-house",
      rulerSource: "fixed-house" as const,
      rulerKey: ruler.key,
      rulerLabel: BODY_DEFINITION_BY_KEY.get(ruler.key)?.label ?? ruler.key,
      rulerType: ruler.rulerType,
      rulerHouse: rulerPoint?.house,
      motion: motionForPoint(rulerPoint)
    };
  });

  return [...signRulers, ...fixedHouseRulers].sort(
    (a, b) =>
      a.house - b.house ||
      (a.rulerSource === b.rulerSource ? 0 : a.rulerSource === "fixed-house" ? 1 : -1) ||
      a.rulerLabel.localeCompare(b.rulerLabel)
  );
};

const calculatePlanetRulerships = (houseRulers: HouseRuler[], bodies: ChartPoint[]): PlanetRulership[] => {
  const rulershipsByPlanet = new Map<string, PlanetRulership>();

  const ensureRulership = (pointKey: string, pointLabel: string): PlanetRulership => {
    const existing = rulershipsByPlanet.get(pointKey);

    if (existing) {
      return existing;
    }

    const created = {
      pointKey,
      pointLabel,
      houses: [],
      directHouses: [],
      retrogradeHouses: []
    };

    rulershipsByPlanet.set(pointKey, created);
    return created;
  };

  for (const body of bodies) {
    ensureRulership(body.key, body.label);
  }

  for (const houseRuler of houseRulers) {
    const rulership = ensureRulership(houseRuler.rulerKey, houseRuler.rulerLabel);

    rulership.houses.push(houseRuler.house);

    if (houseRuler.rulerType === "direct") {
      rulership.directHouses.push(houseRuler.house);
    } else {
      rulership.retrogradeHouses.push(houseRuler.house);
    }
  }

  return [...rulershipsByPlanet.values()]
    .map((rulership) => ({
      ...rulership,
      houses: [...new Set(rulership.houses)].sort((a, b) => a - b),
      directHouses: [...new Set(rulership.directHouses)].sort((a, b) => a - b),
      retrogradeHouses: [...new Set(rulership.retrogradeHouses)].sort((a, b) => a - b)
    }))
    .sort((a, b) => a.pointLabel.localeCompare(b.pointLabel));
};

const addScore = (scores: Map<string, number>, key: string | undefined, score: number): void => {
  if (!key) {
    return;
  }

  scores.set(key, round((scores.get(key) ?? 0) + score, 3));
};

const sortedScores = (scores: Map<string, number>, order: string[]): Array<{ key: string; score: number }> =>
  order
    .map((key) => ({
      key,
      score: round(scores.get(key) ?? 0, 3)
    }))
    .sort((a, b) => b.score - a.score || order.indexOf(a.key) - order.indexOf(b.key));

const calculateSyntheticSignature = (points: ChartPoint[]): SyntheticSignature => {
  const signScores = new Map(ZODIAC_SIGNS.map((sign) => [sign, 0]));
  const elementOrder = ["fire", "earth", "air", "water"];
  const crossOrder = ["cardinal", "fixed", "mutable"];
  const polarityOrder = ["masculine", "feminine"];
  const elementScores = new Map(elementOrder.map((element) => [element, 0]));
  const crossScores = new Map(crossOrder.map((cross) => [cross, 0]));
  const polarityScores = new Map(polarityOrder.map((polarity) => [polarity, 0]));
  let total = 0;

  for (const point of points) {
    const weight = SYNTHETIC_POINT_WEIGHTS[point.key];

    if (!weight) {
      continue;
    }

    addScore(signScores, point.sign, weight);
    addScore(elementScores, SIGN_ELEMENTS[point.sign], weight);
    addScore(crossScores, SIGN_CROSSES[point.sign], weight);
    addScore(polarityScores, SIGN_POLARITIES[point.sign], weight);
    total = round(total + weight, 3);
  }

  const signs = sortedScores(signScores, [...ZODIAC_SIGNS]);
  const elements = sortedScores(elementScores, elementOrder);
  const crosses = sortedScores(crossScores, crossOrder);
  const polarities = sortedScores(polarityScores, polarityOrder);

  return {
    sign: signs[0] ?? { key: "aries", score: 0 },
    element: elements[0] ?? { key: "fire", score: 0 },
    cross: crosses[0] ?? { key: "cardinal", score: 0 },
    polarity: polarities[0] ?? { key: "masculine", score: 0 },
    scores: {
      signs,
      elements,
      crosses,
      polarities,
      total
    }
  };
};

const calculateHouseConnections = (houseRulers: HouseRuler[], bodies: ChartPoint[], aspects: Aspect[]): HouseConnection[] => {
  if (houseRulers.length === 0) {
    return [];
  }

  const responsibilitiesByPlanet = new Map<string, PlanetHouseResponsibility[]>();
  const connectionMap = new Map<string, HouseConnection>();

  const addResponsibility = (planetKey: string, house: number | undefined, role: HouseConnectionRole): void => {
    if (!house) {
      return;
    }

    const responsibilities = responsibilitiesByPlanet.get(planetKey) ?? [];
    const exists = responsibilities.some((responsibility) => responsibility.house === house && responsibility.role === role);

    if (!exists) {
      responsibilities.push({ house, role, planetKey });
      responsibilitiesByPlanet.set(planetKey, responsibilities);
    }
  };

  const addConnection = (fromHouse: number, toHouse: number | undefined, detail: HouseConnectionDetail): void => {
    if (!toHouse) {
      return;
    }

    const [orderedFromHouse, orderedToHouse] =
      fromHouse < toHouse ? [fromHouse, toHouse] : [toHouse, fromHouse];
    const key = `${orderedFromHouse}-${orderedToHouse}`;
    const connection =
      connectionMap.get(key) ??
      ({
        fromHouse: orderedFromHouse,
        toHouse: orderedToHouse,
        harmonious: 0,
        tense: 0,
        neutral: 0,
        total: 0,
        details: []
      } satisfies HouseConnection);

    connection[detail.tone] += 1;
    connection.total += 1;
    connection.details.push(detail);
    connectionMap.set(key, connection);
  };

  for (const body of bodies) {
    if (HOUSE_CONNECTION_EXCLUDED_POINT_KEYS.has(body.key)) {
      continue;
    }

    addResponsibility(body.key, body.house, "placement");
  }

  for (const houseRuler of houseRulers) {
    if (HOUSE_CONNECTION_EXCLUDED_POINT_KEYS.has(houseRuler.rulerKey)) {
      continue;
    }

    addResponsibility(houseRuler.rulerKey, houseRuler.house, "ruler");
  }

  for (const [planetKey, responsibilities] of responsibilitiesByPlanet.entries()) {
    for (let indexA = 0; indexA < responsibilities.length; indexA += 1) {
      const responsibilityA = responsibilities[indexA];

      if (!responsibilityA) {
        continue;
      }

      for (let indexB = indexA + 1; indexB < responsibilities.length; indexB += 1) {
        const responsibilityB = responsibilities[indexB];

        if (!responsibilityB) {
          continue;
        }

        addConnection(responsibilityA.house, responsibilityB.house, {
          source:
            responsibilityA.role === "placement" || responsibilityB.role === "placement"
              ? "ruler-position"
              : "rulership",
          tone: responsibilityToneForHousePair(responsibilityA.house, responsibilityB.house),
          fromHouse: responsibilityA.house,
          toHouse: responsibilityB.house,
          planetA: planetKey,
          fromRole: responsibilityA.role,
          toRole: responsibilityB.role
        });
      }
    }
  }

  for (const aspect of aspects) {
    const responsibilitiesA = responsibilitiesByPlanet.get(aspect.bodyA) ?? [];
    const responsibilitiesB = responsibilitiesByPlanet.get(aspect.bodyB) ?? [];

    if (responsibilitiesA.length === 0 || responsibilitiesB.length === 0) {
      continue;
    }

    const aspectPairs = new Set<string>();

    for (const responsibilityA of responsibilitiesA) {
      if (!responsibilityA) {
        continue;
      }

      for (const responsibilityB of responsibilitiesB) {
        if (!responsibilityB) {
          continue;
        }

        const [fromHouse, toHouse] =
          responsibilityA.house < responsibilityB.house
            ? [responsibilityA.house, responsibilityB.house]
            : [responsibilityB.house, responsibilityA.house];
        const aspectPairKey = `${fromHouse}-${toHouse}`;

        if (aspectPairs.has(aspectPairKey)) {
          continue;
        }

        aspectPairs.add(aspectPairKey);
        addConnection(fromHouse, toHouse, {
          source: "aspect",
          tone: aspectToneForHousePair(aspect.type, fromHouse, toHouse),
          fromHouse: responsibilityA.house,
          toHouse: responsibilityB.house,
          planetA: responsibilityA.planetKey,
          planetB: responsibilityB.planetKey,
          fromRole: responsibilityA.role,
          toRole: responsibilityB.role,
          aspectType: aspect.type,
          aspectAngle: aspect.exactAngle
        });
      }
    }
  }

  return [...connectionMap.values()].sort((a, b) => b.total - a.total || a.fromHouse - b.fromHouse || a.toHouse - b.toHouse);
};

const dignityScore = (dignity: EssentialDignityType): number => {
  switch (dignity) {
    case "domicile":
      return 5;
    case "exaltation":
      return 4;
    case "detriment":
      return -5;
    case "fall":
      return -4;
    default:
      return 0;
  }
};

const dignityForPoint = (point: ChartPoint): EssentialDignityType => {
  const directDomiciles = PLANET_DIRECT_RULERS[point.key] ?? [];
  const retrogradeDomiciles = PLANET_RETROGRADE_RULERS[point.key] ?? [];
  const domiciles = point.speed !== undefined && point.speed < -0.0001 && retrogradeDomiciles.length > 0
    ? retrogradeDomiciles
    : directDomiciles;
  const exaltation = PLANET_EXALTATIONS[point.key];

  if (domiciles.includes(point.sign)) {
    return "domicile";
  }

  if (exaltation === point.sign) {
    return "exaltation";
  }

  if (domiciles.some((sign) => OPPOSITE_SIGNS[sign] === point.sign)) {
    return "detriment";
  }

  if (exaltation && OPPOSITE_SIGNS[exaltation] === point.sign) {
    return "fall";
  }

  return "peregrine";
};

const buildDispositorChain = (point: ChartPoint, pointsByKey: Map<string, ChartPoint>): { chain: string[]; cycle: boolean } => {
  const chain = [point.key];
  const visited = new Set([point.key]);
  let current = point;

  for (let index = 0; index < 12; index += 1) {
    const dispositorKey = primaryActiveSignRuler(current.sign, pointsByKey)?.key;

    if (!dispositorKey) {
      return { chain, cycle: false };
    }

    chain.push(dispositorKey);

    if (visited.has(dispositorKey)) {
      return { chain, cycle: true };
    }

    visited.add(dispositorKey);
    const next = pointsByKey.get(dispositorKey);

    if (!next) {
      return { chain, cycle: false };
    }

    current = next;
  }

  return { chain, cycle: false };
};

const calculateEssentialDignities = (bodies: ChartPoint[]): EssentialDignity[] => {
  const pointsByKey = new Map(bodies.map((body) => [body.key, body]));

  return bodies.map((body) => {
    const dignity = dignityForPoint(body);
    const dispositor = primaryActiveSignRuler(body.sign, pointsByKey);
    const chain = buildDispositorChain(body, pointsByKey);

    return {
      pointKey: body.key,
      pointLabel: body.label,
      sign: body.sign,
      dignity,
      score: dignityScore(dignity),
      dispositorKey: dispositor?.key,
      dispositorLabel: dispositor?.label,
      chain: chain.chain,
      cycle: chain.cycle
    };
  });
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

const formatEphemerisBodyWarning = (bodyLabel: string, rawError: string): string => {
  const trimmedError = rawError.trim();

  if (/file .*\.se1 not found/i.test(trimmedError) || /not found in PATH/i.test(trimmedError)) {
    return `${bodyLabel}: Swiss Ephemeris data files are missing. Run "pnpm ephemeris:download" before starting the API, or mount the ephemeris directory in Docker.`;
  }

  return `${bodyLabel}: ${trimmedError}`;
};

const pointLabelForKey = (pointKey: string): string => {
  if (pointKey === "south-node") {
    return "South Node";
  }

  return BODY_DEFINITION_BY_KEY.get(pointKey)?.label ?? pointKey;
};

const calculatePointPositionAt = ({
  flags,
  pointKey,
  utc,
  warnings
}: {
  flags: number;
  pointKey: string;
  utc: DateTime;
  warnings: CalculationWarning[];
}): { longitude: number; speed?: number } | null => {
  const sourceKey = pointKey === "south-node" ? "north-node" : pointKey;
  const body = BODY_DEFINITION_BY_KEY.get(sourceKey);

  if (!body) {
    return null;
  }

  const { jdEt } = buildJulianDate(utc);
  const result: Calc = calc(jdEt, body.swephId, flags);

  if (result.error) {
    const fallback = result.flag >= 0 && result.data?.[0] !== undefined;
    addCalculationWarning(
      warnings,
      fallback ? "EPHEMERIS_FALLBACK" : "BODY_UNAVAILABLE",
      formatEphemerisBodyWarning(pointLabelForKey(pointKey), result.error)
    );

    if (!fallback) {
      return null;
    }
  }

  const longitude = pointKey === "south-node" ? normalizeLongitude(result.data[0] + 180) : result.data[0];

  return {
    longitude: normalizeLongitude(longitude),
    speed: result.data[3]
  };
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

const transitAspectTargetDelta = (aspect: Aspect, transitPoint: ChartPoint, natalPoint: ChartPoint): number => {
  const targetLongitudes =
    aspect.exactAngle === 0 || aspect.exactAngle === 180
      ? [normalizeLongitude(natalPoint.longitude + aspect.exactAngle)]
      : [
          normalizeLongitude(natalPoint.longitude + aspect.exactAngle),
          normalizeLongitude(natalPoint.longitude - aspect.exactAngle)
        ];

  return targetLongitudes
    .map((targetLongitude) => signedAngularDistance(transitPoint.longitude, targetLongitude))
    .sort((a, b) => Math.abs(a) - Math.abs(b))[0] ?? 0;
};

const aspectStrength = (score: number): TransitAspectStrength => {
  if (score >= 75) {
    return "high";
  }

  if (score >= 50) {
    return "medium";
  }

  return "low";
};

const allowedOrbForExactTransitPair = (
  type: AspectType,
  transitPointKey: string,
  natalPointKey: string,
  pointOrbs: PointOrbSettings = {}
): number => {
  const fallbackOrb = DEFAULT_MAJOR_ASPECT_ORBS[type];
  const transitOrb = pointOrbs[transitPointKey] ?? fallbackOrb;
  const natalOrb = pointOrbs[natalPointKey] ?? fallbackOrb;

  return Math.min(fallbackOrb, transitOrb, natalOrb);
};

const enrichTransitAspect = ({
  aspect,
  baseDateTime,
  natalPointsByKey,
  transitPointsByKey
}: {
  aspect: Aspect;
  baseDateTime: DateTime;
  natalPointsByKey: Map<string, ChartPoint>;
  transitPointsByKey: Map<string, ChartPoint>;
}): TransitAspect => {
  const transitPoint = transitPointsByKey.get(aspect.bodyA);
  const natalPoint = natalPointsByKey.get(aspect.bodyB);
  const allowedOrb = DEFAULT_MAJOR_ASPECT_ORBS[aspect.type] ?? 8;
  const closeness = Math.max(0, 1 - aspect.orb / allowedOrb);
  const aspectWeight = ASPECT_SCORE_WEIGHTS[aspect.type] ?? 0.65;
  const bodyWeight = transitPoint ? TRANSIT_BODY_SCORE_WEIGHTS[transitPoint.key] ?? 0.55 : 0.55;
  const score = round((closeness * 0.62 + aspectWeight * 0.23 + bodyWeight * 0.15) * 100, 1);

  if (!transitPoint || !natalPoint || transitPoint.speed === undefined || Math.abs(transitPoint.speed) < 0.0001) {
    return {
      ...aspect,
      phase: "stationary",
      exactAt: null,
      daysToExact: null,
      activeFrom: null,
      activeUntil: null,
      durationDays: null,
      score,
      strength: aspectStrength(score)
    };
  }

  const deltaToExact = transitAspectTargetDelta(aspect, transitPoint, natalPoint);
  const daysToExact = deltaToExact / transitPoint.speed;
  const boundaryDays = [
    (deltaToExact - allowedOrb) / transitPoint.speed,
    (deltaToExact + allowedOrb) / transitPoint.speed
  ].sort((a, b) => a - b);
  const activeFromDays = boundaryDays[0];
  const activeUntilDays = boundaryDays[1];
  const activeWindowIsReasonable =
    activeFromDays !== undefined &&
    activeUntilDays !== undefined &&
    Math.abs(activeFromDays) <= 1460 &&
    Math.abs(activeUntilDays) <= 1460;
  const phase = Math.abs(daysToExact) < 0.02 ? "exact" : daysToExact > 0 ? "applying" : "separating";
  const exactAt =
    Math.abs(daysToExact) <= 730
      ? baseDateTime.plus({ days: daysToExact }).toISO({ suppressMilliseconds: false })
      : null;

  return {
    ...aspect,
    phase,
    exactAt,
    daysToExact: round(daysToExact, 3),
    activeFrom: activeWindowIsReasonable
      ? baseDateTime.plus({ days: activeFromDays }).toISO({ suppressMilliseconds: false })
      : null,
    activeUntil: activeWindowIsReasonable
      ? baseDateTime.plus({ days: activeUntilDays }).toISO({ suppressMilliseconds: false })
      : null,
    durationDays: activeWindowIsReasonable ? round(activeUntilDays - activeFromDays, 2) : null,
    score,
    strength: aspectStrength(score)
  };
};

const enrichTransitAspects = ({
  aspects,
  baseDateTime,
  natalPoints,
  transitPoints
}: {
  aspects: Aspect[];
  baseDateTime: DateTime;
  natalPoints: ChartPoint[];
  transitPoints: ChartPoint[];
}): TransitAspect[] => {
  const natalPointsByKey = new Map(natalPoints.map((point) => [point.key, point]));
  const transitPointsByKey = new Map(transitPoints.map((point) => [point.key, point]));

  return aspects
    .map((aspect) =>
      enrichTransitAspect({
        aspect,
        baseDateTime,
        natalPointsByKey,
        transitPointsByKey
      })
    )
    .sort((a, b) => b.score - a.score || a.orb - b.orb);
};

const assignNatalHousesToTransitPoints = (points: ChartPoint[], natalHouses: HouseCusp[]): ChartPoint[] => {
  if (natalHouses.length === 0) {
    return [];
  }

  return points.map((point) => ({
    ...point,
    house: findHouse(point.longitude, natalHouses)
  }));
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
      formatEphemerisBodyWarning(body.label, result.error)
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
    houseSystem: input.houseSystem ?? "koch",
    pointOrbs: cleanPointOrbs(input.pointOrbs)
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
  const aspects = calculateMajorAspects([...aspectAngles, ...bodies], undefined, settings.pointOrbs);
  const houseRulers = calculateHouseRulers(houses, bodies);
  const planetRulerships = calculatePlanetRulerships(houseRulers, bodies);
  const houseConnections = calculateHouseConnections(houseRulers, bodies, aspects);
  const essentialDignities = calculateEssentialDignities(bodies);
  const syntheticSignature = calculateSyntheticSignature([...angles, ...bodies]);

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
    houseConnections,
    houseRulers,
    planetRulerships,
    syntheticSignature,
    essentialDignities,
    bodies,
    aspects,
    warnings
  };
};

export const calculateTransitChart = (input: TransitCalculationInput): ChartResult => {
  const warnings: CalculationWarning[] = [];
  const settings = {
    zodiac: input.zodiac ?? "tropical",
    ayanamsa: input.zodiac === "sidereal" ? input.ayanamsa ?? "lahiri" : undefined,
    houseSystem: input.houseSystem ?? "koch",
    pointOrbs: cleanPointOrbs(input.pointOrbs)
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
    houseConnections: [],
    houseRulers: [],
    planetRulerships: [],
    syntheticSignature: calculateSyntheticSignature(bodies),
    essentialDignities: calculateEssentialDignities(bodies),
    bodies,
    aspects: calculateMajorAspects(bodies, undefined, settings.pointOrbs),
    warnings
  };
};

export const calculateTransitPreview = (input: TransitPreviewInput): TransitPreviewResult => {
  const baseTransitDateTime = parseTransitDateTime(input.transitDateTime);
  const natal = calculateNatalChart({
    ...input.natal,
    ephemerisPath: input.ephemerisPath
  });
  const previewPointOrbs = cleanPointOrbs(input.pointOrbs) ?? natal.settings.pointOrbs;
  const transit = calculateTransitChart({
    transitDateTime: input.transitDateTime,
    latitude: natal.subject.latitude,
    longitude: natal.subject.longitude,
    zodiac: input.zodiac ?? natal.settings.zodiac,
    ayanamsa: input.ayanamsa ?? natal.settings.ayanamsa,
    houseSystem: natal.settings.houseSystem,
    pointOrbs: previewPointOrbs,
    ephemerisPath: input.ephemerisPath
  });
  const natalPoints = [...natal.angles, ...natal.bodies];
  const transitHousePlacements = assignNatalHousesToTransitPoints(transit.bodies, natal.houses);
  const transitToNatalAspects = enrichTransitAspects({
    aspects: calculateAspectsBetween(transit.bodies, natalPoints, undefined, previewPointOrbs),
    baseDateTime: baseTransitDateTime,
    natalPoints,
    transitPoints: transit.bodies
  });
  const weekAhead: TransitDayForecast[] = Array.from({ length: 7 }, (_, dayIndex) => {
    const dayTransitDateTime = baseTransitDateTime.plus({ days: dayIndex });
    const dayTransit = calculateTransitChart({
      transitDateTime: dayTransitDateTime.toISO({ suppressMilliseconds: false }) ?? dayTransitDateTime.toString(),
      latitude: natal.subject.latitude,
      longitude: natal.subject.longitude,
      zodiac: input.zodiac ?? natal.settings.zodiac,
      ayanamsa: input.ayanamsa ?? natal.settings.ayanamsa,
      houseSystem: natal.settings.houseSystem,
      pointOrbs: previewPointOrbs,
      ephemerisPath: input.ephemerisPath
    });
    const dayTransitHousePlacements = assignNatalHousesToTransitPoints(dayTransit.bodies, natal.houses);

    return {
      date: dayTransitDateTime.toISODate() ?? dayTransitDateTime.toFormat("yyyy-MM-dd"),
      transitDateTime: dayTransit.subject.utcDateTime,
      moon: dayTransitHousePlacements.find((body) => body.key === "moon") ?? dayTransit.bodies.find((body) => body.key === "moon") ?? null,
      moonPhase: calculateMoonPhase(dayTransit.bodies),
      strongestAspects: enrichTransitAspects({
        aspects: calculateAspectsBetween(dayTransit.bodies, natalPoints, undefined, previewPointOrbs),
        baseDateTime: dayTransitDateTime,
        natalPoints,
        transitPoints: dayTransit.bodies
      }).slice(0, 5)
    };
  });

  return {
    chartType: "transit",
    generatedAt: new Date().toISOString(),
    natal,
    transit,
    moonPhase: calculateMoonPhase(transit.bodies),
    transitHousePlacements,
    transitToNatalAspects,
    weekAhead,
    warnings: [...natal.warnings, ...transit.warnings]
  };
};

type LongitudeSample = {
  utc: DateTime;
  longitude: number;
};

const toUtcIso = (utc: DateTime): string => utc.toISO({ suppressMilliseconds: false }) ?? utc.toString();

const clampForecastDays = (days: number | undefined): number => {
  const normalizedDays = Number.isFinite(days) ? Math.trunc(days ?? FORECAST_DEFAULT_DAYS) : FORECAST_DEFAULT_DAYS;

  return Math.max(1, Math.min(FORECAST_MAX_DAYS, normalizedDays));
};

const dateInYearForBirthDate = (birthDate: string, targetYear: number): DateTime => {
  const parsedBirthDate = DateTime.fromISO(birthDate, { zone: "utc" });
  const sourceDate = parsedBirthDate.isValid ? parsedBirthDate : DateTime.utc(targetYear, 1, 1);
  const monthStart = DateTime.utc(targetYear, sourceDate.month, 1).startOf("day");
  const day = Math.min(sourceDate.day, monthStart.daysInMonth ?? sourceDate.day);

  return monthStart.set({ day, hour: 12, minute: 0, second: 0, millisecond: 0 });
};

const midpointDateTime = (start: DateTime, end: DateTime): DateTime =>
  DateTime.fromMillis((start.toMillis() + end.toMillis()) / 2, { zone: "utc" });

const longitudeDeltaAt = ({
  flags,
  pointKey,
  targetLongitude,
  utc,
  warnings
}: {
  flags: number;
  pointKey: string;
  targetLongitude: number;
  utc: DateTime;
  warnings: CalculationWarning[];
}): number | null => {
  const position = calculatePointPositionAt({
    flags,
    pointKey,
    utc,
    warnings
  });

  return position ? signedAngularDistance(position.longitude, targetLongitude) : null;
};

const refineLongitudeCrossing = ({
  end,
  flags,
  pointKey,
  start,
  targetLongitude,
  warnings
}: {
  end: DateTime;
  flags: number;
  pointKey: string;
  start: DateTime;
  targetLongitude: number;
  warnings: CalculationWarning[];
}): DateTime | null => {
  let left = start;
  let right = end;
  let leftDelta = longitudeDeltaAt({ flags, pointKey, targetLongitude, utc: left, warnings });
  let rightDelta = longitudeDeltaAt({ flags, pointKey, targetLongitude, utc: right, warnings });

  if (leftDelta === null || rightDelta === null) {
    return null;
  }

  if (Math.abs(leftDelta) <= EXACT_CROSSING_EPSILON) {
    return left;
  }

  if (Math.abs(rightDelta) <= EXACT_CROSSING_EPSILON) {
    return right;
  }

  if (leftDelta * rightDelta > 0) {
    return Math.abs(leftDelta) < Math.abs(rightDelta) ? left : right;
  }

  for (let index = 0; index < 42; index += 1) {
    const mid = midpointDateTime(left, right);
    const midDelta = longitudeDeltaAt({ flags, pointKey, targetLongitude, utc: mid, warnings });

    if (midDelta === null) {
      return null;
    }

    if (Math.abs(midDelta) <= EXACT_CROSSING_EPSILON || right.toMillis() - left.toMillis() <= 1000) {
      return mid;
    }

    if (leftDelta * midDelta <= 0) {
      right = mid;
      rightDelta = midDelta;
    } else {
      left = mid;
      leftDelta = midDelta;
    }
  }

  return midpointDateTime(left, right);
};

const findBodyReturnTime = ({
  end,
  flags,
  natalLongitude,
  pointKey,
  start,
  stepHours,
  warnings
}: {
  end: DateTime;
  flags: number;
  natalLongitude: number;
  pointKey: "sun" | "moon";
  start: DateTime;
  stepHours: number;
  warnings: CalculationWarning[];
}): DateTime | null => {
  let leftTime = start;
  let leftDelta = longitudeDeltaAt({
    flags,
    pointKey,
    targetLongitude: natalLongitude,
    utc: leftTime,
    warnings
  });
  let closest: { delta: number; utc: DateTime } | null = leftDelta === null ? null : { delta: Math.abs(leftDelta), utc: leftTime };

  if (leftDelta === null) {
    return null;
  }

  while (leftTime.toMillis() < end.toMillis()) {
    const nextTime = DateTime.fromMillis(
      Math.min(leftTime.plus({ hours: stepHours }).toMillis(), end.toMillis()),
      { zone: "utc" }
    );
    const nextDelta = longitudeDeltaAt({
      flags,
      pointKey,
      targetLongitude: natalLongitude,
      utc: nextTime,
      warnings
    });

    if (nextDelta === null) {
      return null;
    }

    if (!closest || Math.abs(nextDelta) < closest.delta) {
      closest = { delta: Math.abs(nextDelta), utc: nextTime };
    }

    const nearTarget = Math.min(Math.abs(leftDelta), Math.abs(nextDelta)) <= 20;

    if (Math.abs(leftDelta) <= EXACT_CROSSING_EPSILON) {
      return leftTime;
    }

    if (leftDelta * nextDelta <= 0 && nearTarget) {
      return refineLongitudeCrossing({
        end: nextTime,
        flags,
        pointKey,
        start: leftTime,
        targetLongitude: natalLongitude,
        warnings
      });
    }

    leftTime = nextTime;
    leftDelta = nextDelta;
  }

  return closest && closest.delta <= 0.25 ? closest.utc : null;
};

const calculateReturnChartAt = ({
  exactAt,
  input,
  natal,
  pointOrbs
}: {
  exactAt: DateTime;
  input: ForecastPreviewInput;
  natal: ChartResult;
  pointOrbs?: PointOrbSettings;
}): ChartResult => {
  const birthDate = exactAt.toISODate() ?? exactAt.toFormat("yyyy-MM-dd");
  const birthTime = exactAt.toFormat("HH:mm:ss");
  const chart = calculateNatalChart({
    birthDate,
    birthTime,
    birthTimeKnown: true,
    timezone: "UTC",
    latitude: natal.subject.latitude,
    longitude: natal.subject.longitude,
    houseSystem: natal.settings.houseSystem,
    zodiac: input.zodiac ?? natal.settings.zodiac,
    ayanamsa: input.ayanamsa ?? natal.settings.ayanamsa,
    pointOrbs,
    ephemerisPath: input.ephemerisPath
  });

  return {
    ...chart,
    chartType: "return"
  };
};

const calculateReturnEvent = ({
  end,
  flags,
  input,
  kind,
  natal,
  natalPoint,
  pointOrbs,
  start,
  stepHours,
  warnings
}: {
  end: DateTime;
  flags: number;
  input: ForecastPreviewInput;
  kind: ReturnEvent["kind"];
  natal: ChartResult;
  natalPoint: ChartPoint;
  pointOrbs?: PointOrbSettings;
  start: DateTime;
  stepHours: number;
  warnings: CalculationWarning[];
}): ReturnEvent | null => {
  const exactAt = findBodyReturnTime({
    end,
    flags,
    natalLongitude: natalPoint.longitude,
    pointKey: kind === "solar" ? "sun" : "moon",
    start,
    stepHours,
    warnings
  });

  if (!exactAt) {
    addCalculationWarning(
      warnings,
      kind === "solar" ? "SOLAR_RETURN_NOT_FOUND" : "LUNAR_RETURN_NOT_FOUND",
      kind === "solar"
        ? "Solar return exact time was not found inside the selected annual search window."
        : "Lunar return exact time was not found inside the selected lunar search window."
    );
    return null;
  }

  const chart = calculateReturnChartAt({
    exactAt,
    input,
    natal,
    pointOrbs
  });
  const returnPoint = chart.bodies.find((point) => point.key === natalPoint.key);

  return {
    kind,
    exactAt: toUtcIso(exactAt),
    targetPointKey: natalPoint.key === "moon" ? "moon" : "sun",
    natalLongitude: round(natalPoint.longitude, 4),
    returnLongitude: round(returnPoint?.longitude ?? natalPoint.longitude, 4),
    chart
  };
};

const aspectTargetLongitudes = (natalLongitude: number, exactAngle: number): number[] => {
  if (exactAngle === 0 || exactAngle === 180) {
    return [normalizeLongitude(natalLongitude + exactAngle)];
  }

  return [normalizeLongitude(natalLongitude + exactAngle), normalizeLongitude(natalLongitude - exactAngle)];
};

const buildTransitLongitudeSamples = ({
  end,
  flags,
  pointKey,
  start,
  stepHours,
  warnings
}: {
  end: DateTime;
  flags: number;
  pointKey: string;
  start: DateTime;
  stepHours: number;
  warnings: CalculationWarning[];
}): LongitudeSample[] => {
  const samples: LongitudeSample[] = [];
  let cursor = start;

  while (cursor.toMillis() <= end.toMillis()) {
    const position = calculatePointPositionAt({
      flags,
      pointKey,
      utc: cursor,
      warnings
    });

    if (!position) {
      return samples;
    }

    samples.push({
      utc: cursor,
      longitude: position.longitude
    });

    cursor = cursor.plus({ hours: stepHours });
  }

  const lastSample = samples[samples.length - 1];

  if (lastSample && lastSample.utc.toMillis() < end.toMillis()) {
    const position = calculatePointPositionAt({
      flags,
      pointKey,
      utc: end,
      warnings
    });

    if (position) {
      samples.push({
        utc: end,
        longitude: position.longitude
      });
    }
  }

  return samples;
};

const buildExactTransitEvent = ({
  baseDateTime,
  exactAngle,
  exactAt,
  flags,
  natalPoint,
  pointOrbs,
  transitPointKey,
  type,
  warnings
}: {
  baseDateTime: DateTime;
  exactAngle: number;
  exactAt: DateTime;
  flags: number;
  natalPoint: ChartPoint;
  pointOrbs?: PointOrbSettings;
  transitPointKey: string;
  type: AspectType;
  warnings: CalculationWarning[];
}): ExactTransitEvent => {
  const allowedOrb = allowedOrbForExactTransitPair(type, transitPointKey, natalPoint.key, pointOrbs);
  const exactPosition = calculatePointPositionAt({
    flags,
    pointKey: transitPointKey,
    utc: exactAt,
    warnings
  });
  const speed = Math.abs(exactPosition?.speed ?? 0);
  const durationDays = speed >= 0.0001 ? round((allowedOrb * 2) / speed, 2) : null;
  const activeWindowIsReasonable = durationDays !== null && durationDays <= 1460;
  const aspectWeight = ASPECT_SCORE_WEIGHTS[type] ?? 0.65;
  const bodyWeight = TRANSIT_BODY_SCORE_WEIGHTS[transitPointKey] ?? 0.55;
  const score = round((0.62 + aspectWeight * 0.23 + bodyWeight * 0.15) * 100, 1);

  return {
    bodyA: transitPointKey,
    bodyB: natalPoint.key,
    type,
    exactAngle,
    orb: 0,
    phase: "exact",
    exactAt: toUtcIso(exactAt),
    daysToExact: round(exactAt.diff(baseDateTime, "days").days, 3),
    activeFrom: activeWindowIsReasonable ? toUtcIso(exactAt.minus({ days: durationDays / 2 })) : null,
    activeUntil: activeWindowIsReasonable ? toUtcIso(exactAt.plus({ days: durationDays / 2 })) : null,
    durationDays: activeWindowIsReasonable ? durationDays : null,
    score,
    strength: aspectStrength(score),
    transitPointLabel: pointLabelForKey(transitPointKey),
    natalPointLabel: natalPoint.label,
    natalHouse: natalPoint.house
  };
};

const calculateExactTransitEvents = ({
  baseDateTime,
  days,
  flags,
  natal,
  pointOrbs,
  warnings
}: {
  baseDateTime: DateTime;
  days: number;
  flags: number;
  natal: ChartResult;
  pointOrbs?: PointOrbSettings;
  warnings: CalculationWarning[];
}): ExactTransitEvent[] => {
  const events: ExactTransitEvent[] = [];
  const eventKeys = new Set<string>();
  const windowEnd = baseDateTime.plus({ days });
  const natalPoints = [...natal.angles, ...natal.bodies];

  for (const transitPointKey of FORECAST_EXACT_TRANSIT_BODY_KEYS) {
    const samples = buildTransitLongitudeSamples({
      end: windowEnd,
      flags,
      pointKey: transitPointKey,
      start: baseDateTime,
      stepHours: transitPointKey === "moon" ? 3 : 12,
      warnings
    });

    if (samples.length < 2) {
      continue;
    }

    for (const natalPoint of natalPoints) {
      for (const [type, exactAngle] of Object.entries(MAJOR_ASPECT_ANGLES) as Array<[AspectType, number]>) {
        for (const targetLongitude of aspectTargetLongitudes(natalPoint.longitude, exactAngle)) {
          for (let index = 0; index < samples.length - 1; index += 1) {
            const left = samples[index];
            const right = samples[index + 1];

            if (!left || !right) {
              continue;
            }

            const leftDelta = signedAngularDistance(left.longitude, targetLongitude);
            const rightDelta = signedAngularDistance(right.longitude, targetLongitude);
            const nearTarget = Math.min(Math.abs(leftDelta), Math.abs(rightDelta)) <= 20;
            const crossesTarget = leftDelta * rightDelta <= 0 && nearTarget;

            if (!crossesTarget && Math.abs(leftDelta) > EXACT_CROSSING_EPSILON) {
              continue;
            }

            const exactAt =
              Math.abs(leftDelta) <= EXACT_CROSSING_EPSILON
                ? left.utc
                : Math.abs(rightDelta) <= EXACT_CROSSING_EPSILON
                  ? right.utc
                  : refineLongitudeCrossing({
                      end: right.utc,
                      flags,
                      pointKey: transitPointKey,
                      start: left.utc,
                      targetLongitude,
                      warnings
                    });

            if (
              !exactAt ||
              exactAt.toMillis() < baseDateTime.toMillis() ||
              exactAt.toMillis() > windowEnd.toMillis()
            ) {
              continue;
            }

            const eventKey = `${transitPointKey}-${natalPoint.key}-${type}-${Math.round(exactAt.toMillis() / 60000)}`;

            if (eventKeys.has(eventKey)) {
              continue;
            }

            eventKeys.add(eventKey);
            events.push(
              buildExactTransitEvent({
                baseDateTime,
                exactAngle,
                exactAt,
                flags,
                natalPoint,
                pointOrbs,
                transitPointKey,
                type,
                warnings
              })
            );
          }
        }
      }
    }
  }

  return events.sort(
    (a, b) =>
      new Date(a.exactAt ?? 0).getTime() - new Date(b.exactAt ?? 0).getTime() ||
      b.score - a.score ||
      a.bodyA.localeCompare(b.bodyA)
  );
};

const findSecondaryProgressionExactDate = ({
  aspect,
  flags,
  natalPoint,
  progressedDateTime,
  progressedPoint,
  warnings
}: {
  aspect: Aspect;
  flags: number;
  natalPoint: ChartPoint;
  progressedDateTime: DateTime;
  progressedPoint: ChartPoint;
  warnings: CalculationWarning[];
}): DateTime | null => {
  const speed = progressedPoint.speed ?? 0;

  if (Math.abs(speed) < 0.0001) {
    return null;
  }

  const candidates: DateTime[] = [];

  for (const targetLongitude of aspectTargetLongitudes(natalPoint.longitude, aspect.exactAngle)) {
    const delta = signedAngularDistance(progressedPoint.longitude, targetLongitude);
    const estimatedProgressedDays = delta / speed;

    if (!Number.isFinite(estimatedProgressedDays) || Math.abs(estimatedProgressedDays) > SECONDARY_PROGRESSION_MAX_EXACT_YEARS) {
      continue;
    }

    const estimatedDate = progressedDateTime.plus({ days: estimatedProgressedDays });
    const marginDays = progressedPoint.key === "moon" ? 0.35 : Math.min(5, Math.max(1, Math.abs(estimatedProgressedDays) * 0.15));
    const samples = buildTransitLongitudeSamples({
      end: estimatedDate.plus({ days: marginDays }),
      flags,
      pointKey: progressedPoint.key,
      start: estimatedDate.minus({ days: marginDays }),
      stepHours: progressedPoint.key === "moon" ? 1 : 6,
      warnings
    });

    for (let index = 0; index < samples.length - 1; index += 1) {
      const left = samples[index];
      const right = samples[index + 1];

      if (!left || !right) {
        continue;
      }

      const leftDelta = signedAngularDistance(left.longitude, targetLongitude);
      const rightDelta = signedAngularDistance(right.longitude, targetLongitude);
      const crossesTarget = leftDelta * rightDelta <= 0 && Math.min(Math.abs(leftDelta), Math.abs(rightDelta)) <= 20;

      if (!crossesTarget && Math.abs(leftDelta) > EXACT_CROSSING_EPSILON) {
        continue;
      }

      const exactDate =
        Math.abs(leftDelta) <= EXACT_CROSSING_EPSILON
          ? left.utc
          : Math.abs(rightDelta) <= EXACT_CROSSING_EPSILON
            ? right.utc
            : refineLongitudeCrossing({
                end: right.utc,
                flags,
                pointKey: progressedPoint.key,
                start: left.utc,
                targetLongitude,
                warnings
              });

      if (exactDate) {
        candidates.push(exactDate);
      }
    }
  }

  return (
    candidates.sort(
      (a, b) => Math.abs(a.diff(progressedDateTime, "seconds").seconds) - Math.abs(b.diff(progressedDateTime, "seconds").seconds)
    )[0] ?? null
  );
};

const buildSecondaryProgressionAspect = ({
  aspect,
  birthDateTime,
  flags,
  natalPoint,
  progressedDateTime,
  progressedPoint,
  targetDateTime,
  warnings
}: {
  aspect: Aspect;
  birthDateTime: DateTime;
  flags: number;
  natalPoint: ChartPoint;
  progressedDateTime: DateTime;
  progressedPoint: ChartPoint;
  targetDateTime: DateTime;
  warnings: CalculationWarning[];
}): SecondaryProgressionAspect => {
  const exactProgressedDate = findSecondaryProgressionExactDate({
    aspect,
    flags,
    natalPoint,
    progressedDateTime,
    progressedPoint,
    warnings
  });
  const exactAt = exactProgressedDate
    ? birthDateTime.plus({
        days: exactProgressedDate.diff(birthDateTime, "days").days * SECONDARY_PROGRESSION_YEAR_DAYS
      })
    : null;
  const yearsToExact = exactAt ? exactAt.diff(targetDateTime, "days").days / SECONDARY_PROGRESSION_YEAR_DAYS : null;
  const estimatedProgressedDays =
    Math.abs(progressedPoint.speed ?? 0) >= 0.0001
      ? transitAspectTargetDelta(aspect, progressedPoint, natalPoint) / (progressedPoint.speed ?? 1)
      : null;
  const phase =
    aspect.orb <= 0.01
      ? "exact"
      : yearsToExact !== null
        ? yearsToExact > 0
          ? "applying"
          : "separating"
        : estimatedProgressedDays === null
          ? "stationary"
          : estimatedProgressedDays > 0
            ? "applying"
            : "separating";
  const closeness = Math.max(0, 1 - aspect.orb / SECONDARY_PROGRESSION_ASPECT_ORB);
  const aspectWeight = ASPECT_SCORE_WEIGHTS[aspect.type] ?? 0.65;
  const bodyWeight = TRANSIT_BODY_SCORE_WEIGHTS[progressedPoint.key] ?? 0.55;
  const score = round((closeness * 0.68 + aspectWeight * 0.2 + bodyWeight * 0.12) * 100, 1);

  return {
    ...aspect,
    phase,
    exactAt: exactAt ? toUtcIso(exactAt) : null,
    yearsToExact: yearsToExact === null ? null : round(yearsToExact, 4),
    score,
    strength: aspectStrength(score),
    progressedPointLabel: progressedPoint.label,
    natalPointLabel: natalPoint.label,
    natalHouse: natalPoint.house
  };
};

const calculateSecondaryProgressionFromNatal = (
  input: SecondaryProgressionInput,
  natal: ChartResult
): SecondaryProgressionResult => {
  const targetDateTime = parseTransitDateTime(input.targetDateTime);
  const birthDateTime = DateTime.fromISO(natal.subject.utcDateTime, { setZone: true }).toUTC();

  if (!birthDateTime.isValid) {
    throw new Error("Natal UTC date-time is invalid for secondary progression calculation");
  }

  const elapsedDays = targetDateTime.diff(birthDateTime, "days").days;

  if (elapsedDays < 0) {
    throw new Error("Secondary progression target date cannot precede the natal date");
  }

  const ageYears = elapsedDays / SECONDARY_PROGRESSION_YEAR_DAYS;
  const progressedDateTime = birthDateTime.plus({ days: ageYears });
  const progressedBase = calculateTransitChart({
    transitDateTime: toUtcIso(progressedDateTime),
    latitude: natal.subject.latitude,
    longitude: natal.subject.longitude,
    zodiac: input.zodiac ?? natal.settings.zodiac,
    ayanamsa: input.ayanamsa ?? natal.settings.ayanamsa,
    houseSystem: natal.settings.houseSystem,
    ephemerisPath: input.ephemerisPath
  });
  const hasNatalHouses = natal.houses.length > 0;
  const progressedBodies = hasNatalHouses
    ? assignNatalHousesToTransitPoints(progressedBase.bodies, natal.houses)
    : progressedBase.bodies;
  const progressedHousePlacements = hasNatalHouses ? progressedBodies : [];
  const progressed: ChartResult = {
    ...progressedBase,
    chartType: "progression",
    bodies: progressedBodies
  };
  const natalReferencePoints = [
    ...natal.bodies,
    ...natal.angles.filter((point) => point.key === "asc" || point.key === "mc")
  ];
  const aspects = calculateAspectsBetween(
    progressed.bodies,
    natalReferencePoints,
    SECONDARY_PROGRESSION_ASPECT_ORBS
  );
  const progressedPointsByKey = new Map(progressed.bodies.map((point) => [point.key, point]));
  const natalPointsByKey = new Map(natalReferencePoints.map((point) => [point.key, point]));
  const warnings: CalculationWarning[] = [...progressed.warnings];
  const flags = buildBodyFlags({ zodiac: input.zodiac ?? natal.settings.zodiac });
  const progressedToNatalAspects = aspects
    .map((aspect) => {
      const progressedPoint = progressedPointsByKey.get(aspect.bodyA);
      const natalPoint = natalPointsByKey.get(aspect.bodyB);

      if (!progressedPoint || !natalPoint) {
        return null;
      }

      return buildSecondaryProgressionAspect({
        aspect,
        birthDateTime,
        flags,
        natalPoint,
        progressedDateTime,
        progressedPoint,
        targetDateTime,
        warnings
      });
    })
    .filter((aspect): aspect is SecondaryProgressionAspect => aspect !== null)
    .sort((a, b) => b.score - a.score || a.orb - b.orb);

  return {
    method: "secondary-day-for-year",
    yearLengthDays: SECONDARY_PROGRESSION_YEAR_DAYS,
    aspectOrbDegrees: SECONDARY_PROGRESSION_ASPECT_ORB,
    targetDateTime: toUtcIso(targetDateTime),
    progressedDateTime: toUtcIso(progressedDateTime),
    ageYears: round(ageYears, 6),
    natal,
    progressed,
    progressedHousePlacements,
    progressedToNatalAspects,
    warnings
  };
};

export const calculateSecondaryProgression = (input: SecondaryProgressionInput): SecondaryProgressionResult => {
  const natal = calculateNatalChart({
    ...input.natal,
    zodiac: input.zodiac ?? input.natal.zodiac,
    ayanamsa: input.ayanamsa ?? input.natal.ayanamsa,
    ephemerisPath: input.ephemerisPath
  });

  return calculateSecondaryProgressionFromNatal(input, natal);
};

const findSolarArcExactProgressedDate = ({
  aspect,
  directedSourceNatalPoint,
  flags,
  natalSun,
  natalTargetPoint,
  progressedDateTime,
  progressedSun,
  warnings
}: {
  aspect: Aspect;
  directedSourceNatalPoint: ChartPoint;
  flags: number;
  natalSun: ChartPoint;
  natalTargetPoint: ChartPoint;
  progressedDateTime: DateTime;
  progressedSun: ChartPoint;
  warnings: CalculationWarning[];
}): DateTime | null => {
  const sunSpeed = progressedSun.speed ?? 0;

  if (Math.abs(sunSpeed) < 0.0001) {
    return null;
  }

  const candidates: DateTime[] = [];

  for (const directedTargetLongitude of aspectTargetLongitudes(natalTargetPoint.longitude, aspect.exactAngle)) {
    const requiredArc = normalizeLongitude(directedTargetLongitude - directedSourceNatalPoint.longitude);
    const progressedSunTarget = normalizeLongitude(natalSun.longitude + requiredArc);
    const estimatedProgressedDays = signedAngularDistance(progressedSun.longitude, progressedSunTarget) / sunSpeed;

    if (!Number.isFinite(estimatedProgressedDays) || Math.abs(estimatedProgressedDays) > SECONDARY_PROGRESSION_MAX_EXACT_YEARS) {
      continue;
    }

    const estimatedDate = progressedDateTime.plus({ days: estimatedProgressedDays });
    const marginDays = Math.min(4, Math.max(0.75, Math.abs(estimatedProgressedDays) * 0.12));
    const samples = buildTransitLongitudeSamples({
      end: estimatedDate.plus({ days: marginDays }),
      flags,
      pointKey: "sun",
      start: estimatedDate.minus({ days: marginDays }),
      stepHours: 6,
      warnings
    });

    for (let index = 0; index < samples.length - 1; index += 1) {
      const left = samples[index];
      const right = samples[index + 1];

      if (!left || !right) {
        continue;
      }

      const leftDelta = signedAngularDistance(left.longitude, progressedSunTarget);
      const rightDelta = signedAngularDistance(right.longitude, progressedSunTarget);
      const crossesTarget = leftDelta * rightDelta <= 0 && Math.min(Math.abs(leftDelta), Math.abs(rightDelta)) <= 20;

      if (!crossesTarget && Math.abs(leftDelta) > EXACT_CROSSING_EPSILON) {
        continue;
      }

      const exactDate =
        Math.abs(leftDelta) <= EXACT_CROSSING_EPSILON
          ? left.utc
          : Math.abs(rightDelta) <= EXACT_CROSSING_EPSILON
            ? right.utc
            : refineLongitudeCrossing({
                end: right.utc,
                flags,
                pointKey: "sun",
                start: left.utc,
                targetLongitude: progressedSunTarget,
                warnings
              });

      if (exactDate) {
        candidates.push(exactDate);
      }
    }
  }

  return (
    candidates.sort(
      (a, b) => Math.abs(a.diff(progressedDateTime, "seconds").seconds) - Math.abs(b.diff(progressedDateTime, "seconds").seconds)
    )[0] ?? null
  );
};

const buildSolarArcDirectionAspect = ({
  aspect,
  birthDateTime,
  directedPoint,
  directedSourceNatalPoint,
  flags,
  natalSun,
  natalTargetPoint,
  progressedDateTime,
  progressedSun,
  targetDateTime,
  warnings
}: {
  aspect: Aspect;
  birthDateTime: DateTime;
  directedPoint: ChartPoint;
  directedSourceNatalPoint: ChartPoint;
  flags: number;
  natalSun: ChartPoint;
  natalTargetPoint: ChartPoint;
  progressedDateTime: DateTime;
  progressedSun: ChartPoint;
  targetDateTime: DateTime;
  warnings: CalculationWarning[];
}): SolarArcDirectionAspect => {
  const exactProgressedDate = findSolarArcExactProgressedDate({
    aspect,
    directedSourceNatalPoint,
    flags,
    natalSun,
    natalTargetPoint,
    progressedDateTime,
    progressedSun,
    warnings
  });
  const exactAt = exactProgressedDate
    ? birthDateTime.plus({
        days: exactProgressedDate.diff(birthDateTime, "days").days * SECONDARY_PROGRESSION_YEAR_DAYS
      })
    : null;
  const yearsToExact = exactAt ? exactAt.diff(targetDateTime, "days").days / SECONDARY_PROGRESSION_YEAR_DAYS : null;
  const estimatedYearsToExact =
    Math.abs(progressedSun.speed ?? 0) >= 0.0001
      ? transitAspectTargetDelta(aspect, directedPoint, natalTargetPoint) / (progressedSun.speed ?? 1)
      : null;
  const phase =
    aspect.orb <= 0.01
      ? "exact"
      : yearsToExact !== null
        ? yearsToExact > 0
          ? "applying"
          : "separating"
        : estimatedYearsToExact === null
          ? "stationary"
          : estimatedYearsToExact > 0
            ? "applying"
            : "separating";
  const closeness = Math.max(0, 1 - aspect.orb / SOLAR_ARC_ASPECT_ORB);
  const aspectWeight = ASPECT_SCORE_WEIGHTS[aspect.type] ?? 0.65;
  const bodyWeight = TRANSIT_BODY_SCORE_WEIGHTS[directedPoint.key] ?? 0.65;
  const score = round((closeness * 0.7 + aspectWeight * 0.2 + bodyWeight * 0.1) * 100, 1);

  return {
    ...aspect,
    phase,
    exactAt: exactAt ? toUtcIso(exactAt) : null,
    yearsToExact: yearsToExact === null ? null : round(yearsToExact, 4),
    score,
    strength: aspectStrength(score),
    directedPointLabel: directedPoint.label,
    natalPointLabel: natalTargetPoint.label,
    natalHouse: natalTargetPoint.house
  };
};

const calculateSolarArcDirections = (
  progression: SecondaryProgressionResult,
  ephemerisPath?: string
): SolarArcDirectionResult => {
  const natal = progression.natal;
  const natalSun = natal.bodies.find((point) => point.key === "sun");
  const progressedSun = progression.progressed.bodies.find((point) => point.key === "sun");

  if (!natalSun || !progressedSun) {
    throw new Error("Natal and progressed Sun are required for solar arc directions");
  }

  const solarArcDegrees = normalizeLongitude(progressedSun.longitude - natalSun.longitude);
  const directPoint = (point: ChartPoint): ChartPoint => {
    const longitude = normalizeLongitude(point.longitude + solarArcDegrees);

    return buildPoint({
      key: point.key,
      label: point.label,
      kind: point.kind,
      longitude,
      latitude: point.latitude,
      speed: progressedSun.speed,
      house: findHouse(longitude, natal.houses)
    });
  };
  const directedBodies = natal.bodies.map(directPoint);
  const directedAngles = natal.angles.map(directPoint);
  const directedHouses = natal.houses.map((house) => {
    const longitude = round(normalizeLongitude(house.longitude + solarArcDegrees));

    return {
      house: house.house,
      longitude,
      ...toSign(longitude)
    };
  });
  const targetDateTime = DateTime.fromISO(progression.targetDateTime, { setZone: true }).toUTC();
  const directed: ChartResult = {
    chartType: "direction",
    engine: natal.engine,
    settings: natal.settings,
    subject: {
      ...natal.subject,
      utcDateTime: toUtcIso(targetDateTime)
    },
    angles: directedAngles,
    houses: directedHouses,
    houseConnections: [],
    houseRulers: [],
    planetRulerships: [],
    bodies: directedBodies,
    aspects: [],
    warnings: []
  };
  const directedReferencePoints = [
    ...directedBodies,
    ...directedAngles.filter((point) => point.key === "asc" || point.key === "mc")
  ];
  const natalReferencePoints = [
    ...natal.bodies,
    ...natal.angles.filter((point) => point.key === "asc" || point.key === "mc")
  ];
  const aspects = calculateAspectsBetween(directedReferencePoints, natalReferencePoints, SOLAR_ARC_ASPECT_ORBS);
  const directedPointsByKey = new Map(directedReferencePoints.map((point) => [point.key, point]));
  const natalSourcePointsByKey = new Map(
    [...natal.bodies, ...natal.angles].map((point) => [point.key, point])
  );
  const natalTargetPointsByKey = new Map(natalReferencePoints.map((point) => [point.key, point]));
  const birthDateTime = DateTime.fromISO(natal.subject.utcDateTime, { setZone: true }).toUTC();
  const progressedDateTime = DateTime.fromISO(progression.progressedDateTime, { setZone: true }).toUTC();
  const warnings: CalculationWarning[] = [];

  setEphemerisContext({
    ephemerisPath,
    settings: natal.settings,
    warnings
  });

  const flags = buildBodyFlags(natal.settings);
  const directedToNatalAspects = aspects
    .map((aspect) => {
      const directedPoint = directedPointsByKey.get(aspect.bodyA);
      const directedSourceNatalPoint = natalSourcePointsByKey.get(aspect.bodyA);
      const natalTargetPoint = natalTargetPointsByKey.get(aspect.bodyB);

      if (!directedPoint || !directedSourceNatalPoint || !natalTargetPoint) {
        return null;
      }

      return buildSolarArcDirectionAspect({
        aspect,
        birthDateTime,
        directedPoint,
        directedSourceNatalPoint,
        flags,
        natalSun,
        natalTargetPoint,
        progressedDateTime,
        progressedSun,
        targetDateTime,
        warnings
      });
    })
    .filter((aspect): aspect is SolarArcDirectionAspect => aspect !== null)
    .sort((a, b) => b.score - a.score || a.orb - b.orb);

  return {
    method: "solar-arc-secondary-sun",
    aspectOrbDegrees: SOLAR_ARC_ASPECT_ORB,
    targetDateTime: toUtcIso(targetDateTime),
    solarArcDegrees: round(solarArcDegrees, 6),
    natal,
    directed,
    directedPoints: directedReferencePoints,
    directedToNatalAspects,
    warnings
  };
};

const addReturnChartWarnings = (
  warnings: CalculationWarning[],
  returnEvent: ReturnEvent | null,
  prefix: "SOLAR" | "LUNAR"
): void => {
  for (const warning of returnEvent?.chart.warnings ?? []) {
    addCalculationWarning(warnings, `${prefix}_${warning.code}`, `${prefix === "SOLAR" ? "Solar" : "Lunar"} return: ${warning.message}`);
  }
};

export const calculateForecastPreview = (input: ForecastPreviewInput): ForecastPreviewResult => {
  const baseDateTime = parseTransitDateTime(input.fromDateTime);
  const requestedPointOrbs = cleanPointOrbs(input.pointOrbs);
  const natal = calculateNatalChart({
    ...input.natal,
    zodiac: input.zodiac ?? input.natal.zodiac,
    ayanamsa: input.ayanamsa ?? input.natal.ayanamsa,
    pointOrbs: requestedPointOrbs ?? input.natal.pointOrbs,
    ephemerisPath: input.ephemerisPath
  });
  const forecastPointOrbs = requestedPointOrbs ?? natal.settings.pointOrbs;
  const settings = {
    zodiac: input.zodiac ?? natal.settings.zodiac,
    ayanamsa: input.ayanamsa ?? natal.settings.ayanamsa
  };
  const warnings: CalculationWarning[] = [...natal.warnings];
  const targetYear = Math.max(1900, Math.min(2100, Math.trunc(input.targetYear ?? baseDateTime.year)));
  const days = clampForecastDays(input.days);

  setEphemerisContext({
    ephemerisPath: input.ephemerisPath,
    settings,
    warnings
  });

  const flags = buildBodyFlags(settings);
  const natalSun = natal.bodies.find((body) => body.key === "sun") ?? null;
  const natalMoon = natal.bodies.find((body) => body.key === "moon") ?? null;
  const solarAnchor = dateInYearForBirthDate(input.natal.birthDate, targetYear);
  const solarReturn = natalSun
    ? calculateReturnEvent({
        end: solarAnchor.plus({ days: 8 }),
        flags,
        input,
        kind: "solar",
        natal,
        natalPoint: natalSun,
        pointOrbs: forecastPointOrbs,
        start: solarAnchor.minus({ days: 8 }),
        stepHours: 6,
        warnings
      })
    : null;
  const lunarReturn = natalMoon
    ? calculateReturnEvent({
        end: baseDateTime.plus({ days: 32 }),
        flags,
        input,
        kind: "lunar",
        natal,
        natalPoint: natalMoon,
        pointOrbs: forecastPointOrbs,
        start: baseDateTime,
        stepHours: 3,
        warnings
      })
    : null;
  const exactTransits = calculateExactTransitEvents({
    baseDateTime,
    days,
    flags,
    natal,
    pointOrbs: forecastPointOrbs,
    warnings
  });
  const secondaryProgression = calculateSecondaryProgressionFromNatal(
    {
      natal: input.natal,
      targetDateTime: toUtcIso(baseDateTime),
      zodiac: settings.zodiac,
      ayanamsa: settings.ayanamsa,
      ephemerisPath: input.ephemerisPath
    },
    natal
  );
  const solarArcDirections = calculateSolarArcDirections(secondaryProgression, input.ephemerisPath);

  addReturnChartWarnings(warnings, solarReturn, "SOLAR");
  addReturnChartWarnings(warnings, lunarReturn, "LUNAR");

  for (const warning of secondaryProgression.warnings) {
    addCalculationWarning(warnings, `PROGRESSION_${warning.code}`, `Secondary progression: ${warning.message}`);
  }

  for (const warning of solarArcDirections.warnings) {
    addCalculationWarning(warnings, `SOLAR_ARC_${warning.code}`, `Solar arc: ${warning.message}`);
  }

  return {
    chartType: "forecast",
    generatedAt: new Date().toISOString(),
    natal,
    solarReturn,
    lunarReturn,
    secondaryProgression,
    solarArcDirections,
    exactTransits,
    warnings
  };
};

const summarizeSynastryAspects = (aspects: Aspect[]): SynastryPreviewResult["summary"] => ({
  totalAspects: aspects.length,
  harmoniousAspects: aspects.filter((aspect) => aspect.type === "trine" || aspect.type === "sextile").length,
  tenseAspects: aspects.filter((aspect) => aspect.type === "square" || aspect.type === "opposition").length,
  conjunctions: aspects.filter((aspect) => aspect.type === "conjunction").length,
  exactAspects: aspects.filter((aspect) => aspect.orb <= 1).length
});

export const calculateSynastryPreview = (input: SynastryPreviewInput): SynastryPreviewResult => {
  const previewPointOrbs = cleanPointOrbs(input.pointOrbs);
  const subjectA = calculateNatalChart({
    ...input.subjectA,
    zodiac: input.zodiac ?? input.subjectA.zodiac,
    ayanamsa: input.ayanamsa ?? input.subjectA.ayanamsa,
    pointOrbs: previewPointOrbs ?? input.subjectA.pointOrbs,
    ephemerisPath: input.ephemerisPath
  });
  const subjectB = calculateNatalChart({
    ...input.subjectB,
    zodiac: input.zodiac ?? input.subjectB.zodiac,
    ayanamsa: input.ayanamsa ?? input.subjectB.ayanamsa,
    pointOrbs: previewPointOrbs ?? input.subjectB.pointOrbs,
    ephemerisPath: input.ephemerisPath
  });
  const subjectAPoints = subjectA.bodies;
  const subjectBPoints = subjectB.bodies;
  const synastryPointOrbs = previewPointOrbs ?? subjectA.settings.pointOrbs ?? subjectB.settings.pointOrbs;
  const interAspects = calculateAspectsBetween(subjectAPoints, subjectBPoints, undefined, synastryPointOrbs);
  const warnings: CalculationWarning[] = [
    ...subjectA.warnings.map((warning) => ({
      code: `SUBJECT_A_${warning.code}`,
      message: `Subject A: ${warning.message}`
    })),
    ...subjectB.warnings.map((warning) => ({
      code: `SUBJECT_B_${warning.code}`,
      message: `Subject B: ${warning.message}`
    }))
  ];

  return {
    chartType: "synastry",
    generatedAt: new Date().toISOString(),
    subjectA,
    subjectB,
    interAspects,
    summary: summarizeSynastryAspects(interAspects),
    warnings
  };
};
