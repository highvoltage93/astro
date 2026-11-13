import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateSignatureFields, signatureFieldWeights } from "../../web/src/lib/signature-fields";

test("every house belongs to exactly one field in each partition", () => {
  for (let house = 1; house <= 12; house++) {
    const result = calculateSignatureFields([{ key: "sun", house }]);
    assert.equal(result.total, 2);
    assert.equal(result.dayNight[house <= 6 ? 0 : 1]?.score, 2);
    assert.equal(result.eastWest[house <= 3 || house >= 10 ? 0 : 1]?.score, 2);
    assert.equal(result.quadrants[Math.floor((house - 1) / 3)]?.score, 2);
    for (const rows of [result.dayNight, result.eastWest, result.quadrants]) {
      assert.equal(rows.reduce((total, row) => total + row.score, 0), result.total);
    }
  }
});

test("field weights include both nodes but exclude ASC, Lilith, Chiron and other angles", () => {
  const points = Object.keys(signatureFieldWeights).map((key) => ({ key, house: 1 }));
  const result = calculateSignatureFields([...points, { key: "asc", house: 1 }, { key: "lilith", house: 7 }, { key: "chiron", house: 8 }, { key: "mc", house: 10 }]);
  assert.equal(result.total, 14.5);
  assert.equal(result.dayNight[0]?.score, 14.5);
  assert.equal(result.dayNight[1]?.score, 0);
  assert.equal(calculateSignatureFields([{ key: "asc", house: 1 }]).total, 0);
  assert.equal(calculateSignatureFields([{ key: "north-node", house: 3 }, { key: "south-node", house: 9 }]).total, 1);
});

test("ASC never changes any partition, percentage denominator or unassigned weight", () => {
  const points = [{ key: "sun", house: 2 }, { key: "moon", house: 8 }, { key: "mercury" }];
  const expected = calculateSignatureFields(points);
  for (const house of [undefined, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) {
    assert.deepEqual(calculateSignatureFields([...points, { key: "asc", house }]), expected);
    assert.deepEqual(calculateSignatureFields([{ key: "asc", house }]), calculateSignatureFields([]));
  }
  for (const rows of [expected.dayNight, expected.eastWest, expected.quadrants]) {
    assert.equal(rows.reduce((total, row) => total + row.score, 0), expected.total);
  }
});

test("missing houses are excluded without inventing placements and duplicates are not counted twice", () => {
  const result = calculateSignatureFields([
    { key: "sun" }, { key: "moon", house: 0 }, { key: "mars", house: 13 },
    { key: "venus", house: 2.5 }, { key: "saturn", house: 10 }, { key: "saturn", house: 10 }
  ]);
  assert.equal(result.total, 1);
  assert.equal(result.unassigned, 7);
  assert.equal(result.quadrants[3]?.score, 1);
  assert.equal(calculateSignatureFields([]).total, 0);
});
