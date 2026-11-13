import assert from "node:assert/strict";
import { test } from "node:test";
import { displayBirthDate, displayBirthTime, parseBirthDateText, parseBirthTimeText } from "../../web/src/lib/birth-input";

test("birth date accepts Ukrainian text, numeric mobile input and existing ISO values", () => {
  for (const input of ["20.06.1997", "20061997", "1997-06-20", " 20.06.1997 "]) {
    assert.equal(parseBirthDateText(input), "1997-06-20");
    assert.equal(displayBirthDate(input), "20.06.1997");
  }
  assert.equal(parseBirthDateText("01.01.0001"), "0001-01-01");
  assert.equal(parseBirthDateText("31.12.9999"), "9999-12-31");
});

test("invalid dates and incomplete input cannot silently roll into another month", () => {
  for (const input of ["", "20", "20.06.", "2006199", "31.04.1997", "29.02.1900", "29.02.2025", "00.01.2026", "01.13.2026", "01.01.0000", "2026-02-30", "1997-06-20T00:00:00Z", "20/06/1997"]) {
    assert.equal(parseBirthDateText(input), null, input);
  }
  assert.equal(parseBirthDateText("29.02.2000"), "2000-02-29");
  assert.equal(parseBirthDateText("29.02.2024"), "2024-02-29");
});

test("birth time keeps seconds and normalizes existing minute-only times", () => {
  for (const input of ["12:00:18", "120018", " 12:00:18 "]) {
    assert.equal(parseBirthTimeText(input), "12:00:18");
    assert.equal(displayBirthTime(input), "12:00:18");
  }
  assert.equal(parseBirthTimeText("04:32:57"), "04:32:57");
  assert.equal(parseBirthTimeText("043257"), "04:32:57");
  assert.equal(parseBirthTimeText("09:15"), "09:15:00");
  assert.equal(parseBirthTimeText("0915"), "09:15:00");
  assert.equal(displayBirthTime("09:15"), "09:15:00");
  assert.equal(parseBirthTimeText("000000"), "00:00:00");
  assert.equal(parseBirthTimeText("235959"), "23:59:59");
});

test("invalid times and partial seconds never reuse or round previous values", () => {
  for (const input of ["", "1", "123", "12001", "12:00:", "12:00:1", "24:00:00", "12:60:00", "12:00:60", "-1:00:00", "12:00:18Z", "1200180", "4:32:57"]) {
    assert.equal(parseBirthTimeText(input), null, input);
  }
});

test("display conversion roundtrips without changing a local birth date or seconds", () => {
  for (const value of ["1990-02-14", "1997-06-20", "2000-02-29", "2026-10-25"]) {
    assert.equal(parseBirthDateText(displayBirthDate(value)), value);
    assert.equal(displayBirthDate(displayBirthDate(value)), displayBirthDate(value));
  }
  for (const value of ["00:00:00", "04:32:57", "12:00:18", "23:59:59"]) {
    assert.equal(parseBirthTimeText(displayBirthTime(value)), value);
  }
});
