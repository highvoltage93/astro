import type { z } from "zod";
import { matchNotesSchema, noteConditionsSchema } from "./schemas";

export type KnowledgeChartFacts = z.infer<typeof matchNotesSchema>["chart"];

// Compare the already-calculated natal facts; never recalculate houses or orbs here.
export function matchingConditions(input: unknown, chart: KnowledgeChartFacts) {
  const parsed = noteConditionsSchema.safeParse(input);
  if (!parsed.success || chart.chartType !== "natal") return null;
  const bodies = new Map(chart.bodies.map((body) => [body.key, body]));
  const matches = parsed.data.items.every((condition) => {
    const body = bodies.get(condition.planet);
    if (!body) return false;
    switch (condition.kind) {
      case "house": return chart.birthTimeKnown && body.house === condition.house;
      case "sign": return body.sign === condition.sign;
      case "retrograde": return typeof body.speed === "number" && Number.isFinite(body.speed) && body.speed < -0.0001;
      case "aspect": return condition.planet !== condition.otherPlanet && bodies.has(condition.otherPlanet) && chart.aspects.some((aspect) =>
        aspect.type === condition.aspect && (
          (aspect.bodyA === condition.planet && aspect.bodyB === condition.otherPlanet) ||
          (aspect.bodyB === condition.planet && aspect.bodyA === condition.otherPlanet)
        ));
    }
  });
  return matches ? parsed.data : null;
}
