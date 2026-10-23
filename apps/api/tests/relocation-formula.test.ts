import assert from "node:assert/strict";
import { test } from "node:test";
import { relocationFormula } from "../../../packages/astrology-core/src/relocation-formula";

test("only changed original responsibilities have a subscript", () => {
  assert.equal(relocationFormula({ placement: 5, ruled: [11] }, { placement: 4, ruled: [10] }), "4₀ 5 (10₀ 11)");
  assert.equal(relocationFormula({ placement: 4, ruled: [11] }, { placement: 4, ruled: [10] }), "4 (10₀ 11)");
  assert.equal(relocationFormula({ placement: 5, ruled: [10] }, { placement: 4, ruled: [10] }), "4₀ 5 (10)");
});

test("unchanged location or responsibilities do not add zeros or duplicates", () => {
  const value = { placement: 4, ruled: [10, 10, 11] };
  assert.equal(relocationFormula(value, value), "4 (10 10 11)");
  assert.equal(relocationFormula(value), "4 (10 10 11)");
});

test("rulership multiplicity is preserved when only some occurrences change", () => {
  assert.equal(relocationFormula({ placement: 4, ruled: [5, 6] }, { placement: 4, ruled: [5, 5] }), "4 (5₀ 5 6)");
  assert.equal(relocationFormula({ placement: 4, ruled: [5, 5] }, { placement: 4, ruled: [5] }), "4 (5 5)");
  assert.equal(relocationFormula({ placement: 4, ruled: [] }, { placement: 4, ruled: [10] }), "4 (10₀)");
});
