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

test("weights include the ascendant and both nodes, but not Lilith or Chiron", () => {
  const points = Object.keys(signatureFieldWeights).map((key) => ({ key, house: 1 }));
  const result = calculateSignatureFields([...points, { key: "lilith", house: 7 }, { key: "chiron", house: 8 }, { key: "mc", house: 10 }]);
  assert.equal(result.total, 16);
  assert.equal(result.dayNight[0]?.score, 16);
  assert.equal(result.dayNight[1]?.score, 0);
  assert.equal(calculateSignatureFields([{ key: "asc", house: 1 }]).total, 1.5);
  assert.equal(calculateSignatureFields([{ key: "north-node", house: 3 }, { key: "south-node", house: 9 }]).total, 1);
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
