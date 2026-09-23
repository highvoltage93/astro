"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChartWheel } from "@/components/astro-workbench";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import type { ConsultationClientDocument } from "@/lib/consultations";
import { aspectLabels, planetLabelsUk, signLabelsUk } from "@/lib/astrology-labels";
import { getPrintAssets, listPrintForecasts, printAspects, printDegree, printEvents, printHouseLabels, printMethodLabels, printPoints, printUtc, type PrintAssets, type PrintChart, type PrintEvent } from "@/lib/consultation-print-assets";

const defaults = { natalWheel: false, natalPositions: false, natalAspects: false, solarWheel: false, solarPositions: false, solarAspects: false, dates: false };
type Option = keyof typeof defaults;
const labels: Record<Option, string> = { natalWheel: "Натальна карта", natalPositions: "Натальні положення", natalAspects: "Натальні аспекти", solarWheel: "Карта соляру", solarPositions: "Положення соляру", solarAspects: "Аспекти всередині соляру", dates: "Важливі дати (UTC)" };
const pointName = (key: string) => planetLabelsUk[key] ?? key;
const eventDescription = (event: PrintEvent) => [printMethodLabels[event.source], event.bodyA ? pointName(event.bodyA) : "", event.bodyB ? `натальний ${pointName(event.bodyB)}` : "", event.aspectType ? aspectLabels[event.aspectType] ?? event.aspectType : ""].filter(Boolean).join(" · ");

export function useConsultationPrintAssets(document: ConsultationClientDocument | null) {
  const [options, setOptions] = useState(defaults);
  const [forecastId, setForecastId] = useState<string | undefined>();
  const [loaded, setLoaded] = useState<{ key: string; assets: PrintAssets } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const requestKey = `${document?.id}:${document?.revision}:${forecastId ?? ""}:${retry}`;
  useEffect(() => {
    setOptions(defaults); setForecastId(undefined); setSelectedEvents([]); setAcknowledged(false);
  }, [document?.id]);
  useEffect(() => {
    let active = true;
    setLoaded(null); setError(null); setAcknowledged(false); setSelectedEvents([]);
    if (!document) return () => { active = false; };
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!token) { setError("Увійди в обліковий запис."); return () => { active = false; }; }
    void getPrintAssets(token, document.id, document.revision, forecastId).then((assets) => { if (active) setLoaded({ key: requestKey, assets }); })
      .catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : "Не вдалося відкрити карти."); });
    return () => { active = false; };
  }, [document?.id, document?.revision, forecastId, retry, requestKey]);
  const assets = loaded?.key === requestKey ? loaded.assets : null;
  const events = useMemo(() => assets?.forecast ? printEvents(assets.forecast) : [], [assets]);
  const forecastWanted = options.solarWheel || options.solarPositions || options.solarAspects || options.dates;
  const natalWanted = options.natalWheel || options.natalPositions || options.natalAspects;
  const hasContent = Object.values(options).some(Boolean);
  const ready = !hasContent || !!assets && (!natalWanted || !!assets.natal) &&
    (!forecastWanted || !!assets.forecast && (assets.forecast.compatibility === "match" || acknowledged)) &&
    (!(options.solarWheel || options.solarPositions || options.solarAspects) || !!assets.forecast?.solarReturn) &&
    (!options.dates || events.some((event) => selectedEvents.includes(event.id)));
  return { document, options, setOptions, forecastId, setForecastId, assets, error, retry, setRetry, acknowledged, setAcknowledged,
    selectedEvents, setSelectedEvents, events, ready, hasContent };
}
type Model = ReturnType<typeof useConsultationPrintAssets>;

