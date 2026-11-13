import { calculateAstroCalendar, type AstroCalendarInput } from "@astroprocessor/astrology-core";

process.once("message", (input: AstroCalendarInput) => {
  try {
    const result = calculateAstroCalendar(input);
    process.send?.({ result }, () => process.exit(0));
  } catch (error) {
    process.send?.({ error: error instanceof Error ? error.message : "Не вдалося розрахувати події." }, () => process.exit(1));
  }
});
