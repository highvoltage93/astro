import { plainTextToRich, richBody, consultationContentSchema } from "@astroprocessor/consultation-format";
import type { ConsultationContent } from "@astroprocessor/consultation-format";
import type { ChartResult } from "./chart-types";
import { planetLabelsUk, signLabelsUk, aspectLabels } from "./astrology-labels";

export type ConsultationFact = { id: string; category: "placements" | "aspects"; text: string };
const planetOrder = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const pointOrder = [...planetOrder, "north-node", "south-node", "chiron", "lilith", "asc", "desc", "ic", "mc"];
const degree = (value: number) => {
  if (!Number.isFinite(value) || value < 0 || value >= 30) return "градус не визначено";
  const seconds = Math.min(107999, Math.floor(value * 3600 + 0.000001));
  return `${Math.floor(seconds / 3600)}°${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}′${String(seconds % 60).padStart(2, "0")}″`;
};

export function consultationFacts(chart: ChartResult): ConsultationFact[] {
  const points = [...chart.bodies, ...chart.angles].filter((point) => pointOrder.includes(point.key))
    .sort((a, b) => pointOrder.indexOf(a.key) - pointOrder.indexOf(b.key));
  const placements: ConsultationFact[] = points.map((point) => {
    const houses = chart.planetRulerships?.find((ruler) => ruler.pointKey === point.key)?.houses ?? [];
    const motion = point.speed === undefined || ["asc", "desc", "ic", "mc"].includes(point.key) ? "" :
      Math.abs(point.speed) < 0.0001 ? "; рух стаціонарний" : point.speed < -0.0001 ? "; рух ретроградний" : "; рух директний";
    return { id: `point:${point.key}`, category: "placements",
      text: `${planetLabelsUk[point.key]}: ${signLabelsUk[point.sign] ?? point.sign} ${degree(point.signDegree)}` +
        (point.house ? `; дім ${point.house}` : "") + motion +
        (houses.length ? `; править домами: ${[...new Set(houses)].sort((a, b) => a - b).join(", ")}` : "") + "." };
  });
  const aspects: ConsultationFact[] = chart.aspects.filter((aspect) => planetOrder.includes(aspect.bodyA) && planetOrder.includes(aspect.bodyB))
    .map((aspect, index) => ({ id: `aspect:${index}:${aspect.bodyA}:${aspect.bodyB}:${aspect.type}`, category: "aspects",
      text: `${planetLabelsUk[aspect.bodyA]} — ${planetLabelsUk[aspect.bodyB]}: ${aspectLabels[aspect.type] ?? aspect.type}; ` +
        `кут аспекту ${aspect.exactAngle}°; орбіс ${aspect.orb.toFixed(4)}°.` }));
  return [...placements, ...aspects];
}

export function appendConsultationFacts(content: ConsultationContent, target: string, lines: string[], newId: string): ConsultationContent {
  if (!lines.length) throw new Error("Вибери дані для вставлення.");
  const body = plainTextToRich(lines.join("\n"));
  const sections = content.sections.map((section) => ({ ...section }));
  if (target === "new") sections.push({ id: newId, title: "Дані натальної карти", body });
  else {
    const index = sections.findIndex((section) => section.id === target);
    const section = sections[index];
    if (!section) throw new Error("Розділ більше не існує. Вибери інший.");
    sections[index] = { ...section, body: { type: "doc", content: [...richBody(section.body).content, ...body.content] } };
  }
  const parsed = consultationContentSchema.safeParse({ version: 2, sections });
  if (!parsed.success) throw new Error("Дані не вставлено: перевищено ліміт розділів або розмір документа.");
  return parsed.data;
}