function ForecastPicker({ id, value, onChange }: { id: string; value?: string; onChange: (id?: string) => void }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [page, setPage] = useState<{ forecasts: Array<{ id: string; title: string; createdAt: string }>; nextCursor: string | null }>({ forecasts: [], nextCursor: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    const timer = setTimeout(() => {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (!token) { setError("Увійди в обліковий запис."); setLoading(false); return; }
      void listPrintForecasts(token, id, query, cursor).then((result) => { if (active) setPage(result); })
        .catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : "Архів недоступний."); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [id, query, cursor, retry]);
  return <details className="border-y py-3"><summary className="cursor-pointer text-sm font-semibold">Прогноз із архіву для соляру та дат</summary>
    <div className="mt-3 space-y-2">
      <Input aria-label="Назва прогнозу для друку" placeholder="Пошук прогнозу" maxLength={120} value={query} onChange={(event) => { setQuery(event.target.value); setCursor(undefined); }} />
      <Button variant="ghost" onClick={() => onChange(undefined)}>Без прогнозу</Button>
      {loading ? <p role="status" className="text-sm">Завантаження…</p> : error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={() => { setCursor(undefined); setRetry((count) => count + 1); }}><RefreshCw />Повторити</Button></div> : <>
        <div className="max-h-52 divide-y overflow-y-auto">{page.forecasts.map((item) => <label key={item.id} className="flex items-start gap-2 py-2 text-sm">
          <input type="radio" name="print-forecast" className="mt-1" checked={value === item.id} onChange={() => onChange(item.id)} />
          <span className="min-w-0 break-words">{item.title}<span className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("uk-UA")}</span></span>
        </label>)}{!page.forecasts.length ? <p className="text-sm text-muted-foreground">Збережених прогнозів немає.</p> : null}</div>
        <div className="flex gap-2">{cursor ? <Button variant="ghost" onClick={() => setCursor(undefined)}>На початок</Button> : null}{page.nextCursor ? <Button variant="outline" onClick={() => setCursor(page.nextCursor ?? undefined)}>Наступні</Button> : null}</div>
      </>}
    </div>
  </details>;
}

export function PrintAssetsControls({ model: m }: { model: Model }) {
  const [eventQuery, setEventQuery] = useState("");
  const [eventLimit, setEventLimit] = useState(50);
  if (!m.document) return null;
  const available = (key: Option) => key.startsWith("natal") ? !!m.assets?.natal : key === "dates" ? m.events.length > 0 : !!m.assets?.forecast?.solarReturn;
  const visibleEvents = m.events.filter((event) => `${printUtc(event.exactAt)} ${eventDescription(event)}`.toLocaleLowerCase("uk-UA").includes(eventQuery.toLocaleLowerCase("uk-UA").trim()));
  return <section className="space-y-3 border-t pt-3">
    <h2 className="text-sm font-semibold">Карти та таблиці</h2>
    {m.error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{m.error}</p><Button variant="outline" onClick={() => m.setRetry((value) => value + 1)}><RefreshCw />Повторити завантаження</Button></div> : !m.assets ? <p role="status" className="text-sm text-muted-foreground">Завантажую знімки…</p> : !m.assets.natal ? <p role="status" className="text-sm text-destructive">Натальний знімок не містить усіх даних для карти й таблиць.</p> : null}
    <div className="grid gap-2 text-sm sm:grid-cols-2">{(Object.keys(labels) as Option[]).map((key) => <label key={key} className="flex items-center gap-2">
      <Checkbox checked={m.options[key]} disabled={!available(key) && !m.options[key]} onCheckedChange={(value) => m.setOptions((current) => ({ ...current, [key]: value === true }))} />{labels[key]}
    </label>)}</div>
    <ForecastPicker id={m.document.id} value={m.forecastId} onChange={(id) => {
      m.setForecastId(id); m.setAcknowledged(false); m.setSelectedEvents([]);
      if (!id) m.setOptions((current) => ({ ...current, solarWheel: false, solarPositions: false, solarAspects: false, dates: false }));
    }} />
    {m.assets?.forecast ? <div className="space-y-2 text-sm">
      <p className="break-words font-medium">{m.assets.forecast.title} · {m.assets.forecast.subjectName}</p>
      {!m.assets.forecast.solarReturn ? <p className="text-muted-foreground">У цьому прогнозі немає збереженого соляру.</p> : null}
      {m.assets.forecast.compatibility !== "match" ? <label className="flex items-start gap-2 border-l-2 border-amber-500 pl-3">
        <Checkbox className="mt-1 shrink-0" checked={m.acknowledged} onCheckedChange={(value) => m.setAcknowledged(value === true)} />
        <span>{m.assets.forecast.compatibility === "different" ? "Натальні дані прогнозу відрізняються від консультації." : "Відповідність натальних даних не підтверджена."} Підтверджую включення саме цього прогнозу.</span>
      </label> : null}
    </div> : null}
    {m.options.dates && m.events.length ? <fieldset className="space-y-2"><legend className="text-sm font-semibold">Дати до друку · вибрано {m.selectedEvents.length}</legend>
      <Input aria-label="Пошук дат" placeholder="Дата, планета або метод" value={eventQuery} onChange={(event) => { setEventQuery(event.target.value); setEventLimit(50); }} />
      <div className="max-h-64 space-y-2 overflow-y-auto">{visibleEvents.slice(0, eventLimit).map((event) => <label key={event.id} className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-1 shrink-0" checked={m.selectedEvents.includes(event.id)} onCheckedChange={(value) => m.setSelectedEvents((current) => value === true ? [...new Set([...current, event.id])] : current.filter((id) => id !== event.id))} />
        <span className="min-w-0 break-words">{printUtc(event.exactAt)}<span className="block text-muted-foreground">{eventDescription(event)}</span></span>
      </label>)}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => m.setSelectedEvents((current) => [...new Set([...current, ...visibleEvents.slice(0, eventLimit).map((event) => event.id)])])}>Вибрати показані</Button>
        <Button variant="ghost" onClick={() => m.setSelectedEvents([])}>Очистити</Button>
        {visibleEvents.length > eventLimit ? <Button variant="ghost" onClick={() => setEventLimit((count) => count + 50)}>Ще 50</Button> : null}</div>
    </fieldset> : null}
    {m.hasContent && !m.ready ? <p role="status" className="text-sm text-destructive">Перевір вибрані додатки: потрібні доступні знімки, підтверджений прогноз і хоча б одна дата для таблиці дат.</p> : null}
  </section>;
}

