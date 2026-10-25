"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Pencil, RefreshCw, Save, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";

type Role = "USER" | "CONSULTANT" | "ADMIN";
type User = { id: string; username: string; email: string; role: Role; createdAt: string; updatedAt: string;
  lastLoginAt: string | null; lastActiveAt: string | null;
  _count: { birthProfiles: number; savedForecasts: number; consultations: number } };
type UserList = { users: User[]; total: number; page: number; pageSize: number };
type Audit = { id: string; action: string; entityId: string | null; createdAt: string; user: { username: string } | null };
const roles: Record<Role, string> = { USER: "Користувач", CONSULTANT: "Консультант", ADMIN: "Адміністратор" };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const date = (value: string) => new Date(value).toLocaleString("uk-UA");

class AdminError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) throw new AdminError("Увійдіть до акаунта адміністратора.", 401);
  const response = await fetch(`${apiUrl}/admin${path}`, {
    ...options, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  });
  const body = await response.json();
  if (!response.ok) throw new AdminError(body.message ?? "Не вдалося виконати запит.", response.status);
  return body as T;
}

export default function AdminPage() {
  const [list, setList] = useState<UserList | null>(null);
  const [events, setEvents] = useState<Audit[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function handleError(failure: unknown) {
    setError(failure instanceof Error ? failure.message : "Помилка з'єднання.");
    if (failure instanceof AdminError && (failure.status === 401 || failure.status === 403)) {
      setList(null); setEvents([]); setEditing(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    Promise.all([
      request<UserList>(`/users?search=${encodeURIComponent(query)}&page=${page}`, { signal: controller.signal }),
      request<{ events: Audit[] }>("/audit", { signal: controller.signal })
    ]).then(([users, audit]) => {
      if (!controller.signal.aborted) { setList(users); setEvents(audit.events); }
    }).catch((failure: unknown) => { if (!controller.signal.aborted) handleError(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, page, revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    const original = list?.users.find((user) => user.id === editing.id);
    if (original && original.role !== editing.role && !window.confirm(`Змінити роль ${editing.username} на «${roles[editing.role]}»?`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { username, email, role, updatedAt } = editing;
      await request(`/users/${encodeURIComponent(editing.id)}`, { method: "PATCH", body: JSON.stringify({ username, email, role, updatedAt }) });
      setEditing(null); setNotice("Зміни збережено."); setRevision((value) => value + 1);
    } catch (failure) { handleError(failure); }
    finally { setSaving(false); }
  }

  return <main className="app-shell-background min-h-screen p-3 sm:p-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs text-primary">ZORIA ASTROPROCESSOR</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><ShieldCheck />Адміністрування</h1></div>
        <Button variant="outline" disabled={loading || saving} onClick={() => { setEditing(null); setRevision((value) => value + 1); }}><RefreshCw className={loading ? "animate-spin" : ""} />Оновити</Button>
      </header>
      {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="text-primary">{notice}</p> : null}
      {loading ? <p role="status" className="text-muted-foreground">Завантаження…</p> : null}
      {!loading && !list ? <Button asChild variant="secondary"><a href="/login">Увійти</a></Button> : null}
      {editing ? <Card>
        <CardHeader><CardTitle>Редагування користувача</CardTitle></CardHeader>
        <CardContent><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="admin-username">Username</Label><Input id="admin-username" required minLength={3} maxLength={50} value={editing.username} disabled={saving} onChange={(e) => setEditing({ ...editing, username: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" required type="email" maxLength={160} value={editing.email} disabled={saving} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="admin-role">Роль</Label><Select value={editing.role} disabled={saving} onValueChange={(role: Role) => setEditing({ ...editing, role })}><SelectTrigger id="admin-role"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(roles).map(([role, label]) => <SelectItem key={role} value={role}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex flex-wrap items-end gap-2"><Button type="submit" disabled={saving}>{saving ? <RefreshCw className="animate-spin" /> : <Save />}Зберегти</Button><Button type="button" variant="secondary" disabled={saving} onClick={() => setEditing(null)}><X />Скасувати</Button></div>
        </form></CardContent>
      </Card> : null}
      {list ? <Card>
        <CardHeader><CardTitle>Користувачі ({list.total})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setEditing(null); setPage(1); setQuery(search.trim()); setRevision((value) => value + 1); }}>
            <Input aria-label="Пошук за username або email" placeholder="Username або email" maxLength={160} value={search} disabled={saving} onChange={(e) => setSearch(e.target.value)} />
            <Button type="submit" size="icon" title="Знайти" aria-label="Знайти" disabled={loading || saving}><Search /></Button>
          </form>
          <Table><TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Email</TableHead><TableHead>Роль</TableHead><TableHead>Створено</TableHead><TableHead>Останній вхід</TableHead><TableHead title="Останній авторизований запит до API, точність до хвилини">Остання активність</TableHead><TableHead>Карти</TableHead><TableHead>Прогнози</TableHead><TableHead>Консультації</TableHead><TableHead><span className="sr-only">Дії</span></TableHead></TableRow></TableHeader>
            <TableBody>{list.users.map((user) => <TableRow key={user.id}>
              <TableCell>{user.username}</TableCell><TableCell>{user.email}</TableCell><TableCell className="whitespace-nowrap">{roles[user.role]}</TableCell><TableCell className="whitespace-nowrap">{date(user.createdAt)}</TableCell>
              <TableCell className="whitespace-nowrap">{user.lastLoginAt ? date(user.lastLoginAt) : "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{user.lastActiveAt ? date(user.lastActiveAt) : "—"}</TableCell>
              <TableCell>{user._count.birthProfiles}</TableCell><TableCell>{user._count.savedForecasts}</TableCell><TableCell>{user._count.consultations}</TableCell>
              <TableCell><Button variant="ghost" size="icon" aria-label={`Редагувати ${user.username}`} title="Редагувати" disabled={loading || saving} onClick={() => { setEditing(user); setError(""); setNotice(""); }}><Pencil /></Button></TableCell>
            </TableRow>)}</TableBody></Table>
          {!list.users.length ? <p className="text-sm text-muted-foreground">Користувачів не знайдено.</p> : null}
          <div className="flex items-center justify-end gap-3 text-sm"><Button size="icon" variant="secondary" title="Попередня сторінка" aria-label="Попередня сторінка" disabled={page <= 1 || loading || saving} onClick={() => { setEditing(null); setPage(page - 1); }}><ChevronLeft /></Button><span>{list.page} / {Math.max(1, Math.ceil(list.total / list.pageSize))}</span><Button size="icon" variant="secondary" title="Наступна сторінка" aria-label="Наступна сторінка" disabled={page * list.pageSize >= list.total || loading || saving} onClick={() => { setEditing(null); setPage(page + 1); }}><ChevronRight /></Button></div>
        </CardContent>
      </Card> : null}
      {list ? <Card><CardHeader><CardTitle>Останні 50 адміністративних змін</CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Дата</TableHead><TableHead>Хто</TableHead><TableHead>Дія</TableHead><TableHead>ID користувача</TableHead></TableRow></TableHeader><TableBody>{events.map((event) => <TableRow key={event.id}><TableCell className="whitespace-nowrap">{date(event.createdAt)}</TableCell><TableCell>{event.user?.username ?? "Серверна команда"}</TableCell><TableCell>{event.action === "admin.user.promote-cli" ? "Призначення адміністратора" : "Редагування користувача"}</TableCell><TableCell className="break-all">{event.entityId}</TableCell></TableRow>)}</TableBody></Table>
        {!events.length ? <p className="text-sm text-muted-foreground">Змін ще немає.</p> : null}
      </CardContent></Card> : null}
    </div>
  </main>;
}
