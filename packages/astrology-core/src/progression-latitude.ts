// Compatibility convention for Altair slow progressions, not the standard
// geographic latitude expected by Swiss Ephemeris house calculations.
export const progressionHouseLatitude = (latitude: number): number => {
  const radians = Math.PI / 180;
  return Math.atan((1 - 0.00669437999014) * Math.tan(latitude * radians)) / radians;
};
