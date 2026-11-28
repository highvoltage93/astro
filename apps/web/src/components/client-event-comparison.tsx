"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, NotebookPen, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewBadge } from "@/components/ui/new-badge";
import { membershipRequest } from "@/lib/membership";
import type { SavedForecast } from "@/lib/forecast-archive";
import { compareEventDates, savedForecastExacts } from "@/lib/client-event-comparison";
import { displayBirthDate } from "@/lib/birth-input";
import { forecastKnowledgeSeedHref } from "@/lib/knowledge-note-seed";

export function ClientEventComparison({ clientId, event, onClose }: {
  clientId: string; event: { title: string; date: string; approximate: boolean; notes: string }; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ items: { id: string; title: string }[]; hasMore: boolean } | null>(null);
  const [selected, setSelected] = useState("");
  const [forecast, setForecast] = useState<SavedForecast | null>(null);
  const [days, setDays] = useState("7");
  const [timezone, setTimezone] = useState("Europe/Kyiv");
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setList(null); setListError("");
    void membershipRequest<{ items: { id: string; title: string }[]; hasMore: boolean }>(`/clients/${encodeURIComponent(clientId)}/materials?${new URLSearchParams({ kind: "forecast", linked: "true", search: query, page: String(page) })}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setList(value); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setListError(cause instanceof Error ? cause.message : "Не вдалося завантажити прогнози."); });
    return () => controller.abort();
  }, [clientId, query, page, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setForecast(null); setError("");
    if (selected) void membershipRequest<{ forecast: SavedForecast }>(`/saved-forecasts/${encodeURIComponent(selected)}`, { signal: controller.signal })
      .then(({ forecast: value }) => {
        savedForecastExacts(value);
        if (!controller.signal.aborted) setForecast(value);
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не вдалося відкрити прогноз."); });
    return () => controller.abort();
  }, [selected, revision]);
  const rows = useMemo(() => forecast ? compareEventDates(savedForecastExacts(forecast), event.date, Number(days), timezone) : [], [forecast, event.date, days, timezone]);
  const [rowPage, setRowPage] = useState(1);
  useEffect(() => { setRowPage(1); }, [selected, days, timezone, revision]);
  return <section className="space-y-4 rounded-lg border bg-card p-4" aria-label="Зіставлення події з прогнозом">
    <div className="flex items-start justify-between gap-3"><h3 className="flex flex-wrap items-center gap-2 font-semibold">Подія та прогноз<NewBadge /></h3><Button type="button" variant="ghost" size="icon" onClick={onClose} title="Закрити зіставлення" aria-label="Закрити зіставлення"><X /></Button></div>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-3"><h4 className="break-words font-semibold">{event.title}</h4><p className="text-sm">{event.approximate ? "Приблизно " : ""}{displayBirthDate(event.date.slice(0, 10))}</p><p className="whitespace-pre-wrap break-words text-sm leading-6">{event.notes}</p></div>
      <div className="min-w-0 space-y-4">
        <form className="flex items-end gap-2" onSubmit={(value) => { value.preventDefault(); setQuery(search.trim()); setPage(1); }}><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="compare-search">Прив’язані прогнози</Label><Input id="compare-search" maxLength={160} value={search} onChange={(value) => setSearch(value.target.value)} /></div><Button type="submit" variant="outline" title="Пошук прогнозу" aria-label="Пошук прогнозу"><Search /></Button><Button type="button" variant="outline" title="Оновити" aria-label="Оновити прогнози" onClick={() => setRevision((value) => value + 1)}><RefreshCw /></Button></form>
        {listError ? <p role="alert" className="text-sm text-destructive">{listError}</p> : !list ? <p role="status">Завантаження прогнозів…</p> : <>
          <ul className="divide-y border-y">{list.items.map((item) => <li key={item.id}><button type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`w-full break-words px-2 py-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring ${selected === item.id ? "bg-secondary font-semibold" : "hover:bg-secondary/40"}`}>{item.title}</button></li>)}</ul>
          {!list.items.length ? <p className="text-sm text-muted-foreground">Прив’язаних прогнозів за цим запитом немає.</p> : null}
          <div className="flex items-center justify-between"><Button variant="ghost" size="icon" title="Попередні прогнози" aria-label="Попередні прогнози" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft /></Button><span className="text-sm">{page}</span><Button variant="ghost" size="icon" title="Наступні прогнози" aria-label="Наступні прогнози" disabled={!list.hasMore} onClick={() => setPage((value) => value + 1)}><ArrowRight /></Button></div>
        </>}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : selected && !forecast ? <p role="status">Завантаження знімка прогнозу…</p> : null}
        {forecast ? <>
          <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="min-w-0 break-words font-semibold">{forecast.title}</h4><Button asChild variant="outline" size="icon"><a href={`/workspace?forecastId=${encodeURIComponent(forecast.id)}`} target="_blank" rel="noopener noreferrer" title="Відкрити оригінал" aria-label="Відкрити оригінал прогнозу в новій вкладці"><ExternalLink /></a></Button></div>
          {forecast.kind === "synastry" ? <p className="text-sm text-muted-foreground">Синастрія не містить календаря екзактів.</p> : <>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="compare-days">Екзакти відносно дати події</Label><Select value={days} onValueChange={setDays}><SelectTrigger id="compare-days"><SelectValue /></SelectTrigger><SelectContent>{[0, 7, 30, 90].map((value) => <SelectItem key={value} value={String(value)}>{value ? `±${value} днів` : "У день події"}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="compare-zone">Часовий пояс дат</Label><Select value={timezone} onValueChange={setTimezone}><SelectTrigger id="compare-zone"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Europe/Kyiv">Київ</SelectItem><SelectItem value="UTC">UTC</SelectItem></SelectContent></Select></div></div>
            <p className="text-xs text-muted-foreground">Джерело: збережений прогноз. Збіг дат не встановлює причинного зв’язку.</p>
            {rows.length ? <><ol className="divide-y">{rows.slice((rowPage - 1) * 20, rowPage * 20).map((row, index) => {
              const noteHref = forecastKnowledgeSeedHref(row);
              return <li key={`${rowPage}:${index}`} className="space-y-2 py-3 text-sm"><p className="break-words font-medium">{row.title}</p><p>{row.localDate} · {row.offset === 0 ? "У день події" : row.offset < 0 ? `За ${-row.offset} дн. до події` : `Через ${row.offset} дн. після події`}</p>
                {noteHref ? <Button asChild variant="outline" size="sm" className="h-auto min-h-9 max-w-full whitespace-normal"><a href={noteHref} target="_blank" rel="noopener noreferrer" title="Відкрити чернетку спостереження в новій вкладці"><NotebookPen />Чернетка спостереження<NewBadge /></a></Button> : null}
              </li>;
            })}</ol><div className="flex items-center justify-between"><Button variant="ghost" size="icon" title="Попередні екзакти" aria-label="Попередні екзакти" disabled={rowPage === 1} onClick={() => setRowPage((value) => value - 1)}><ArrowLeft /></Button><span className="text-sm">{rowPage} / {Math.ceil(rows.length / 20)}</span><Button variant="ghost" size="icon" title="Наступні екзакти" aria-label="Наступні екзакти" disabled={rowPage * 20 >= rows.length} onClick={() => setRowPage((value) => value + 1)}><ArrowRight /></Button></div></> : <p className="text-sm text-muted-foreground">У збереженому прогнозі немає екзактів у вибраному проміжку. Незбережені календарі тут не враховані.</p>}
          </>}
        </> : null}
      </div>
    </div>
  </section>;
}
