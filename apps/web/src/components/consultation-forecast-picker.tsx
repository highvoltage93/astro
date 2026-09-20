"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FilePlus2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSavedForecast, listSavedForecasts } from "@/lib/api";
import type { SavedForecast, SavedForecastSummary } from "@/lib/forecast-archive";
import { consultationForecastFacts, importedForecastEvents } from "@/lib/consultation-forecast-facts";
import type { ConsultationContent } from "@astroprocessor/consultation-format";

export function ConsultationForecastPicker({ token, content, disabled, onInsert }: {
  token: string; content: ConsultationContent; disabled: boolean;
  onInsert: (target: string, forecast: SavedForecast, ids: string[]) => boolean;
}) {
  const [kind, setKind] = useState<"forecast" | "transit">("forecast");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [page, setPage] = useState<{ forecasts: SavedForecastSummary[]; nextCursor: string | null }>({ forecasts: [], nextCursor: null });
  const [forecastId, setForecastId] = useState<string | null>(null);
  const [forecast, setForecast] = useState<SavedForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [eventQuery, setEventQuery] = useState("");
  const [target, setTarget] = useState("new");
  const [inserted, setInserted] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setForecast(null); setSelected([]); setInserted(false);
    const timer = setTimeout(() => {
      const request = forecastId ? getSavedForecast(forecastId, token).then((result) => {
        if (active) setForecast(result.forecast);
      }) : listSavedForecasts(token, { kind, query: query.trim(), cursor }).then((result) => {
        if (active) setPage(result);
      });
      void request.catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : "Не вдалося завантажити прогноз.");
      }).finally(() => { if (active) setLoading(false); });
    }, forecastId ? 0 : 250);
    return () => { active = false; clearTimeout(timer); };
  }, [token, kind, query, cursor, forecastId, retry]);

  const facts = useMemo(() => forecast ? consultationForecastFacts(forecast) : [], [forecast]);
  const imported = importedForecastEvents(content, forecast?.id ?? "");
  const selection = selected.filter((id) => !imported.has(id));
  const visible = facts.filter((fact) => fact.text.toLocaleLowerCase("uk-UA").includes(eventQuery.trim().toLocaleLowerCase("uk-UA")));
  return <div className="min-w-0 space-y-3">
    {forecastId ? <Button variant="ghost" onClick={() => { setForecastId(null); setForecast(null); setEventQuery(""); }}><ArrowLeft />До архіву</Button> :
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={kind} onValueChange={(value) => { setKind(value as typeof kind); setCursor(undefined); }}>
          <SelectTrigger aria-label="Метод прогнозування"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="forecast">Соляр, лунар і прогностика</SelectItem><SelectItem value="transit">Транзити</SelectItem></SelectContent>
        </Select>
        <Input aria-label="Пошук збережених прогнозів" placeholder="Назва прогнозу" value={query} onChange={(event) => { setQuery(event.target.value); setCursor(undefined); }} />
      </div>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">Завантаження…</p> : error ?
      <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}><RefreshCw />Повторити</Button></div> :
      !forecastId ? <div className="space-y-2">
        <div className="max-h-80 divide-y overflow-y-auto">
          {page.forecasts.map((item) => <button type="button" key={item.id} className="block w-full rounded-sm px-2 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setForecastId(item.id); setForecast(null); }}>
            <span className="block break-words text-sm font-medium">{item.title}</span>
            <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("uk-UA")}</span>
          </button>)}
          {!page.forecasts.length ? <p className="py-3 text-sm text-muted-foreground">Збережених прогнозів не знайдено.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {cursor ? <Button variant="ghost" onClick={() => setCursor(undefined)}>На початок</Button> : null}
          {page.nextCursor ? <Button variant="outline" onClick={() => setCursor(page.nextCursor ?? undefined)}>Наступні</Button> : null}
        </div>
      </div> : forecast ? <>
        <div className="min-w-0 border-b pb-2">
          <h3 className="break-words text-base font-semibold">{forecast.title}</h3>
          <p className="break-words text-sm text-muted-foreground">{forecast.input.context.subject.displayName} · Знімок: {forecast.result.generatedAt} · Дати подій: UTC</p>
        </div>
        {forecast.result.warnings?.length ? <div role="status" className="space-y-1 border-l-2 border-amber-500 pl-3 text-sm">
          {forecast.result.warnings.map((warning, index) => <p key={`${warning.code}:${index}`}>{warning.message}</p>)}
        </div> : null}
        <Input aria-label="Пошук прогнозних подій" placeholder="Планета, метод, дата" value={eventQuery} onChange={(event) => setEventQuery(event.target.value)} />
        <div className="max-h-80 space-y-3 overflow-y-auto border-b py-2">
          {visible.map((fact) => <label key={fact.id} className="flex items-start gap-2 text-sm leading-6">
            <Checkbox className="mt-1 shrink-0" disabled={disabled || imported.has(fact.id)} checked={imported.has(fact.id) || selected.includes(fact.id)} onCheckedChange={(checked) => {
              setInserted(false); setSelected((current) => checked === true ? [...new Set([...current, fact.id])] : current.filter((id) => id !== fact.id));
            }} />
            <span className="min-w-0 break-words">{fact.text}{imported.has(fact.id) ? <span className="ml-1 text-muted-foreground">Уже додано</span> : null}</span>
          </label>)}
          {!visible.length ? <p className="text-sm text-muted-foreground">Подій не знайдено.</p> : null}
        </div>
        <label className="block space-y-1 text-sm font-medium"><span>Розділ консультації</span>
          <Select value={target} onValueChange={setTarget}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="new">Новий розділ</SelectItem>
            {content.sections.map((section, index) => <SelectItem key={section.id} value={section.id}>{section.title || `Розділ ${index + 1}`}</SelectItem>)}
          </SelectContent></Select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={disabled || !selection.length} onClick={() => {
            if (onInsert(target, forecast, selection)) { setSelected([]); setInserted(true); }
          }}><FilePlus2 />Вставити ({selection.length})</Button>
          <Button variant="ghost" disabled={!selection.length} onClick={() => setSelected([])}>Очистити вибір</Button>
        </div>
        {inserted ? <p role="status" className="text-sm text-primary">Події додано до консультації.</p> : null}
      </> : null}
  </div>;
}
