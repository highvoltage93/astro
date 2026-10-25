import assert from "node:assert/strict";
import test from "node:test";
import { registrationPasswordError as serverError } from "../src/auth/password-policy";
import { registrationPasswordError as browserError } from "../../web/src/lib/password-policy";

test("registration requires length and all character categories on both sides", () => {
  const cases: [string, boolean][] = [
    ["admin", false],
    ["Short1!", false],
    ["Short12!", true],
    ["longpassword1!", false],
    ["LONGPASSWORD1!", false],
    ["LongPassword!!", false],
    ["LongPassword12", false],
    ["LongPassword1 ", false],
    ["LongPassword1!", true],
    ["ДовгийПароль1!", true],
    ["A" + "a".repeat(124) + "1!", true],
    ["A" + "a".repeat(125) + "1!", true],
    ["A" + "a".repeat(126) + "1!", false],
    [" Long Password1! ", true]
  ];
  for (const [password, valid] of cases) {
    assert.equal(serverError(password) === null, valid);
    assert.equal(browserError(password), serverError(password));
  }
});
