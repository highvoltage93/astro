import type { Consultation } from "@prisma/client";
import { z } from "zod";
import { consultationContentSchema } from "@astroprocessor/consultation-format";

const sourceSchema = z.object({
  displayName: z.string(), birthplaceName: z.string(), birthDate: z.string(),
  birthTime: z.string().nullable(), birthTimeKnown: z.boolean(), timezone: z.string(),
  calculatedAt: z.string(),
  chart: z.object({ settings: z.object({ houseSystem: z.string(), zodiac: z.string() }) })
});

// Build an explicit client-safe projection: never spread a consultation or its source JSON.
export function clientDocument(record: Pick<Consultation,
  "id" | "title" | "status" | "revision" | "updatedAt" | "contentJson" | "sourceSnapshotJson">) {
  const source = sourceSchema.parse(record.sourceSnapshotJson);
  return {
    id: record.id, title: record.title, status: record.status, revision: record.revision,
    updatedAt: record.updatedAt, content: consultationContentSchema.parse(record.contentJson),
    source: {
      displayName: source.displayName, birthplaceName: source.birthplaceName, birthDate: source.birthDate,
      birthTime: source.birthTimeKnown ? source.birthTime : null, birthTimeKnown: source.birthTimeKnown,
      timezone: source.timezone, calculatedAt: source.calculatedAt,
      houseSystem: source.chart.settings.houseSystem, zodiac: source.chart.settings.zodiac
    }
  };
}
