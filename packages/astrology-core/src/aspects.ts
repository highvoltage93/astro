import { DEFAULT_MAJOR_ASPECT_ORBS, DEFAULT_POINT_ORBS, MAJOR_ASPECT_ANGLES } from "./constants";
import type { Aspect, AspectType, ChartPoint, PointOrbSettings } from "./types";

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

const shortestDistance = (a: number, b: number): number => {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
};

export const allowedOrbForPair = (
  type: AspectType,
  pointA: Pick<ChartPoint, "key">,
  pointB: Pick<ChartPoint, "key">,
  aspectOrbs: Partial<Record<AspectType, number>> = {},
  pointOrbs: PointOrbSettings = {}
): number => {
  const fallbackOrb = DEFAULT_MAJOR_ASPECT_ORBS[type];
  const pointAOrb = pointOrbs[pointA.key] ?? DEFAULT_POINT_ORBS[pointA.key] ?? fallbackOrb;
  const pointBOrb = pointOrbs[pointB.key] ?? DEFAULT_POINT_ORBS[pointB.key] ?? fallbackOrb;

  // Only an explicitly requested method limit (e.g. progressions) caps point orbs.
  return Math.min(aspectOrbs[type] ?? Infinity, pointAOrb, pointBOrb);
};

export const calculateMajorAspects = (
  points: ChartPoint[],
  aspectOrbs: Partial<Record<AspectType, number>> = {},
  pointOrbs: PointOrbSettings = {}
): Aspect[] => {
  const aspects: Aspect[] = [];

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const pointA = points[i];
      const pointB = points[j];

      if (!pointA || !pointB) {
        continue;
      }

      const distance = shortestDistance(pointA.longitude, pointB.longitude);

      for (const [type, exactAngle] of Object.entries(MAJOR_ASPECT_ANGLES) as Array<[AspectType, number]>) {
        const orb = Math.abs(distance - exactAngle);
        const allowedOrb = allowedOrbForPair(type, pointA, pointB, aspectOrbs, pointOrbs);

        if (orb <= allowedOrb) {
          aspects.push({
            bodyA: pointA.key,
            bodyB: pointB.key,
            type,
            exactAngle,
            orb: Number(orb.toFixed(2))
          });
        }
      }
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb);
};

export const calculateAspectsBetween = (
  pointsA: ChartPoint[],
  pointsB: ChartPoint[],
  aspectOrbs: Partial<Record<AspectType, number>> = {},
  pointOrbs: PointOrbSettings = {}
): Aspect[] => {
  const aspects: Aspect[] = [];

  for (const pointA of pointsA) {
    for (const pointB of pointsB) {
      const distance = shortestDistance(pointA.longitude, pointB.longitude);

      for (const [type, exactAngle] of Object.entries(MAJOR_ASPECT_ANGLES) as Array<[AspectType, number]>) {
        const orb = Math.abs(distance - exactAngle);
        const allowedOrb = allowedOrbForPair(type, pointA, pointB, aspectOrbs, pointOrbs);

        if (orb <= allowedOrb) {
          aspects.push({
            bodyA: pointA.key,
            bodyB: pointB.key,
            type,
            exactAngle,
            orb: Number(orb.toFixed(2))
          });
        }
      }
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb);
};
