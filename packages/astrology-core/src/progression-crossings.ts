// Times are calendar milliseconds, not the compressed ephemeris time.
export function findProgressionCrossings(
  samples: Array<{ time: number; longitude: number }>,
  target: number,
  longitudeAt: (time: number) => number | null
): number[] {
  const delta = (longitude: number) => ((target - longitude + 540) % 360) - 180;
  const roots: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    const a = samples[index - 1]!;
    const b = samples[index]!;
    let left = a.time;
    let right = b.time;
    let dl = delta(a.longitude);
    const dr = delta(b.longitude);
    // A sign change at the opposite longitude is not an aspect crossing.
    if (dl * dr > 0 || Math.abs(dl - dr) >= 180) continue;
    let valid = true;
    while (right - left > 1000) {
      const middle = (left + right) / 2;
      const longitude = longitudeAt(middle);
      if (longitude === null) { valid = false; break; }
      const dm = delta(longitude);
      if (dl * dm <= 0) right = middle;
      else { left = middle; dl = dm; }
    }
    const root = (left + right) / 2;
    if (valid && !roots.some((previous) => Math.abs(previous - root) < 2000)) roots.push(root);
  }
  return roots;
}
