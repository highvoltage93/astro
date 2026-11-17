import { AUTH_TOKEN_STORAGE_KEY } from "./auth-storage";

export type AccessSummary = { plan: "FREE" | "TRIAL" | "PRO"; endsAt: string | null; administrator: boolean;
  mode: "preview"; proposed: Record<string, boolean> };
export type Account = { user: { id: string; username: string; email: string; role: string; createdAt: string; lastLoginAt: string | null;
  _count: { birthProfiles: number; savedForecasts: number; consultations: number } };
  access: AccessSummary; trialDays: number; trialEnabled: boolean };
export type AccessSettings = { trialEnabled: boolean; trialDays: number; revision: number };
export type AccessHistory = { access: AccessSummary; history: { id: string; plan: "TRIAL" | "PRO"; source: string;
  reason: string; startsAt: string; endsAt: string; revokedAt: string | null; createdAt: string }[] };
export const planNames = { FREE: "Free", TRIAL: "Trial", PRO: "Pro" };
export const membershipDate = (value: string) => new Date(value).toLocaleString("uk-UA");

export class MembershipError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function membershipRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) throw new MembershipError("Увійдіть до акаунта.", 401);
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${path}`, {
    ...options, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  });
  const body = await response.json();
  if (!response.ok) throw new MembershipError(body.message ?? "Не вдалося виконати запит.", response.status);
  return body as T;
}
