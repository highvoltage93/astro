import { DEFAULT_MAJOR_ASPECT_ORBS, MAJOR_ASPECT_ANGLES } from "./constants";
import type { Aspect, AspectType, ChartPoint, PointOrbSettings } from "./types";

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

const shortestDistance = (a: number, b: number): number => {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
};

const allowedOrbForPair = (
  type: AspectType,
  pointA: ChartPoint,
  pointB: ChartPoint,
  aspectOrbs: Partial<Record<AspectType, number>>,
  pointOrbs: PointOrbSettings = {}
): number => {
  const fallbackOrb = DEFAULT_MAJOR_ASPECT_ORBS[type];
  const aspectOrb = aspectOrbs[type] ?? fallbackOrb;
  const pointAOrb = pointOrbs[pointA.key] ?? aspectOrb;
  const pointBOrb = pointOrbs[pointB.key] ?? aspectOrb;

  return Math.min(aspectOrb, pointAOrb, pointBOrb);
};

export const calculateMajorAspects = (
  points: ChartPoint[],
  aspectOrbs: Partial<Record<AspectType, number>> = DEFAULT_MAJOR_ASPECT_ORBS,
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
  aspectOrbs: Partial<Record<AspectType, number>> = DEFAULT_MAJOR_ASPECT_ORBS,
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
