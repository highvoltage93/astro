import { houses_armc, type HouseSystems } from "sweph";

const normalize = (angle: number) => ((angle % 360) + 360) % 360;

export function solarArcMcHouses(input: {
  natalMc: number;
  natalSun: number;
  progressedSun: number;
  obliquity: number;
  latitude: number;
  houseSystem: HouseSystems;
  zodiacOffset?: number;
}) {
  const offset = input.zodiacOffset ?? 0;
  const arc = normalize(input.progressedSun - input.natalSun);
  const mc = normalize(input.natalMc + arc + offset);
  const radians = Math.PI / 180;
  // Ecliptic MC -> equatorial right ascension, preserving the quadrant.
  const armc = normalize(Math.atan2(Math.sin(mc * radians) * Math.cos(input.obliquity * radians),
    Math.cos(mc * radians)) / radians);
  const result = houses_armc(armc, input.latitude, input.obliquity, input.houseSystem);
  if (result.error) throw new Error(result.error.trim());
  return {
    houses: result.data.houses.map((longitude) => normalize(longitude - offset)),
    asc: normalize(result.data.points[0] - offset),
    mc: normalize(result.data.points[1] - offset)
  };
}
