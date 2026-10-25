import { z } from "zod";

export const feedbackStatus = z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]);
export const feedbackInput = z.object({
  requestId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  // Never persist query strings, share tokens, chart IDs or arbitrary external URLs.
  pagePath: z.enum(["/", "/workspace", "/consultations", "/admin", "/login"])
}).strict();

export const feedbackQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  status: feedbackStatus.optional()
});
export const feedbackUpdate = z.object({ status: feedbackStatus, updatedAt: z.string().datetime() }).strict();
