import { DateTime } from "luxon";

export const progressionCalendarWindow = (selectedDate: DateTime = DateTime.now(), timezone = "Europe/Kyiv") => {
  const start = selectedDate.setZone(timezone).startOf("day");
  if (!start.isValid) throw new Error("Invalid progression timezone");
  return { start: start.toUTC(), end: start.plus({ years: 1 }).toUTC(), timezone };
};
