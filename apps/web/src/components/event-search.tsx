"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { planetLabelsUk, signLabelsUk, aspectLabels } from "@/lib/astrology-labels";
import { printDegree, printUtc } from "@/lib/consultation-print-assets";
import { eventKindLabels, eventPlanetKeys, searchEvents, type EventKind, type EventSearchResult } from "@/lib/event-search";
import type { NatalPreviewPayload } from "@/lib/chart-types";

const eclipseLabels: Record<string, string> = { total: "Повне", annular: "Кільцеподібне", hybrid: "Гібридне", partial: "Часткове", penumbral: "Півтіньове" };
export function EventSearch({ natal, token, disabled }: { natal: NatalPreviewPayload; token: string | null; disabled: boolean }) {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [through, setThrough] = useState(() => new Date(Date.now() + 29 * 86400000).toISOString().slice(0, 10));
  const [kinds, setKinds] = useState<EventKind[]>(Object.keys(eventKindLabels) as EventKind[]);
  const [planets, setPlanets] = useState(eventPlanetKeys);
  const [orb, setOrb] = useState("1");
  const [onlyAspected, setOnlyAspected] = useState(false);
  const [natalPoint, setNatalPoint] = useState("all");
  const [limit, setLimit] = useState(50);
  const [snapshot, setSnapshot] = useState<{ result: EventSearchResult; key: string; natal: NatalPreviewPayload } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const natalKey = JSON.stringify(natal);
  const key = JSON.stringify([natalKey, from, through, kinds, planets, orb]);
  useEffect(() => {
    controller.current?.abort(); requestNumber.current++; setLoading(false);
    return () => { controller.current?.abort(); requestNumber.current++; };
  }, [natalKey, token]);
  const run = async () => {
    if (!token || disabled || loading) return;
    const start = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${through}T00:00:00Z`) + 86400000;
    const aspectOrb = Number(orb);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 93 * 86400000 || !kinds.length || !planets.length || !orb.trim() || !Number.isFinite(aspectOrb) || aspectOrb < 0 || aspectOrb > 5) {
      setError("Вибери період до 93 днів, хоча б один тип подій і планету; орбіс має бути від 0 до 5°."); return;
    }
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    const number = ++requestNumber.current;
    setLoading(true); setError(null);
    try {
      const result = await searchEvents(token, { natal, from: new Date(start).toISOString(), until: new Date(end).toISOString(), kinds, planets, aspectOrb }, active.signal);
      if (number !== requestNumber.current) return;
      setSnapshot({ result, key, natal: structuredClone(natal) }); setLimit(50);
    } catch (failure) {
      if (number === requestNumber.current && !active.signal.aborted) setError(failure instanceof Error ? failure.message : "Пошук не завершено.");
    } finally { if (number === requestNumber.current) setLoading(false); }
  };
  const events = snapshot?.result.events.filter((event) => (!onlyAspected || event.natalAspects.length > 0) &&
    (natalPoint === "all" || event.natalAspects.some((aspect) => aspect.bodyB === natalPoint))) ?? [];
  return <section className="min-w-0 space-y-4 border-t pt-4">
    <h2 className="text-lg font-semibold">Професійний пошук подій</h2>
    <fieldset disabled={disabled || loading} className="min-w-0 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm"><span>Від (UTC)</span><Input type="date" min="1900-01-01" max="2100-12-31" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>До включно (UTC)</span><Input type="date" min="1900-01-01" max="2100-12-31" value={through} onChange={(event) => setThrough(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>Орбіс до натальних планет, °</span><Input type="number" min={0} max={5} step={0.1} value={orb} onChange={(event) => setOrb(event.target.value)} /></label>
      </div>
      <fieldset><legend className="mb-2 text-sm font-medium">Події</legend><div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(eventKindLabels) as EventKind[]).map((kind) => <label key={kind} className="flex items-center gap-2 text-sm"><Checkbox checked={kinds.includes(kind)} onCheckedChange={(checked) => setKinds((current) => checked === true ? [...current, kind] : current.filter((item) => item !== kind))} />{eventKindLabels[kind]}</label>)}
      </div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-medium">Планети для інгресій і розворотів</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {eventPlanetKeys.map((planet) => <label key={planet} className="flex items-center gap-2 text-sm"><Checkbox checked={planets.includes(planet)} onCheckedChange={(checked) => setPlanets((current) => checked === true ? [...current, planet] : current.filter((item) => item !== planet))} />{planetLabelsUk[planet]}</label>)}
      </div></fieldset>
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <Button disabled={disabled || !token || loading} onClick={() => void run()}><Search />{loading ? "Шукаю події…" : "Знайти події"}</Button>
      {snapshot ? <Button variant="outline" title="JSON із вихідними даними народження та результатом" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, natal: snapshot.natal, result: snapshot.result }, null, 2)], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "astro-events-private.json"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}><Download />Експорт JSON</Button> : null}
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {snapshot ? <>
      <p className="break-words text-xs text-muted-foreground">Знімок: {printUtc(snapshot.result.generatedAt)} · {snapshot.result.zodiac === "sidereal" ? "Сидеричний" : "Тропічний"} зодіак · Період: {printUtc(snapshot.result.from)} — {printUtc(snapshot.result.until)} (кінець не включено)</p>
      {snapshot.key !== key ? <p role="status" className="text-sm text-destructive">Параметри змінено. Нижче залишився попередній результат пошуку.</p> : null}
      {snapshot.result.warnings.map((warning, index) => <p className="text-sm text-destructive" key={`${warning.code}:${index}`}>{warning.message}</p>)}
      <div className="flex flex-wrap items-center gap-3 border-y py-3">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={onlyAspected} onCheckedChange={(checked) => { setOnlyAspected(checked === true); setLimit(50); }} />Лише з натальними аспектами</label>
        <Select value={natalPoint} onValueChange={(value) => { setNatalPoint(value); setLimit(50); }}><SelectTrigger className="w-full sm:w-52" aria-label="Натальна планета"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="all">Усі натальні планети</SelectItem>{eventPlanetKeys.map((planet) => <SelectItem key={planet} value={planet}>{planetLabelsUk[planet]}</SelectItem>)}
        </SelectContent></Select>
        <span className="text-sm text-muted-foreground">Подій: {events.length}</span>
      </div>
      <div className="divide-y">{events.slice(0, limit).map((event) => <article key={event.id} className="min-w-0 space-y-2 py-3">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-semibold">{eventKindLabels[event.kind]} · {planetLabelsUk[event.pointKey]}</h3><time className="text-xs" dateTime={event.exactAt}>{printUtc(event.exactAt)}</time></div>
        <p className="text-sm">{event.kind === "ingress" ? `${signLabelsUk[event.fromSign ?? ""]} → ${signLabelsUk[event.toSign ?? ""]}` : `${signLabelsUk[event.sign]} ${printDegree(event.signDegree)}`}
          {event.motion ? ` · ${event.motion === "retrograde" ? "Ретроградний рух" : "Директний рух"}` : ""}
          {event.eclipseType ? ` · ${eclipseLabels[event.eclipseType] ?? event.eclipseType} · Глобальний максимум, не локальна видимість` : ""}</p>
        <ul className="space-y-1 text-xs text-muted-foreground">{event.natalAspects.map((aspect, index) => <li key={index}>{planetLabelsUk[aspect.bodyA]} — натальний {planetLabelsUk[aspect.bodyB]}: {aspectLabels[aspect.type]}; кут {aspect.exactAngle}°; орбіс {aspect.orb.toFixed(4)}°</li>)}</ul>
        {!event.natalAspects.length ? <p className="text-xs text-muted-foreground">Натальних аспектів у заданому орбісі немає.</p> : null}
      </article>)}</div>
      {!events.length ? <p className="text-sm text-muted-foreground">Подій за цими умовами не знайдено.</p> : null}
      {events.length > limit ? <Button variant="outline" onClick={() => setLimit((count) => count + 50)}>Ще 50 подій</Button> : null}
    </> : null}
  </section>;
}
