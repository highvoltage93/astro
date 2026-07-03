import { calculateMajorAspects } from "./aspects";
import { ZODIAC_SIGNS } from "./constants";
import type { ChartPoint, ChartResult, HouseCusp, NatalPreviewInput } from "./types";

const toSign = (longitude: number): { sign: string; signDegree: number } => {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const sign = ZODIAC_SIGNS[signIndex] ?? "aries";

  return {
    sign,
    signDegree: Number((normalized - signIndex * 30).toFixed(2))
  };
};

const point = (key: string, label: string, longitude: number, house?: number): ChartPoint => ({
  key,
  label,
  kind: key === "asc" || key === "mc" ? "angle" : "body",
  longitude,
  house,
  ...toSign(longitude)
});

const house = (houseNumber: number, longitude: number): HouseCusp => ({
  house: houseNumber,
  longitude,
  ...toSign(longitude)
});

const normalizeBirthTime = (birthTime: string): string =>
  /^\d{2}:\d{2}$/.test(birthTime) ? `${birthTime}:00` : birthTime;

export const createNatalPreview = (input: NatalPreviewInput): ChartResult => {
  const settings = {
    zodiac: input.zodiac ?? "tropical",
    houseSystem: input.houseSystem ?? "placidus"
  };

  const bodies = [
    point("sun", "Sun", 12.42, 1),
    point("moon", "Moon", 84.18, 3),
    point("mercury", "Mercury", 28.61, 1),
    point("venus", "Venus", 156.9, 6),
    point("mars", "Mars", 221.36, 8),
    point("jupiter", "Jupiter", 303.77, 11),
    point("saturn", "Saturn", 332.04, 12),
    point("uranus", "Uranus", 44.13, 2),
    point("neptune", "Neptune", 277.82, 10),
    point("pluto", "Pluto", 209.49, 7),
    point("north-node", "North Node", 139.12, 5),
    point("chiron", "Chiron", 18.23, 1),
    point("lilith", "Lilith", 251.1, 9)
  ];

  const angles = [point("asc", "Ascendant", 4.2, 1), point("mc", "Midheaven", 274.2, 10)];

  return {
    chartType: "natal",
    engine: {
      name: "astroprocessor-preview",
      version: "0.1.0",
      status: "stub"
    },
    settings,
    subject: {
      utcDateTime: `${input.birthDate}T${normalizeBirthTime(input.birthTime)}.000Z`,
      birthTimeKnown: input.birthTimeKnown ?? true,
      latitude: input.latitude,
      longitude: input.longitude
    },
    angles,
    houses: Array.from({ length: 12 }, (_, index) => house(index + 1, index * 30 + 4.2)),
    bodies,
    aspects: calculateMajorAspects(bodies),
    warnings: [
      {
        code: "EPHEMERIS_ADAPTER_PENDING",
        message: "This preview uses placeholder positions until the Swiss Ephemeris adapter is implemented."
      }
    ]
  };
};
