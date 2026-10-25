import { AUTH_TOKEN_STORAGE_KEY } from "./auth-storage";

export const feedbackStatuses = { NEW: "Нове", IN_PROGRESS: "В роботі", RESOLVED: "Вирішено" } as const;
export type FeedbackStatus = keyof typeof feedbackStatuses;
export type FeedbackReport = {
  id: string; userId: string; authorUsername: string; authorEmail: string;
  title: string; description: string; pagePath: string; status: FeedbackStatus;
  createdAt: string; updatedAt: string; user: { username: string; email: string };
};
export type FeedbackList = { reports: FeedbackReport[]; total: number; page: number; pageSize: number };
export class FeedbackError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function feedbackRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) throw new FeedbackError("Увійдіть до акаунта.", 401);
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${path}`, {
    ...options, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new FeedbackError(body?.message ?? "Не вдалося виконати запит. Спробуйте ще раз.", response.status);
  return body as T;
}
