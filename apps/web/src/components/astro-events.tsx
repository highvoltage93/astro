"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Loader2, Moon, Orbit, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReturnPlaceSearch } from "@/components/return-place-search";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { planetLabelsUk, signLabelsUk } from "@/lib/astrology-labels";
import { astroEventLabels, type AstroEventCategory, type AstroEventRow, type AstroEventsResult } from "@/lib/astro-events";

const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const groups = [{ key: "moon", label: "Рух Місяця" }, { key: "retrograde", label: "Ретроградність" }, { key: "eclipses", label: "Коридори затемнень" }, { key: "ingress", label: "Зміна знаків" }];
const moonTabs = [{ key: "lunar-days", label: "Місячні дні" }, { key: "void-moon", label: "Місяць без курсу" }, { key: "moon-phases", label: "Фази Місяця" }];
const eclipseTypes: Record<string, string> = { total: "повне", annular: "кільцеподібне", hybrid: "гібридне", partial: "часткове", penumbral: "півтіньове" };

function Tabs({ items, value, onChange, label }: { items: { key: string; label: string }[]; value: string; onChange: (key: string) => void; label: string }) {
  return <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b pb-2">{items.map((item, index) => <Button key={item.key}
    type="button" role="tab" aria-selected={value === item.key} aria-controls="astro-events-panel" tabIndex={value === item.key ? 0 : -1}
    variant={value === item.key ? "secondary" : "ghost"} onClick={() => onChange(item.key)}
    onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
      onChange(items[next]!.key);
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}>{item.label}</Button>)}</div>;
}

function EventRow({ row, timezone }: { row: AstroEventRow; timezone: string }) {
  const format = (value: string) => DateTime.fromISO(value, { setZone: true }).setZone(timezone).toFormat("dd.MM.yyyy HH:mm:ss (ZZ)");
  const title = row.kind === "lunar-day" ? `${row.day}-й місячний день`
    : ["retrograde", "ingress"].includes(row.kind) ? planetLabelsUk[row.pointKey ?? ""] : astroEventLabels[row.kind] ?? row.kind;
  return <li className="grid min-w-0 gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div className="min-w-0 space-y-2 break-words"><h3 className="font-semibold">{title}</h3>
      {row.sign ? <p className="text-sm text-muted-foreground">{signLabelsUk[row.sign]}{row.toSign ? ` → ${signLabelsUk[row.toSign]}` : ""}{row.degree !== undefined ? ` · ${row.degree.toFixed(2)}°` : ""}{row.motion ? ` · ${row.motion === "retrograde" ? "ретроградний рух" : "директний рух"}` : ""}</p> : null}
      {row.kind === "void-moon" ? <p className="text-sm text-muted-foreground">{row.pointKey ? `Останній аспект: Місяць · ${row.aspectAngle}° · ${planetLabelsUk[row.pointKey]}` : "Без точних мажорних аспектів у цьому знаку"}</p> : null}
      {row.eclipses ? <ul className="space-y-2 text-sm">{row.eclipses.map((eclipse) => <li key={`${eclipse.kind}:${eclipse.at}`}>
        {astroEventLabels[eclipse.kind]} · {eclipseTypes[eclipse.type] ?? eclipse.type}<time className="block text-muted-foreground" dateTime={eclipse.at}>{format(eclipse.at)}</time>
      </li>)}</ul> : null}
    </div>
    <dl className="min-w-0 space-y-2 break-words text-sm tabular-nums">
      <div><dt className="text-xs text-muted-foreground">{row.clippedStart ? "Уже триває на початок періоду" : row.end ? "Початок" : "Точний момент"}</dt><dd><time dateTime={row.start}>{format(row.start)}</time></dd></div>
      {row.end ? <div><dt className="text-xs text-muted-foreground">{row.clippedEnd ? "Триває після кінця періоду" : "Завершення"}</dt><dd><time dateTime={row.end}>{format(row.end)}</time></dd></div> : null}
    </dl>
  </li>;
}

