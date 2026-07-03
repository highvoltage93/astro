import { DEFAULT_MAJOR_ASPECT_ORBS, MAJOR_ASPECT_ANGLES } from "./constants";
import type { Aspect, AspectType, ChartPoint } from "./types";

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

const shortestDistance = (a: number, b: number): number => {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
};

export const calculateMajorAspects = (
  points: ChartPoint[],
  orbs: Partial<Record<AspectType, number>> = DEFAULT_MAJOR_ASPECT_ORBS
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
        const allowedOrb = orbs[type] ?? DEFAULT_MAJOR_ASPECT_ORBS[type];

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

