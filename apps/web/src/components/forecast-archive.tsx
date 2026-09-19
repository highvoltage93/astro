"use client";

import { Archive, Check, ChevronDown, FolderOpen, RefreshCw, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteSavedForecast, listSavedForecasts, saveForecast } from "@/lib/api";
import { archiveFilterOptions, defaultArchiveFilters, createForecastRequestId, FORECAST_ARCHIVE_UPDATED_EVENT, forecastArchivePath, forecastKindLabels } from "@/lib/forecast-archive";
import type { ForecastArchiveDraft, ForecastArchiveFilters, SavedForecastSummary, SaveForecastPayload } from "@/lib/forecast-archive";

const formatCreatedAt = (value: string): string => new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium", timeStyle: "short"
}).format(new Date(value));

export function ForecastSaveControl({ draft, token, disabled }: {
  draft: ForecastArchiveDraft; token: string; disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(draft.title);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingPayload = useRef<SaveForecastPayload | null>(null);
  const requestId = useRef(draft.requestId);
  const inFlight = useRef(false);

  const discardPendingPayload = (): void => {
    if (pendingPayload.current) requestId.current = createForecastRequestId();
    pendingPayload.current = null;
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    // Keep the same payload on retry after an uncertain network response.
    try {
      pendingPayload.current ??= { ...draft, requestId: requestId.current, title: title.trim(), notes: notes.trim() };
      const response = await saveForecast(pendingPayload.current, token);
      setSavedId(response.forecast.id);
      window.dispatchEvent(new Event(FORECAST_ARCHIVE_UPDATED_EVENT));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не вдалося зберегти прогноз.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (savedId) return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-sm">
      <span className="flex items-center gap-2 text-primary"><Check className="h-4 w-4" />Прогноз збережено</span>
      <Button asChild variant="secondary"><Link href={forecastArchivePath(savedId)}><FolderOpen />Відкрити</Link></Button>
    </div>
  );

  return (
    <div className="space-y-3 border-b pb-3">
      <Button variant="secondary" disabled={disabled || busy} type="button" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
        <Save />Зберегти прогноз
      </Button>
      {isOpen ? (
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <label className="block space-y-1 text-sm font-medium">
            <span>Назва прогнозу</span>
            <Input required maxLength={120} value={title} disabled={busy} onChange={(event) => {
              setTitle(event.target.value); discardPendingPayload();
            }} />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            <span>Нотатки до консультації</span>
            <textarea className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
              maxLength={10000} rows={3} value={notes} disabled={busy} onChange={(event) => {
                setNotes(event.target.value); discardPendingPayload();
              }} />
          </label>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy || disabled || !title.trim()}>
            {busy ? <RefreshCw className="animate-spin" /> : <Save />}{busy ? "Зберігаю…" : "Зберегти в архів"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function SavedForecastsList({ token }: { token: string }) {
  const [draft, setDraft] = useState<ForecastArchiveFilters>(defaultArchiveFilters);
  const [filter, setFilter] = useState<ForecastArchiveFilters>(defaultArchiveFilters);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [records, setRecords] = useState<SavedForecastSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const refresh = () => setFilter((current) => ({ ...current }));
    window.addEventListener(FORECAST_ARCHIVE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(FORECAST_ARCHIVE_UPDATED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    setRecords([]);
    setNextCursor(null);
    void Promise.resolve().then(() => listSavedForecasts(token, archiveFilterOptions(filter)))
      .then((response) => {
        if (generation.current !== version) return;
        setRecords(response.forecasts); setNextCursor(response.nextCursor);
      }).catch((requestError: unknown) => {
        if (generation.current === version) setError(requestError instanceof Error ? requestError.message : "Не вдалося завантажити архів.");
      }).finally(() => { if (generation.current === version) setLoading(false); });
    return () => { generation.current++; };
  }, [filter, token]);

  const loadMore = async (): Promise<void> => {
    if (!nextCursor || loading) return;
    const version = generation.current;
    setLoading(true); setError(null);
    try {
      const response = await listSavedForecasts(token, { ...archiveFilterOptions(filter), cursor: nextCursor });
      if (generation.current !== version) return;
      setRecords((current) => [...current, ...response.forecasts.filter((record) => !current.some((item) => item.id === record.id))]);
      setNextCursor(response.nextCursor);
    } catch (requestError) {
      if (generation.current === version) setError(requestError instanceof Error ? requestError.message : "Не вдалося завантажити архів.");
    } finally { if (generation.current === version) setLoading(false); }
  };

  const remove = async (record: SavedForecastSummary): Promise<void> => {
    if (deleting || !window.confirm(`Видалити прогноз «${record.title}»?`)) return;
    setDeleting(record.id); setError(null);
    try {
      await deleteSavedForecast(record.id, token);
      window.dispatchEvent(new Event(FORECAST_ARCHIVE_UPDATED_EVENT));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не вдалося видалити прогноз.");
    } finally { setDeleting(null); }
  };

  return (
    <div className="min-w-0 space-y-3">
      <form className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        try {
          archiveFilterOptions(draft);
          setFilterError(null); setFilter({ ...draft, query: draft.query.trim() });
        } catch (requestError) {
          setFilterError(requestError instanceof Error ? requestError.message : "Перевір дати.");
        }
      }}>
        <label className="min-w-0 space-y-1 text-sm font-medium sm:col-span-2">
          <span>Пошук</span>
          <Input placeholder="Назва або нотатки" maxLength={120} value={draft.query} onChange={(event) => setDraft((current) => ({ ...current, query: event.target.value }))} />
        </label>
        <label className="min-w-0 space-y-1 text-sm font-medium">
          <span>Метод прогнозу</span>
        <Select value={draft.kind} onValueChange={(kind) => setDraft((current) => ({ ...current, kind: kind as ForecastArchiveFilters["kind"] }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Усі методи</SelectItem>
            {Object.entries(forecastKindLabels).map(([kind, label]) => <SelectItem key={kind} value={kind}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        </label>
        <label className="min-w-0 space-y-1 text-sm font-medium">
          <span>Порядок</span>
          <Select value={draft.sort} onValueChange={(sort) => setDraft((current) => ({ ...current, sort: sort as ForecastArchiveFilters["sort"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="newest">Спочатку нові</SelectItem><SelectItem value="oldest">Спочатку давні</SelectItem></SelectContent>
          </Select>
        </label>
        <label className="min-w-0 space-y-1 text-sm font-medium">
          <span>Створено від</span>
          <Input type="date" max={draft.through || undefined} value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} />
        </label>
        <label className="min-w-0 space-y-1 text-sm font-medium">
          <span>Створено до включно</span>
          <Input type="date" min={draft.from || undefined} value={draft.through} onChange={(event) => setDraft((current) => ({ ...current, through: event.target.value }))} />
        </label>
        {filterError ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{filterError}</p> : null}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" variant="secondary"><Search />Знайти</Button>
          <Button type="button" variant="ghost" size="icon" title="Скинути фільтри" aria-label="Скинути фільтри" onClick={() => {
            setDraft({ ...defaultArchiveFilters }); setFilter({ ...defaultArchiveFilters }); setFilterError(null);
          }}><RotateCcw /></Button>
        </div>
      </form>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span>{filter.sort === "newest" ? "Спочатку нові" : "Спочатку давні"}</span>
        {filter.kind !== "all" ? <Badge variant="secondary">{forecastKindLabels[filter.kind]}</Badge> : null}
        {filter.query ? <span className="break-all">Пошук: {filter.query}</span> : null}
        {filter.from || filter.through ? <span>Створено: {filter.from || "…"} — {filter.through || "…"}</span> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Завантажую прогнози…</p> : null}
      {!loading && !error && !records.length ? <p className="py-4 text-sm text-muted-foreground">Збережених прогнозів не знайдено.</p> : null}
      <div className="divide-y">
        {records.map((record) => (
          <div className="flex min-w-0 items-start gap-2 py-3" key={record.id}>
            <Link href={forecastArchivePath(record.id)} className="min-w-0 flex-1 space-y-1 rounded-md p-1 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block break-words text-sm font-semibold">{record.title}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{forecastKindLabels[record.kind]}</Badge>
                <time dateTime={record.createdAt}>{formatCreatedAt(record.createdAt)}</time>
              </span>
              {record.notes ? <span className="block break-words text-xs text-muted-foreground line-clamp-2">{record.notes}</span> : null}
            </Link>
            <Button title="Видалити прогноз" aria-label={`Видалити прогноз ${record.title}`} size="icon" className="shrink-0 text-destructive" variant="ghost" disabled={deleting !== null} onClick={() => void remove(record)}>
              {deleting === record.id ? <RefreshCw className="animate-spin" /> : <Trash2 />}
            </Button>
          </div>
        ))}
      </div>
      {nextCursor ? <Button className="w-full" variant="outline" disabled={loading} onClick={() => void loadMore()}><ChevronDown />Ще прогнози</Button> : null}
    </div>
  );
}

export function SavedForecastsCard({ token }: { token: string }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2"><Archive className="h-4 w-4 text-primary" />Збережені прогнози</CardTitle>
        <Button size="icon" variant="secondary" title="Оновити архів" aria-label="Оновити архів" onClick={() => window.dispatchEvent(new Event(FORECAST_ARCHIVE_UPDATED_EVENT))}><RefreshCw /></Button>
      </CardHeader>
      <CardContent><SavedForecastsList token={token} /></CardContent>
    </Card>
  );
}

export function SavedForecastsDrawer({ token, onClose }: { token: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('[role="listbox"]')) return;
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') ?? [])
        .filter((element) => element.getClientRects().length > 0);
      const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, []);
  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="Закрити архів" className="absolute inset-0 bg-background/70 backdrop-blur-sm" tabIndex={-1} onClick={onClose} />
      <aside ref={panel} role="dialog" aria-modal="true" aria-labelledby="forecast-archive-title" className="absolute right-0 top-0 flex h-[100dvh] w-full max-w-[700px] flex-col border-l bg-background shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b p-4">
          <h2 id="forecast-archive-title" className="text-lg font-semibold">Збережені прогнози</h2>
          <Button ref={closeButton} size="icon" variant="ghost" aria-label="Закрити" onClick={onClose}><X /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><SavedForecastsList token={token} /></div>
      </aside>
    </div>
  );
}
