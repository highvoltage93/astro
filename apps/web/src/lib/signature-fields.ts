// Same weights as SYNTHETIC_POINT_WEIGHTS in the calculation engine.
export const signatureFieldWeights: Readonly<Record<string, number>> = {
  sun: 2, moon: 2, mercury: 1.5, venus: 1.5, mars: 1.5, asc: 1.5,
  jupiter: 1, saturn: 1, uranus: 1, neptune: 1, pluto: 1,
  "north-node": 0.5, "south-node": 0.5
};

export function calculateSignatureFields(points: ReadonlyArray<{ key: string; house?: number }>) {
  const dayNight = [
    { key: "night", label: "Нічні поля · 1–6", score: 0 },
    { key: "day", label: "Денні поля · 7–12", score: 0 }
  ];
  const eastWest = [
    { key: "east", label: "Східні поля · 10–12, 1–3", score: 0 },
    { key: "west", label: "Західні поля · 4–9", score: 0 }
  ];
  const quadrants = [
    { key: "first", label: "I квадрант · 1–3", score: 0 },
    { key: "second", label: "II квадрант · 4–6", score: 0 },
    { key: "third", label: "III квадрант · 7–9", score: 0 },
    { key: "fourth", label: "IV квадрант · 10–12", score: 0 }
  ];
  let total = 0;
  let unassigned = 0;
  const seen = new Set<string>();
  for (const point of points) {
    if (seen.has(point.key)) continue;
    seen.add(point.key);
    const weight = signatureFieldWeights[point.key] ?? 0;
    if (!weight) continue;
    const house = point.house;
    if (house === undefined || !Number.isInteger(house) || house < 1 || house > 12) {
      unassigned += weight;
      continue;
    }
    dayNight[house <= 6 ? 0 : 1]!.score += weight;
    eastWest[house >= 10 || house <= 3 ? 0 : 1]!.score += weight;
    quadrants[Math.floor((house - 1) / 3)]!.score += weight;
    total += weight;
  }
  return { dayNight, eastWest, quadrants, total, unassigned };
}
