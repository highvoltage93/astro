import assert from "node:assert/strict";
import test from "node:test";
import { accessEndDate, accessTimeLeft } from "../../web/src/lib/membership";

test("trial countdown handles days, final hours and the exact expiry boundary", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  assert.equal(accessTimeLeft("2026-12-01T12:00:00Z", now), "Залишилося 7 дн");
  assert.equal(accessTimeLeft("2026-11-26T13:00:00Z", now), "Залишилося 2 дн 1 год");
  assert.equal(accessTimeLeft("2026-11-24T13:30:00Z", now), "Залишилося 2 год");
  assert.equal(accessTimeLeft("2026-11-24T12:01:00Z", now), "Залишилося до 1 год");
  assert.equal(accessTimeLeft("2026-11-24T12:00:00Z", now), "Строк завершився");
  assert.equal(accessTimeLeft("invalid", now), "Строк завершився");
});

test("access deadline identifies Kyiv timezone and includes the exact minute", () => {
  const formatted = accessEndDate("2026-11-24T12:34:00Z");
  assert.ok(formatted.includes("24.11.2026"));
  assert.ok(formatted.includes("14:34"));
  assert.ok(formatted.endsWith("(Київ)"));
});
