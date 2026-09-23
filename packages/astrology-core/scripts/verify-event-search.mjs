import assert from "node:assert/strict";
import { angularEventCrossing, refineEventRoot, searchAstronomicalEvents } from "../dist/index.js";

assert.equal(refineEventRoot(() => 2, 0, 10000), null);
assert.equal(refineEventRoot((time) => time, 0, 10000), 0);
assert.ok(Math.abs(refineEventRoot((time) => time - 4321, 0, 10000) - 4321) <= 500);
assert.ok(Math.abs(refineEventRoot((time) => 4321 - time, 0, 10000) - 4321) <= 500);
assert.throws(() => refineEventRoot(() => NaN, 0, 10000));
const forward = (time) => (359 + time / 5000) % 360;
const backward = (time) => (361 - time / 5000) % 360;
assert.ok(Math.abs(angularEventCrossing(forward, 0, 0, 10000) - 5000) <= 500);
assert.ok(Math.abs(angularEventCrossing(backward, 0, 0, 10000) - 5000) <= 500);
assert.equal(angularEventCrossing((time) => 179 + time / 5000, 0, 0, 10000), null);
assert.equal(angularEventCrossing((time) => 20 + time / 10000, 30, 0, 10000), null);

const natal = { birthDate: "1990-01-01", birthTime: "12:00:00", birthTimeKnown: true, timezone: "UTC", latitude: 50.45, longitude: 30.52, houseSystem: "koch", zodiac: "tropical", ephemerisPath: process.env.SWISSEPH_EPHE_PATH };
assert.throws(() => searchAstronomicalEvents({ natal, from: "2024-01-01T00:00:00Z", until: "2025-01-01T00:00:00Z", kinds: ["ingress"], planets: ["sun"], aspectOrb: 1 }));
// Integration checks exercise the installed Swiss Ephemeris, without asserting external reference precision.
const input = { natal, from: "2024-04-01T00:00:00Z", until: "2024-05-01T00:00:00Z", kinds: ["ingress", "station", "new-moon", "full-moon", "solar-eclipse", "lunar-eclipse"], planets: ["sun", "moon", "mercury"], aspectOrb: 1 };
const result = searchAstronomicalEvents(input);
assert.equal(result.events.filter((event) => event.kind === "new-moon").length, 1);
assert.equal(result.events.filter((event) => event.kind === "full-moon").length, 1);
assert.equal(result.events.filter((event) => event.kind === "ingress" && event.pointKey === "sun").length, 1);
assert.equal(new Set(result.events.map((event) => event.id)).size, result.events.length);
assert.ok(result.events.every((event) => event.exactAt >= result.from && event.exactAt < result.until));
assert.ok(result.events.every((event) => event.natalAspects.every((aspect) => aspect.orb <= 1)));
const midpoint = "2024-04-16T00:00:00Z";
const split = [...searchAstronomicalEvents({ ...input, until: midpoint }).events, ...searchAstronomicalEvents({ ...input, from: midpoint }).events];
assert.deepEqual(split.map((event) => event.id), result.events.map((event) => event.id));
console.log("Event search checks passed");
