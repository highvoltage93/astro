"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import { Ban, Plus, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccessHistory, AccessSettings, membershipDate, membershipRequest, planNames } from "@/lib/membership";

const message = (error: unknown) => error instanceof Error ? error.message : "Не вдалося виконати запит.";

export function AdminAccessSettings() {
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(""); setSettings(null);
    void membershipRequest<AccessSettings>("/admin/access/settings", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setSettings(result); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(message(cause)); });
    return () => controller.abort();
  }, [revision]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await membershipRequest<AccessSettings>("/admin/access/settings", { method: "PUT", body: JSON.stringify({
        trialEnabled: settings.trialEnabled, trialDays: settings.trialDays, revision: settings.revision
      }) });
      setSettings(result); setNotice("Збережено. Нові правила діють лише для наступних реєстрацій.");
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>Плани та пробний період</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm leading-6 text-muted-foreground">Попередній режим: тарифні обмеження не застосовуються. Trial і Pro не змінюють роль користувача або поточний доступ до чужих спостережень.</p>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {notice ? <p role="status" className="text-sm">{notice}</p> : null}
    {settings ? <form onSubmit={save} className="flex flex-wrap items-end gap-4">
      <div className="flex min-h-11 items-center gap-2"><Checkbox id="trial-enabled" checked={settings.trialEnabled} disabled={busy} onCheckedChange={(checked) => setSettings({ ...settings, trialEnabled: checked === true })} /><Label htmlFor="trial-enabled">Trial для нових акаунтів</Label></div>
      <div className="w-40 space-y-2"><Label htmlFor="trial-days">Тривалість, днів</Label><Input id="trial-days" type="number" min={1} max={365} required disabled={busy} value={settings.trialDays} onChange={(event) => setSettings({ ...settings, trialDays: Number(event.target.value) })} /></div>
      <Button type="submit" disabled={busy}><Save />Зберегти</Button>
    </form> : !error ? <p role="status">Завантаження…</p> : null}
    <Button variant="outline" disabled={busy} onClick={() => { setNotice(""); setRevision((value) => value + 1); }}><RefreshCw />Оновити налаштування</Button>
  </CardContent></Card>;
}

export function AdminUserAccess({ userId }: { userId: string }) {
  const [data, setData] = useState<AccessHistory | null>(null);
  const [plan, setPlan] = useState<"TRIAL" | "PRO">("PRO");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const path = `/admin/access/users/${encodeURIComponent(userId)}`;
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    void membershipRequest<AccessHistory>(path, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(message(cause)); });
    return () => controller.abort();
  }, [path, revision]);
  async function mutate(grantId?: string) {
    if (busy) return;
    if (reason.trim().length < 3) { setError("Вкажіть причину зміни (щонайменше 3 символи)."); return; }
    const expiry = DateTime.fromISO(endsAt, { zone: "Europe/Kyiv" });
    if (!grantId && (!expiry.isValid || expiry.toMillis() <= Date.now())) { setError("Вкажіть майбутню дату завершення."); return; }
    if (grantId && !window.confirm("Відкликати цей запис доступу? Інші активні записи залишаться чинними.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await membershipRequest(`${path}/grants${grantId ? `/${encodeURIComponent(grantId)}/revoke` : ""}`, {
        method: "POST", body: JSON.stringify(grantId ? { reason: reason.trim() } : { plan, endsAt: expiry.toUTC().toISO(), reason: reason.trim() })
      });
      setReason(""); setNotice(grantId ? "Запис відкликано." : "Доступ видано. Зміну записано в аудит.");
      setRevision((value) => value + 1);
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Тарифний доступ</h3><Button type="button" variant="outline" disabled={busy} onClick={() => setRevision((value) => value + 1)}><RefreshCw />Оновити</Button></div>
    {data ? <p className="text-sm">План: <strong>{planNames[data.access.plan]}</strong>{data.access.endsAt ? ` до ${membershipDate(data.access.endsAt)}` : ""}{data.access.administrator ? " · Адміністратор" : ""}</p> : !error ? <p role="status">Завантаження…</p> : null}
    <p className="text-sm text-muted-foreground">Щоб продовжити доступ, видайте новий строк. Щоб повернути Free, відкличте всі активні Trial/Pro. Збережені матеріали не видаляються. Тарифні блокування поки вимкнені.</p>
    <form onSubmit={(event) => { event.preventDefault(); void mutate(); }} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="access-plan">План</Label><Select value={plan} disabled={busy} onValueChange={(value: "TRIAL" | "PRO") => setPlan(value)}><SelectTrigger id="access-plan"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TRIAL">Trial</SelectItem><SelectItem value="PRO">Pro</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="access-end">Доступ до (час Києва)</Label><Input id="access-end" type="datetime-local" step={1} required value={endsAt} disabled={busy} onChange={(event) => setEndsAt(event.target.value)} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="access-reason">Причина видачі / відкликання</Label><Input id="access-reason" minLength={3} maxLength={500} required value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /></div>
      <div><Button type="submit" disabled={busy || !data}><Plus />Видати доступ</Button></div>
    </form>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {notice ? <p role="status" className="text-sm">{notice}</p> : null}
    {data ? <div className="divide-y"><h4 className="pb-3 text-sm font-semibold">Останні записи доступу ({data.history.length})</h4>
      {data.history.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Записів ще немає.</p> : data.history.map((grant) => {
        const active = !grant.revokedAt && new Date(grant.startsAt).getTime() <= Date.now() && new Date(grant.endsAt).getTime() > Date.now();
        return <article key={grant.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
          <div className="min-w-0 flex-1 space-y-1"><p className="font-medium">{planNames[grant.plan]} · {grant.revokedAt ? "Відкликано" : active ? "Активний" : "Завершено"}</p>
            <p>{membershipDate(grant.startsAt)} – {membershipDate(grant.endsAt)}</p>
            <p className="break-words text-muted-foreground">{grant.reason}</p>
            <p className="text-xs text-muted-foreground">{grant.source === "registration" ? "Реєстрація" : "Адміністратор"} · створено {membershipDate(grant.createdAt)}</p>
          </div>
          {active ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void mutate(grant.id)}><Ban />Відкликати</Button> : null}
        </article>;
      })}
    </div> : null}
  </section>;
}
