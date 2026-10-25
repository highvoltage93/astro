import assert from "node:assert/strict";
import test from "node:test";
import { feedbackInput, feedbackQuery, feedbackUpdate } from "../src/feedback/schema";

const valid = { requestId: "cc6a26c2-bbe7-4d92-a4ba-216b922ca7e7", title: "Помилка карти", description: "Після натискання кнопки карта не відкрилася.", pagePath: "/workspace" };

test("feedback validates lengths and rejects client-supplied identity", () => {
  assert.equal(feedbackInput.safeParse(valid).success, true);
  for (const change of [
    { title: "  " }, { title: "x".repeat(161) }, { description: "short" },
    { description: "x".repeat(5001) }, { userId: "someone-else" },
    { authorEmail: "fake@example.com" }, { status: "RESOLVED" }, { requestId: "invalid" }
  ]) assert.equal(feedbackInput.safeParse({ ...valid, ...change }).success, false);
});

test("feedback never accepts full URLs or query strings", () => {
  for (const pagePath of ["https://example.com", "/workspace?token=secret", "/consultations?id=private", "/workspace#secret", "//example.com"]) {
    assert.equal(feedbackInput.safeParse({ ...valid, pagePath }).success, false);
  }
});

test("admin filters and updates are bounded and status-only", () => {
  assert.deepEqual(feedbackQuery.parse({}), { page: 1 });
  assert.equal(feedbackQuery.safeParse({ page: 0 }).success, false);
  assert.equal(feedbackQuery.safeParse({ status: "UNKNOWN" }).success, false);
  const update = { status: "RESOLVED", updatedAt: "2026-10-25T12:00:00.000Z" };
  assert.equal(feedbackUpdate.safeParse(update).success, true);
  assert.equal(feedbackUpdate.safeParse({ ...update, description: "edited" }).success, false);
  assert.equal(feedbackUpdate.safeParse({ status: "RESOLVED" }).success, false);
});
