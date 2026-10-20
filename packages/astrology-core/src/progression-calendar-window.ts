import { DateTime } from "luxon";

export const progressionCalendarWindow = (now: DateTime = DateTime.now()) => {
  const start = now.setZone("Europe/Kyiv").startOf("day");
  return { start: start.toUTC(), end: start.plus({ years: 1 }).toUTC(), timezone: "Europe/Kyiv" };
};