function ChartTables({ chart, positions, aspects, title }: { chart: PrintChart; positions: boolean; aspects: boolean; title: string }) {
  return <>
    {positions ? <section className="consultation-print-section space-y-3"><h2 className="text-lg font-semibold">{title}: положення</h2>
      <table className="consultation-print-table"><thead><tr><th>Планета / точка</th><th>Знак</th><th>Градус у знаку</th><th>Дім</th><th>Рух</th></tr></thead>
        <tbody>{printPoints(chart).map((point) => <tr key={point.key}><td>{pointName(point.key)}</td><td>{signLabelsUk[point.sign] ?? point.sign}</td><td>{printDegree(point.signDegree)}</td><td>{point.house ?? "—"}</td><td>{["asc", "desc", "ic", "mc"].includes(point.key) || point.speed === undefined ? "—" : Math.abs(point.speed) < 0.0001 ? "Стац." : point.speed < -0.0001 ? "Ретро" : "Директ."}</td></tr>)}</tbody>
      </table></section> : null}
    {aspects ? <section className="consultation-print-section space-y-3"><h2 className="text-lg font-semibold">{title}: аспекти між планетами</h2>
      <table className="consultation-print-table"><thead><tr><th>Планети</th><th>Аспект</th><th>Кут аспекту</th><th>Орбіс</th></tr></thead>
        <tbody>{printAspects(chart).map((aspect, index) => <tr key={index}><td>{pointName(aspect.bodyA)} — {pointName(aspect.bodyB)}</td><td>{aspectLabels[aspect.type] ?? aspect.type}</td><td>{aspect.exactAngle}°</td><td>{aspect.orb.toFixed(4)}°</td></tr>)}</tbody>
      </table>{!printAspects(chart).length ? <p className="text-sm">Аспектів між основними планетами немає.</p> : null}</section> : null}
  </>;
}

