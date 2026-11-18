"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import { ArrowLeft, RefreshCw, Save, ShieldCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminUserAccess } from "@/components/admin-access";
import { AdminError, adminDate as date, adminRequest, roles, type AdminUser, type Role } from "@/lib/admin-users";

const localExpiry = (value: string | null) => value ? DateTime.fromISO(value).setZone("Europe/Kyiv").toFormat("yyyy-MM-dd'T'HH:mm:ss") : "";

export function AdminUserDetails({ userId, backHref }: { userId: string; backHref: string }) {
  const [original, setOriginal] = useState<AdminUser | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [password, setPassword] = useState("");
  const [sharedUntil, setSharedUntil] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [needsLogin, setNeedsLogin] = useState(false);
  const dirty = Boolean(original && editing && (password || original.username !== editing.username || original.email !== editing.email ||
    original.role !== editing.role || localExpiry(original.sharedKnowledgeUntil) !== sharedUntil));
  const path = `/users/${encodeURIComponent(userId)}`;

  function accept(user: AdminUser) {
    setOriginal(user); setEditing(user); setPassword(""); setSharedUntil(localExpiry(user.sharedKnowledgeUntil));
  }
  function handleError(cause: unknown) {
    setError(cause instanceof Error ? cause.message : "Помилка з'єднання.");
    if (cause instanceof AdminError && [401, 403, 404].includes(cause.status)) {
      setOriginal(null); setEditing(null); setPassword(""); setNeedsLogin(cause.status === 401);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setNeedsLogin(false);
    void adminRequest<{ user: AdminUser }>(path, { signal: controller.signal })
      .then(({ user }) => { if (!controller.signal.aborted) accept(user); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) handleError(cause); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || !original || saving) return;
    const expiry = sharedUntil ? DateTime.fromISO(sharedUntil, { zone: "Europe/Kyiv" }) : null;
    if (expiry && !expiry.isValid) { setError("Перевірте дату завершення доступу до спостережень."); return; }
    if (original.role !== editing.role && !window.confirm(`Змінити роль ${editing.username} на «${roles[editing.role]}»?`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { username, email, role, updatedAt } = editing;
      const result = await adminRequest<{ user: AdminUser }>(path, { method: "PATCH", body: JSON.stringify({ username, email, role, updatedAt,
        sharedKnowledgeUntil: expiry?.toUTC().toISO() ?? null, ...(password ? { password } : {}) }) });
      accept(result.user); setNotice("Зміни збережено.");
    } catch (cause) { handleError(cause); } finally { setSaving(false); }
  }

  return <main className="app-shell-background min-h-screen p-3 sm:p-6"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm text-primary" onClick={(event) => {
        if (saving || (dirty && !window.confirm("Повернутися до списку без збереження змін?"))) event.preventDefault();
      }}><ArrowLeft className="size-4" />До користувачів</Link>
      <Button variant="outline" disabled={loading || saving} onClick={() => {
        if (!dirty || window.confirm("Оновити дані й відкинути незбережені зміни?")) { setNotice(""); setRevision((value) => value + 1); }
      }}><RefreshCw className={loading ? "animate-spin" : ""} />Оновити</Button>
    </header>
    <h1 className="flex items-start gap-2 break-words text-2xl font-semibold"><ShieldCheck className="mt-1 size-6 shrink-0" /><span className="min-w-0">{original?.username ?? "Користувач"}</span></h1>
    {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-destructive">{error}</p> : null}
    {notice ? <p role="status" className="text-primary">{notice}</p> : null}
    {loading ? <p role="status">Завантаження…</p> : null}
    {needsLogin ? <Button asChild><Link href={`/login?next=${encodeURIComponent(`/admin/users/${encodeURIComponent(userId)}${backHref.slice("/admin".length)}`)}`}>Увійти</Link></Button> : null}
    {editing && !loading ? <>
      <section className="space-y-4 border-b pb-5"><h2 className="text-lg font-semibold">Активність і матеріали</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          {[["Створено", date(editing.createdAt)], ["Останній вхід", editing.lastLoginAt ? date(editing.lastLoginAt) : "—"],
            ["Остання активність", editing.lastActiveAt ? date(editing.lastActiveAt) : "—"], ["Карти", editing._count.birthProfiles],
            ["Прогнози", editing._count.savedForecasts], ["Консультації", editing._count.consultations]].map(([label, value]) =>
            <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
        </dl>
      </section>
      <section className="space-y-4"><h2 className="text-lg font-semibold">Дані акаунта</h2>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="admin-username">Username</Label><Input id="admin-username" required minLength={3} maxLength={50} value={editing.username} disabled={saving} onChange={(event) => setEditing({ ...editing, username: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" required type="email" maxLength={160} value={editing.email} disabled={saving} onChange={(event) => setEditing({ ...editing, email: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="admin-role">Роль</Label><Select value={editing.role} disabled={saving} onValueChange={(role: Role) => setEditing({ ...editing, role })}><SelectTrigger id="admin-role"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(roles).map(([role, label]) => <SelectItem key={role} value={role}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="admin-shared-until">Спостереження інших: доступ до (час Києва)</Label><Input id="admin-shared-until" type="datetime-local" step={1} value={sharedUntil} disabled={saving} onChange={(event) => setSharedUntil(event.target.value)} /><Button type="button" variant="outline" size="sm" disabled={saving || !sharedUntil} onClick={() => setSharedUntil("")}>Скасувати доступ</Button></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="admin-password">Новий пароль (необов’язково)</Label><Input id="admin-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} disabled={saving} aria-describedby="admin-password-help" onChange={(event) => setPassword(event.target.value)} /><p id="admin-password-help" className="text-xs text-muted-foreground">Від 8 символів: велика й мала літери, цифра та спецсимвол. Порожнє поле залишає пароль без змін.</p></div>
          <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={saving || !dirty}>{saving ? <RefreshCw className="animate-spin" /> : <Save />}Зберегти</Button><Button type="button" variant="secondary" disabled={saving || !dirty} onClick={() => { if (original) accept(original); setError(""); setNotice(""); }}><Undo2 />Скасувати зміни</Button></div>
        </form>
      </section>
      <AdminUserAccess key={`${editing.id}:${original?.role}`} userId={editing.id} />
    </> : null}
  </div></main>;
}
