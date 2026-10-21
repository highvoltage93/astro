import assert from "node:assert/strict";
import { test } from "node:test";
import { DateTime } from "luxon";
import { progressionCalendarWindow } from "../../../packages/astrology-core/src/progression-calendar-window";

test("selected future and historical dates determine the entire calendar year window", () => {
  for (const [start, end] of [["2032-01-01", "2033-01-01"], ["2010-06-20", "2011-06-20"]]) {
    const window = progressionCalendarWindow(DateTime.fromISO(`${start}T12:00:00`, { zone: "Europe/Kyiv" }));
    assert.equal(window.start.setZone(window.timezone).toISODate(), start);
    assert.equal(window.end.setZone(window.timezone).toISODate(), end);
  }
});

test("rolling year uses today's Kyiv date, independent of server timezone", () => {
  const window = progressionCalendarWindow(DateTime.fromISO("2026-10-20T22:30:00Z"));
  assert.equal(window.start.setZone(window.timezone).toISODate(), "2026-10-21");
  assert.equal(window.end.setZone(window.timezone).toISODate(), "2027-10-21");
  assert.equal(window.start.setZone(window.timezone).hour, 0);
});

test("calendar year includes leap day and clamps February 29", () => {
  const start = progressionCalendarWindow(DateTime.fromISO("2023-03-01T12:00:00Z"));
  assert.equal(start.end.diff(start.start, "days").days, 366);
  const leap = progressionCalendarWindow(DateTime.fromISO("2024-02-29T12:00:00Z"));
  assert.equal(leap.end.setZone(leap.timezone).toISODate(), "2025-02-28");
});
