"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewBadge } from "@/components/ui/new-badge";
import { displayBirthDate, maskBirthInput, parseBirthDateText } from "@/lib/birth-input";
import { membershipRequest } from "@/lib/membership";

const categories = { relocation: "Переїзд", work: "Робота", relationships: "Стосунки", family: "Сім’я", health: "Здоров’я", education: "Освіта", other: "Інше" };
type Category = keyof typeof categories;
type LifeEvent = { id: string; title: string; date: string; approximate: boolean; category: Category; notes: string; revision: number };
const message = (cause: unknown) => cause instanceof Error ? cause.message : "Не вдалося виконати запит.";

export function ClientEvents({ clientId }: { clientId: string }) {
  const [editor, setEditor] = useState<LifeEvent | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ events: LifeEvent[]; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const path = `/clients/${encodeURIComponent(clientId)}/events`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    const params = new URLSearchParams({ search: query, page: String(page), ...(category === "all" ? {} : { category }) });
    void membershipRequest<{ events: LifeEvent[]; hasMore: boolean }>(`${path}?${params}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setResult(value); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(message(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, query, category, page, revision]);
  async function remove(event: LifeEvent) {
    if (busy || !window.confirm(`Видалити подію «${event.title}»? Карти, прогнози та консультації залишаться без змін.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await membershipRequest(`${path}/${encodeURIComponent(event.id)}`, { method: "DELETE", body: JSON.stringify({ revision: event.revision }) });
      setNotice("Подію видалено.");
      if (page > 1 && result?.events.length === 1) setPage((value) => value - 1);
      else setRevision((value) => value + 1);
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t pt-6" aria-label="Історія подій клієнта">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold"><CalendarDays className="size-5" />Історія подій<NewBadge /></h2>
      <Button type="button" disabled={!!editor || busy} onClick={() => { setEditor("new"); setNotice(""); }}><Plus />Додати подію</Button></div>
    {editor ? <EventEditor key={editor === "new" ? "new" : editor.id} event={editor === "new" ? null : editor} path={path} onClose={() => setEditor(null)} onSaved={() => {
      setEditor(null); setNotice("Подію збережено."); setPage(1); setRevision((value) => value + 1);
    }} /> : null}
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(1); }}>
      <div className="min-w-0 flex-1 basis-48 space-y-2"><Label htmlFor="event-search">Назва або нотатки</Label><Input id="event-search" maxLength={160} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="w-full space-y-2 sm:w-48"><Label htmlFor="event-filter">Категорія</Label><Select value={category} onValueChange={(value) => { setCategory(value); setPage(1); }}><SelectTrigger id="event-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Усі категорії</SelectItem>{Object.entries(categories).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
      <Button type="submit" variant="outline" title="Знайти події" aria-label="Знайти події"><Search /></Button><Button type="button" variant="outline" disabled={loading || busy} title="Оновити історію" aria-label="Оновити історію" onClick={() => setRevision((value) => value + 1)}><RefreshCw /></Button>
    </form>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {notice ? <p role="status" className="text-sm">{notice}</p> : null}
    {loading ? <p role="status">Завантаження…</p> : null}
    {result ? <>
      <ol className="divide-y border-y">{result.events.map((event) => <li key={event.id} className="py-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground"><time dateTime={event.date.slice(0, 10)}>{event.approximate ? "Приблизно " : ""}{displayBirthDate(event.date.slice(0, 10))}</time> · {categories[event.category]}</p><h3 className="mt-1 break-words font-semibold">{event.title}</h3></div>
          <div className="flex gap-2"><Button type="button" variant="outline" size="icon" disabled={busy || !!editor} title="Редагувати подію" aria-label={`Редагувати ${event.title}`} onClick={() => setEditor(event)}><Pencil /></Button><Button type="button" variant="outline" size="icon" disabled={busy || !!editor} title="Видалити подію" aria-label={`Видалити ${event.title}`} onClick={() => void remove(event)}><Trash2 /></Button></div>
        </div>
        {event.notes ? <details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">Нотатки</summary><p className="mt-2 whitespace-pre-wrap break-words leading-6">{event.notes}</p></details> : null}
      </li>)}</ol>
      {!result.events.length ? <p className="py-4 text-sm text-muted-foreground">{query || category !== "all" ? "Подій за цим запитом не знайдено." : "Подій ще немає."}</p> : null}
      <div className="flex items-center justify-between gap-3"><Button variant="outline" title="Попередня сторінка" aria-label="Попередня сторінка" disabled={page === 1 || busy} onClick={() => setPage((value) => value - 1)}><ArrowLeft /></Button><span className="text-sm">Сторінка {page}</span><Button variant="outline" title="Наступна сторінка" aria-label="Наступна сторінка" disabled={!result.hasMore || busy} onClick={() => setPage((value) => value + 1)}><ArrowRight /></Button></div>
    </> : null}
  </section>;
}

