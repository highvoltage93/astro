import { AUTH_TOKEN_STORAGE_KEY } from "./auth-storage";

export type Role = "USER" | "CONSULTANT" | "ADMIN";
export type AdminUser = { id: string; username: string; email: string; role: Role; createdAt: string; updatedAt: string;
  lastLoginAt: string | null; lastActiveAt: string | null; sharedKnowledgeUntil: string | null;
  _count: { birthProfiles: number; savedForecasts: number; consultations: number } };
export const roles: Record<Role, string> = { USER: "Користувач", CONSULTANT: "Консультант", ADMIN: "Адміністратор" };
export const adminDate = (value: string) => new Date(value).toLocaleString("uk-UA");
export class AdminError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) throw new AdminError("Увійдіть до акаунта адміністратора.", 401);
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/admin${path}`, {
    ...options, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  });
  const body = await response.json();
  if (!response.ok) throw new AdminError(body.message ?? "Не вдалося виконати запит.", response.status);
  return body as T;
}
export function adminListFilters(params: { get(name: string): string | null }) {
  const search = (params.get("search") ?? "").slice(0, 160);
  const role = params.get("role");
  const roleFilter: Role | "ALL" = role === "USER" || role === "CONSULTANT" || role === "ADMIN" ? role : "ALL";
  const value = Number(params.get("page") ?? 1);
  const page = Number.isInteger(value) && value >= 1 && value <= 100000 ? value : 1;
  return { search, roleFilter, page };
}
export function adminListQuery(search: string, role: Role | "ALL", page: number) {
  return new URLSearchParams({ ...(search ? { search } : {}), ...(role !== "ALL" ? { role } : {}), page: String(page) }).toString();
}
