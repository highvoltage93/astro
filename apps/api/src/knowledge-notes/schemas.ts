import { z } from "zod";

const planet = z.enum(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "lilith", "north-node", "south-node"]);
const condition = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("house"), planet, house: z.number().int().min(1).max(12) }).strict(),
  z.object({ kind: z.literal("sign"), planet, sign: z.enum(["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]) }).strict(),
  z.object({ kind: z.literal("aspect"), planet, otherPlanet: planet, aspect: z.enum(["conjunction", "sextile", "square", "trine", "opposition"]) }).strict(),
  z.object({ kind: z.literal("retrograde"), planet }).strict()
]);
export const noteConditionsSchema = z.object({ version: z.literal(1), scope: z.literal("natal"), match: z.literal("all"), items: z.array(condition).min(1).max(10) }).strict();
export const matchNotesSchema = z.object({
  chart: z.object({
    chartType: z.literal("natal"),
    birthTimeKnown: z.boolean(),
    bodies: z.array(z.object({
      key: z.string().min(1).max(32), sign: z.string().min(1).max(32),
      house: z.number().int().min(1).max(12).optional(), speed: z.number().finite().optional()
    }).strict()).max(32),
    aspects: z.array(z.object({
      bodyA: z.string().min(1).max(32), bodyB: z.string().min(1).max(32), type: z.string().min(1).max(32)
    }).strict()).max(1024)
  }).strict().refine((chart) => new Set(chart.bodies.map((body) => body.key)).size === chart.bodies.length, "Повторені об'єкти карти."),
  cursor: z.string().uuid().optional()
}).strict();

export const noteDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(20000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).transform((tags) => [...new Set(tags)]),
  conditions: noteConditionsSchema,
  archived: z.boolean()
}).strict().superRefine((draft, ctx) => {
  draft.conditions.items.forEach((item, index) => {
    if (item.kind === "aspect" && item.planet === item.otherPlanet) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["conditions", "items", index], message: "Оберіть дві різні планети." });
  });
});
export const createNoteSchema = z.object({ id: z.string().uuid(), draft: noteDraftSchema, sourceProfileId: z.string().cuid().optional() }).strict();
export const updateNoteSchema = z.object({ revision: z.number().int().positive(), draft: noteDraftSchema }).strict();
export const noteIdSchema = z.object({ id: z.string().uuid() });
export const noteListSchema = z.object({
  query: z.string().trim().max(160).default(""),
  status: z.enum(["active", "archived", "all"]).default("active"),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});