function EventEditor({ event, path, onClose, onSaved }: { event: LifeEvent | null; path: string; onClose: () => void; onSaved: () => void }) {
  const initial = { title: event?.title ?? "", date: displayBirthDate(event?.date.slice(0, 10) ?? ""), approximate: event?.approximate ?? false, category: event?.category ?? "other" as Category, notes: event?.notes ?? "" };
  const [form, setForm] = useState(initial);
  const [id] = useState(() => event?.id ?? crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const warn = (value: BeforeUnloadEvent) => { value.preventDefault(); value.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(value: FormEvent) {
    value.preventDefault();
    if (busy) return;
    const date = parseBirthDateText(form.date);
    if (!date) { setError("Вкажіть дійсну дату: ДД.ММ.РРРР."); return; }
    setBusy(true); setError("");
    try {
      await membershipRequest(event ? `${path}/${encodeURIComponent(id)}` : path, { method: event ? "PUT" : "POST", body: JSON.stringify({ ...form, date, ...(event ? { revision: event.revision } : { id }) }) });
      onSaved();
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
    <h3 className="font-semibold sm:col-span-2">{event ? "Редагування події" : "Нова подія"}</h3>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor="event-title">Назва</Label><Input id="event-title" required maxLength={160} disabled={busy} value={form.title} onChange={(value) => setForm({ ...form, title: value.target.value })} /></div>
    <div className="space-y-2"><Label htmlFor="event-date">Дата</Label><Input id="event-date" required inputMode="numeric" placeholder="ДД.ММ.РРРР" autoComplete="off" disabled={busy} value={form.date} onChange={(value) => {
      const masked = maskBirthInput("date", value.target.value, value.target.selectionStart ?? value.target.value.length, form.date, (value.nativeEvent as InputEvent).inputType);
      value.target.value = masked.text; value.target.setSelectionRange(masked.caret, masked.caret);
      setForm({ ...form, date: masked.text });
    }} /></div>
    <div className="space-y-2"><Label htmlFor="event-category">Категорія</Label><Select value={form.category} disabled={busy} onValueChange={(category: Category) => setForm({ ...form, category })}><SelectTrigger id="event-category"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categories).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
    <div className="flex items-center gap-2 sm:col-span-2"><Checkbox id="event-approximate" disabled={busy} checked={form.approximate} onCheckedChange={(value) => setForm({ ...form, approximate: value === true })} /><Label htmlFor="event-approximate">Приблизна дата</Label></div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor="event-notes">Приватні нотатки</Label><textarea id="event-notes" rows={5} maxLength={20000} disabled={busy} className="w-full rounded-md border border-input bg-background p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.notes} onChange={(value) => setForm({ ...form, notes: value.target.value })} /></div>
    {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
    <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy}><Save />Зберегти подію</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm("Закрити без збереження змін?")) onClose(); }}><X />Скасувати</Button></div>
  </form>;
}