export function PrintAssetsContent({ model: m }: { model: Model }) {
  if (!m.assets || !m.ready || !m.hasContent) return null;
  const { natal, forecast } = m.assets;
  const solar = forecast?.solarReturn;
  const chartMeta = (chart: PrintChart) => <div className="space-y-1 text-xs">
    <p>Система домів: {printHouseLabels[chart.settings.houseSystem] ?? chart.settings.houseSystem}. Зодіак: {chart.settings.zodiac === "sidereal" ? "сидеричний" : "тропічний"}.</p>
    {chart.warnings?.map((warning, index) => <p key={index}>{warning.message}</p>)}
  </div>;
  const wheel = (chart: PrintChart, title: string, time?: string) => <section className="consultation-print-chart space-y-2">
    <h2 className="text-lg font-semibold">{title}</h2>{time ? <p className="text-sm">{printUtc(time)}</p> : null}
    <ChartWheel chart={{ ...chart, aspects: printAspects(chart) }} visiblePointKeys={{}} printMode label={title} />
    <p className="text-xs">Гармонійні аспекти — червоні; напружені — сині. R — ретроградний рух.</p>
  </section>;
  return <div className="mt-8 space-y-7">
    {natal && (m.options.natalWheel || m.options.natalPositions || m.options.natalAspects) ? <>
      {chartMeta(natal)}{!m.document?.source.birthTimeKnown ? <p className="text-xs">Час народження невідомий. Інтерпретація домів і кутів обмежена точністю вихідних даних.</p> : null}
    </> : null}
    {natal && m.options.natalWheel ? wheel(natal, "Натальна карта") : null}
    {natal ? <ChartTables chart={natal} positions={m.options.natalPositions} aspects={m.options.natalAspects} title="Натальна карта" /> : null}
    {forecast && (m.options.solarWheel || m.options.solarPositions || m.options.solarAspects || m.options.dates) ? <p className="break-words text-xs">Знімок прогнозу: {printUtc(forecast.generatedAt)}. Дати подій: UTC.</p> : null}
    {forecast && (m.options.solarWheel || m.options.solarPositions || m.options.solarAspects || m.options.dates) ? forecast.warnings?.map((warning, index) => <p className="text-xs" key={index}>{warning.message}</p>) : null}
    {solar && (m.options.solarWheel || m.options.solarPositions || m.options.solarAspects) ? chartMeta(solar.chart) : null}
    {solar && m.options.solarWheel ? wheel(solar.chart, "Соляр", solar.exactAt) : null}
    {solar && (m.options.solarPositions || m.options.solarAspects) ? <><p className="text-sm">Соляр: {printUtc(solar.exactAt)}</p><ChartTables chart={solar.chart} positions={m.options.solarPositions} aspects={m.options.solarAspects} title="Соляр" /></> : null}
    {m.options.dates ? <section className="consultation-print-section space-y-3"><h2 className="text-lg font-semibold">Важливі дати</h2>
      <table className="consultation-print-table"><thead><tr><th>Дата й час (UTC)</th><th>Подія</th><th>Кут аспекту</th><th>Орбіс</th></tr></thead>
        <tbody>{m.events.filter((event) => m.selectedEvents.includes(event.id)).map((event) => <tr key={event.id}><td>{printUtc(event.exactAt)}</td><td>{eventDescription(event)}</td><td>{event.exactAngle !== undefined ? `${event.exactAngle}°` : "—"}</td><td>{event.orb !== undefined ? `${event.orb.toFixed(4)}°` : "—"}</td></tr>)}</tbody>
      </table></section> : null}
  </div>;
}
