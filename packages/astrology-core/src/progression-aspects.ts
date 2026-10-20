import { MAJOR_ASPECT_ANGLES } from "./constants";
import type { ChartPoint, ProgressionAspect } from "./types";

export const PROGRESSION_ASPECT_ANGLES = { ...MAJOR_ASPECT_ANGLES, semisextile: 30, quincunx: 150 };

export function calculateProgressionAspects(points: ChartPoint[], natal: ChartPoint[], orb: number): ProgressionAspect[] {
  const result: ProgressionAspect[] = [];
  for (const a of points) for (const b of natal) {
    const difference = Math.abs(a.longitude - b.longitude) % 360;
    const distance = Math.min(difference, 360 - difference);
    for (const [type, exactAngle] of Object.entries(PROGRESSION_ASPECT_ANGLES)) {
      const deviation = Math.abs(distance - exactAngle);
      if (deviation <= orb) result.push({ bodyA: a.key, bodyB: b.key,
        type: type as ProgressionAspect["type"], exactAngle, orb: deviation });
    }
  }
  return result.sort((a, b) => a.orb - b.orb);
}

/** Find the beginning of the continuous in-orb interval containing this exact pass. */
export function findProgressionIngress(exact: number, target: number, orb: number,
  earliest: number, step: number, longitudeAt: (time: number) => number | null): number | null {
  const inside = (time: number): boolean | null => {
    const longitude = longitudeAt(time);
    if (longitude === null) return null;
    return Math.abs(((longitude - target + 540) % 360) - 180) <= orb;
  };
  let right = exact;
  while (right > earliest) {
    let left = Math.max(earliest, right - step);
    const isInside = inside(left);
    if (isInside === null) return null;
    if (!isInside) {
      while (right - left > 1000) {
        const middle = (left + right) / 2;
        const middleInside = inside(middle);
        if (middleInside === null) return null;
        if (middleInside) right = middle; else left = middle;
      }
      return (left + right) / 2;
    }
    right = left;
  }
  return null;
}
