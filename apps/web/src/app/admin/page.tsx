"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowUpRight, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminFeedback } from "@/components/admin-feedback";
import { AdminAccessSettings } from "@/components/admin-access";
import { adminDate as date, adminListFilters, adminListQuery, adminRequest as request, roles, type AdminUser, type Role } from "@/lib/admin-users";

type UserList = { users: AdminUser[]; total: number; page: number; pageSize: number };
type Audit = { id: string; action: string; entityId: string | null; createdAt: string; user: { username: string } | null };
const auditNames: Record<string, string> = { "admin.user.promote-cli": "Призначення адміністратора", "admin.feedback.status": "Зміна статусу звернення",
  "admin.user.update": "Редагування користувача", "admin.access.settings": "Налаштування Trial", "admin.access.grant": "Видача доступу", "admin.access.revoke": "Відкликання доступу" };

export default function AdminPage() {
  return <Suspense fallback={<p className="p-6" role="status">Завантаження…</p>}><AdminList /></Suspense>;
}
function AdminList() {
  const params = useSearchParams();
  const router = useRouter();
  const { search: query, roleFilter, page } = adminListFilters(params);
  const [search, setSearch] = useState(query);
  const [list, setList] = useState<UserList | null>(null);
  const [events, setEvents] = useState<Audit[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const listQuery = adminListQuery(query, roleFilter, page);
  const userHref = (id: string) => `/admin/users/${encodeURIComponent(id)}?${listQuery}`;
  function navigate(nextSearch: string, role: Role | "ALL", nextPage: number) {
    router.push(`/admin?${adminListQuery(nextSearch, role, nextPage)}`, { scroll: false });
  }
  useEffect(() => setSearch(query), [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    Promise.all([
      request<UserList>(`/users?${listQuery}`, { signal: controller.signal }),
      request<{ events: Audit[] }>("/audit", { signal: controller.signal })
    ]).then(([users, audit]) => {
      if (!controller.signal.aborted) { setList(users); setEvents(audit.events); }
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : "Помилка з'єднання."); setList(null); setEvents([]); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [listQuery, revision]);

  return <main className="app-shell-background min-h-screen p-3 sm:p-6"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs text-primary">ZORIA ASTROPROCESSOR</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><ShieldCheck />Адміністрування</h1></div>
      <Button variant="outline" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw className={loading ? "animate-spin" : ""} />Оновити</Button>
    </header>
    {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-destructive">{error}</p> : null}
    {loading ? <p role="status" className="text-muted-foreground">Завантаження…</p> : null}
    {!loading && !list ? <Button asChild variant="secondary"><Link href="/login?next=/admin">Увійти</Link></Button> : null}
    {list ? <Card><CardHeader><CardTitle>Користувачі ({list.total})</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); navigate(search.trim(), roleFilter, 1); setRevision((value) => value + 1); }}>
          <Input aria-label="Пошук за username або email" placeholder="Username або email" maxLength={160} value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button type="submit" size="icon" title="Знайти" aria-label="Знайти" disabled={loading}><Search /></Button>
        </form>
        <div className="space-y-2 sm:w-56"><Label htmlFor="admin-group-filter">Група</Label><Select value={roleFilter} onValueChange={(value: Role | "ALL") => navigate(query, value, 1)}><SelectTrigger id="admin-group-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Усі групи</SelectItem>{Object.entries(roles).map(([role, label]) => <SelectItem key={role} value={role}>{label}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="divide-y md:hidden">{list.users.map((user) => <article key={user.id} className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={userHref(user.id)} className="break-words font-semibold underline-offset-4 hover:underline">{user.username}</Link><p className="break-all text-sm text-muted-foreground">{user.email}</p><p className="mt-1 text-sm text-primary">{roles[user.role]}</p></div>
          <Button asChild variant="secondary" size="icon"><Link href={userHref(user.id)} aria-label={`Відкрити ${user.username}`} title="Деталі користувача"><ArrowUpRight /></Link></Button></div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm"><dt className="text-muted-foreground">Створено</dt><dd>{date(user.createdAt)}</dd><dt className="text-muted-foreground">Останній вхід</dt><dd>{user.lastLoginAt ? date(user.lastLoginAt) : "—"}</dd><dt className="text-muted-foreground">Активність</dt><dd>{user.lastActiveAt ? date(user.lastActiveAt) : "—"}</dd></dl>
      </article>)}</div>
      <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Email</TableHead><TableHead>Роль</TableHead><TableHead>Створено</TableHead><TableHead>Останній вхід</TableHead><TableHead>Остання активність</TableHead><TableHead><span className="sr-only">Дії</span></TableHead></TableRow></TableHeader>
        <TableBody>{list.users.map((user) => <TableRow key={user.id}><TableCell><Link href={userHref(user.id)} className="font-medium underline-offset-4 hover:underline">{user.username}</Link></TableCell><TableCell>{user.email}</TableCell><TableCell className="whitespace-nowrap">{roles[user.role]}</TableCell><TableCell className="whitespace-nowrap">{date(user.createdAt)}</TableCell><TableCell className="whitespace-nowrap">{user.lastLoginAt ? date(user.lastLoginAt) : "—"}</TableCell><TableCell className="whitespace-nowrap">{user.lastActiveAt ? date(user.lastActiveAt) : "—"}</TableCell>
          <TableCell><Button asChild variant="ghost" size="icon"><Link href={userHref(user.id)} aria-label={`Відкрити ${user.username}`} title="Деталі користувача"><ArrowUpRight /></Link></Button></TableCell></TableRow>)}</TableBody></Table></div>
      {!list.users.length ? <p className="text-sm text-muted-foreground">Користувачів не знайдено.</p> : null}
      <div className="flex items-center justify-end gap-3 text-sm"><Button size="icon" variant="secondary" title="Попередня сторінка" aria-label="Попередня сторінка" disabled={page <= 1 || loading} onClick={() => navigate(query, roleFilter, page - 1)}><ChevronLeft /></Button><span>{list.page} / {Math.max(1, Math.ceil(list.total / list.pageSize))}</span><Button size="icon" variant="secondary" title="Наступна сторінка" aria-label="Наступна сторінка" disabled={page * list.pageSize >= list.total || loading} onClick={() => navigate(query, roleFilter, page + 1)}><ChevronRight /></Button></div>
    </CardContent></Card> : null}
    {list ? <><AdminAccessSettings /><AdminFeedback onSaved={() => setRevision((value) => value + 1)} />
      <Card><CardHeader><CardTitle>Останні 50 адміністративних змін</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Дата</TableHead><TableHead>Хто</TableHead><TableHead>Дія</TableHead><TableHead>ID об’єкта</TableHead></TableRow></TableHeader><TableBody>{events.map((event) => <TableRow key={event.id}><TableCell className="whitespace-nowrap">{date(event.createdAt)}</TableCell><TableCell>{event.user?.username ?? "Серверна команда"}</TableCell><TableCell>{auditNames[event.action] ?? event.action}</TableCell><TableCell className="break-all">{event.entityId}</TableCell></TableRow>)}</TableBody></Table>{!events.length ? <p className="text-sm text-muted-foreground">Змін ще немає.</p> : null}</CardContent></Card>
    </> : null}
  </div></main>;
}
