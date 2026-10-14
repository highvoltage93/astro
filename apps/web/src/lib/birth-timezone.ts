import { DateTime } from "luxon";

export function birthTimezoneOffsetHours(date: string, time: string, known: boolean, zone: string): number | null {
  const local = DateTime.fromISO(`${date}T${known ? time : "12:00:00"}`, { zone });
  return local.isValid ? local.offset / 60 : null;
}

export function fixedTimezoneFromHours(value: string): string | null {
  const text = value.trim().replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const hours = Number(text);
  const minutes = Math.round(hours * 60);
  if (!Number.isFinite(hours) || hours < -12 || hours > 14 || Math.abs(hours * 60 - minutes) > 0.000001) return null;
  const absolute = Math.abs(minutes);
  return `UTC${minutes < 0 ? "-" : "+"}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
