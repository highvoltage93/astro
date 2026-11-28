import { AUTH_TOKEN_STORAGE_KEY } from "./auth-storage";

export type AccessSummary = { plan: "FREE" | "TRIAL" | "PRO"; endsAt: string | null; administrator: boolean;
  mode: "preview" | "enforced"; canWork: boolean; proposed: Record<string, boolean> };
export type Account = { user: { id: string; username: string; email: string; role: string; createdAt: string; lastLoginAt: string | null;
  _count: { birthProfiles: number; savedForecasts: number; consultations: number } };
  access: AccessSummary; trialDays: number; trialEnabled: boolean };
export type AccessSettings = { trialEnabled: boolean; trialDays: number; revision: number;
  enforcementEnabled: boolean; transitionDays: number; launchedAt: string | null };
export type AccessHistory = { access: AccessSummary; grantIds: string[]; history: { id: string; plan: "TRIAL" | "PRO"; source: string;
  reason: string; startsAt: string; endsAt: string; revokedAt: string | null; createdAt: string }[] };
export const planNames = { FREE: "Без активної підписки", TRIAL: "Trial", PRO: "Pro" };
export const membershipDate = (value: string) => new Date(value).toLocaleString("uk-UA");
export const accessEndDate = (value: string) => new Date(value).toLocaleString("uk-UA", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "Europe/Kyiv"
}) + " (Київ)";

export function accessTimeLeft(endsAt: string, now: number) {
  const milliseconds = Date.parse(endsAt) - now;
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "Строк завершився";
  const hours = Math.ceil(milliseconds / 3600000);
  if (hours < 24) return hours === 1 ? "Залишилося до 1 год" : `Залишилося ${hours} год`;
  const days = Math.floor(hours / 24), remainder = hours % 24;
  return `Залишилося ${days} дн${remainder ? ` ${remainder} год` : ""}`;
}

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
