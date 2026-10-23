type Responsibilities = { placement?: number; ruled: number[] };

export function relocationFormula(local: Responsibilities, original?: Responsibilities): string {
  const placements = original?.placement !== undefined && original.placement !== local.placement
    ? `${original.placement}₀ ${local.placement ?? "?"}` : `${local.placement ?? "?"}`;
  // Match occurrences, not just house numbers: independent rulerships remain counted.
  const remaining = new Map<number, number>();
  for (const house of local.ruled) remaining.set(house, (remaining.get(house) ?? 0) + 1);
  const changed: string[] = [];
  for (const house of original?.ruled ?? []) {
    const count = remaining.get(house) ?? 0;
    if (count > 0) remaining.set(house, count - 1);
    else changed.push(`${house}₀`);
  }
  const ruled = [...changed, ...local.ruled.map(String)];
  return `${placements}${ruled.length ? ` (${ruled.join(" ")})` : ""}`;
}