export function AstroEventsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [group, setGroup] = useState("moon");
  const [moonTab, setMoonTab] = useState("lunar-days");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [period, setPeriod] = useState("month");
  const [planet, setPlanet] = useState("all");
  const [timezone, setTimezone] = useState("Europe/Kyiv");
  const [place, setPlace] = useState({ name: "Київ, Україна", latitude: 50.4501, longitude: 30.5234 });
  const [pendingPlace, setPendingPlace] = useState(false);
  const [snapshot, setSnapshot] = useState<{ key: string; result: AstroEventsResult; timezone: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(80);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const category = (group === "moon" ? moonTab : group) as AstroEventCategory;
  const annual = group !== "moon" && period === "year";
  const numericYear = Number(year), numericMonth = Number(month);
  const start = Number.isInteger(numericYear) && numericYear >= 1900 && numericYear <= 2100 && Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12
    ? DateTime.fromObject({ year: numericYear, month: annual ? 1 : numericMonth, day: 1 }, { zone: timezone }) : DateTime.invalid("year");
  const end = start.isValid ? start.plus(annual ? { years: 1 } : { months: 1 }) : start;
  const input = { category, from: start.toUTC().toISO(), until: end.toUTC().toISO(), latitude: place.latitude, longitude: place.longitude,
    lunarDayMethod: "moonrise", ...(["retrograde", "ingress"].includes(group) && planet !== "all" ? { planet } : {}) };
  const key = JSON.stringify({ ...input, timezone, pendingPlace });
  const result = snapshot?.key === key ? snapshot.result : null;

  useEffect(() => {
    const value = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!value) router.replace("/login?next=/astro-events"); else setToken(value);
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_STORAGE_KEY || event.key === null) {
        request.current?.abort(); setToken(null); setSnapshot(null); router.replace("/login?next=/astro-events");
      }
    };
    window.addEventListener("storage", changed);
    return () => { request.current?.abort(); window.removeEventListener("storage", changed); };
  }, [router]);
  useEffect(() => { sequence.current++; request.current?.abort(); setLoading(false); setError(""); setLimit(80); }, [key]);

  async function calculate() {
    if (!token || !start.isValid || pendingPlace) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const number = ++sequence.current;
    setLoading(true); setError("");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/astro-events`, {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(input)
      });
      const body = await response.json();
      if (controller.signal.aborted || number !== sequence.current) return;
      if (response.status === 401 || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) !== token) {
        setToken(null); setSnapshot(null); router.replace("/login?next=/astro-events"); return;
      }
      if (!response.ok) throw new Error(body.message ?? "Не вдалося завантажити події.");
      setSnapshot({ key, result: body as AstroEventsResult, timezone }); setLimit(80);
    } catch (failure) {
      if (!controller.signal.aborted && number === sequence.current) setError(failure instanceof Error ? failure.message : "Не вдалося завантажити події.");
    } finally { if (!controller.signal.aborted && number === sequence.current) setLoading(false); }
  }
  function movePeriod(direction: number) {
    if (!start.isValid) return;
    const next = start.plus(annual ? { years: direction } : { months: direction });
    setYear(String(next.year)); setMonth(String(next.month));
  }

  if (!token) return <main className="p-6"><p role="status">Перевіряю доступ…</p></main>;
  return <main className="app-shell-background min-h-screen px-3 py-5 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-center gap-3"><Orbit className="size-6 shrink-0 text-primary" /><h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">Астроподії<BetaBadge /></h1></header>
      <Tabs items={groups} value={group} onChange={setGroup} label="Розділи астроподій" />
      {group === "moon" ? <Tabs items={moonTabs} value={moonTab} onChange={setMoonTab} label="Рух Місяця" /> : null}
      <section id="astro-events-panel" role="tabpanel" aria-label={group === "moon" ? moonTabs.find((tab) => tab.key === moonTab)?.label : groups.find((tab) => tab.key === group)?.label} className="space-y-5">
        <form onSubmit={(event) => { event.preventDefault(); void calculate(); }} className="grid gap-3 border-b pb-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><span className="text-sm">Період</span><div className="flex gap-2">
            <Button type="button" size="icon" variant="outline" title="Попередній період" aria-label="Попередній період" onClick={() => movePeriod(-1)}><ChevronLeft /></Button>
            <Select value={group === "moon" ? "month" : period} disabled={group === "moon"} onValueChange={setPeriod}><SelectTrigger aria-label="Період"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">Місяць</SelectItem><SelectItem value="year">Рік</SelectItem></SelectContent></Select>
            <Button type="button" size="icon" variant="outline" title="Наступний період" aria-label="Наступний період" onClick={() => movePeriod(1)}><ChevronRight /></Button>
          </div></div>
          <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-sm">Рік<Input type="number" min={1900} max={2100} required value={year} onChange={(event) => setYear(event.target.value)} /></label>
            <div className="space-y-1 text-sm"><span>Місяць</span><Select disabled={annual} value={month} onValueChange={setMonth}><SelectTrigger aria-label="Місяць"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, index) => <SelectItem key={index} value={String(index + 1)}>{DateTime.utc(2026, index + 1, 1).setLocale("uk").toFormat("LLLL")}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="space-y-1 text-sm"><span>Місто</span><ReturnPlaceSearch name={place.name} label="Місто астроподій" onPendingChange={setPendingPlace} onSelect={(selected) => {
            setPlace({ name: selected.displayName, latitude: selected.latitude, longitude: selected.longitude }); setTimezone(selected.timezone ?? "");
          }} /></div>
          <label className="space-y-1 text-sm">Часовий пояс<Input value={timezone} required placeholder="Europe/Kyiv" onChange={(event) => setTimezone(event.target.value)} /></label>
          {["retrograde", "ingress"].includes(group) ? <div className="space-y-1 text-sm"><span>Планета</span><Select value={planet} onValueChange={setPlanet}><SelectTrigger aria-label="Планета"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Усі планети</SelectItem>{planets.map((item) => <SelectItem key={item} value={item}>{planetLabelsUk[item]}</SelectItem>)}</SelectContent></Select></div> : null}
          <div className="flex items-end"><Button type="submit" disabled={loading || !start.isValid || pendingPlace}>{loading ? <Loader2 className="animate-spin" /> : <Search />}{loading ? "Розраховую…" : "Показати події"}</Button></div>
          {!start.isValid ? <p role="alert" className="text-sm text-destructive sm:col-span-2">Перевірте рік і часовий пояс.</p> : null}
        </form>
        {error ? <p role="alert" className="text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{group === "moon" ? <Moon className="size-4" /> : <CalendarDays className="size-4" />}<span>Тропічний зодіак · {timezone}</span>
          {category === "lunar-days" ? <span>· День 1 від молодика, наступні від сходу Місяця</span> : null}
          {category === "void-moon" ? <span>· Аспекти 0°, 60°, 90°, 120°, 180° до Сонця та планет до Плутона</span> : null}
          {category === "eclipses" ? <span>· Глобальні максимуми затемнень, не локальна видимість</span> : null}
        </div>
        {loading ? <p role="status" className="text-muted-foreground">Обчислення подій…</p> : null}
        {result ? <>
          <p className="text-sm text-muted-foreground">{place.name} · {result.rows.length} подій</p>
          {result.warnings.map((warning, index) => <p role="status" key={`${warning.code}:${index}`} className="border-l-2 border-primary pl-3 text-sm">{warning.message}</p>)}
          {!result.rows.length ? <p className="py-6 text-muted-foreground">За обраний період подій немає.</p> : <ol className="divide-y border-y">{result.rows.slice(0, limit).map((row) => <EventRow key={row.id} row={row} timezone={snapshot!.timezone} />)}</ol>}
          {result.rows.length > limit ? <Button variant="outline" onClick={() => setLimit((value) => value + 80)}><ChevronDown />Ще події</Button> : null}
        </> : !loading && !error ? <p className="py-6 text-muted-foreground">Події ще не розраховані.</p> : null}
      </section>
    </div>
  </main>;
}
