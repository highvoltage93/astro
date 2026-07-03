"use client";

import { Calculator, MapPin, RotateCcw, Save, Search, Settings2 } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requestNatalPreview, saveBirthProfile, searchPlaces } from "@/lib/api";
import type { Aspect, ChartResult, NatalPreviewPayload, PlaceSearchResult } from "@/lib/chart-types";
import { cn } from "@/lib/utils";

type FormState = {
  displayName: string;
  birthDate: string;
  birthTime: string;
  birthplaceName: string;
  countryCode: string;
  latitude: string;
  longitude: string;
  timezone: string;
  houseSystem: string;
  zodiac: NatalPreviewPayload["zodiac"];
};

const initialForm: FormState = {
  displayName: "Натальна карта",
  birthDate: "1995-04-12",
  birthTime: "14:30",
  birthplaceName: "Kyiv, Ukraine",
  countryCode: "UA",
  latitude: "50.4501",
  longitude: "30.5234",
  timezone: "Europe/Kyiv",
  houseSystem: "placidus",
  zodiac: "tropical"
};

const houseSystems = [
  ["placidus", "Placidus"],
  ["whole-sign", "Whole Sign"],
  ["equal", "Equal"],
  ["koch", "Koch"],
  ["campanus", "Campanus"],
  ["regiomontanus", "Regiomontanus"],
  ["porphyry", "Porphyry"]
] as const;

const planetGlyphs: Record<string, string> = {
  sun: "☉",
  moon: "☽",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
  "north-node": "☊",
  chiron: "⚷",
  lilith: "⚸",
  asc: "AC",
  mc: "MC"
};

const signGlyphs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

const aspectLabels: Record<string, string> = {
  conjunction: "З'єднання",
  opposition: "Опозиція",
  trine: "Трин",
  square: "Квадрат",
  sextile: "Секстиль"
};

export function AstroWorkbench() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [placeSearchStatus, setPlaceSearchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);

  const placements = useMemo(() => {
    if (!chart) {
      return [];
    }

    return [...chart.angles, ...chart.bodies].sort((a, b) => a.longitude - b.longitude);
  }, [chart]);

  const updateForm = (field: keyof FormState, value: string): void => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
    setSaveStatus("idle");
    setSaveError(null);
    setSavedProfileId(null);
    setChart(null);
    setStatus("idle");

    if (field === "birthplaceName") {
      setPlaceResults([]);
      setPlaceError(null);
      setPlaceSearchStatus("idle");
    }
  };

  const resetForm = (): void => {
    setForm(initialForm);
    setChart(null);
    setStatus("idle");
    setSaveStatus("idle");
    setSaveError(null);
    setSavedProfileId(null);
    setPlaceResults([]);
    setPlaceError(null);
    setPlaceSearchStatus("idle");
  };

  const searchBirthplace = async (): Promise<void> => {
    if (form.birthplaceName.trim().length < 2) {
      setPlaceError("Введи щонайменше 2 символи для пошуку міста.");
      setPlaceSearchStatus("error");
      return;
    }

    setPlaceSearchStatus("loading");
    setPlaceError(null);

    try {
      const response = await searchPlaces(form.birthplaceName);
      setPlaceResults(response.results);
      setPlaceSearchStatus("ready");
    } catch (requestError) {
      setPlaceSearchStatus("error");
      setPlaceError(requestError instanceof Error ? requestError.message : "Unknown place search error");
    }
  };

  const selectBirthplace = (place: PlaceSearchResult): void => {
    setForm((current) => ({
      ...current,
      birthplaceName: place.displayName,
      countryCode: place.countryCode ?? "",
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: place.timezone ?? current.timezone
    }));
    setChart(null);
    setStatus("idle");
    setSaveStatus("idle");
    setSaveError(null);
    setSavedProfileId(null);
    setPlaceResults([]);
    setPlaceError(null);
    setPlaceSearchStatus("idle");
  };

  const buildNatalPayload = (): NatalPreviewPayload => ({
    birthDate: form.birthDate,
    birthTime: form.birthTime,
    timezone: form.timezone,
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    houseSystem: form.houseSystem,
    zodiac: form.zodiac
  });

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const result = await requestNatalPreview(buildNatalPayload());
      setChart(result);
      setStatus("ready");
    } catch (requestError) {
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "Unknown API error");
    }
  };

  const saveProfile = async (): Promise<void> => {
    setSaveStatus("saving");
    setSaveError(null);

    try {
      const result = await saveBirthProfile({
        ...buildNatalPayload(),
        displayName: form.displayName,
        birthTimeKnown: true,
        birthplaceName: form.birthplaceName,
        countryCode: form.countryCode || undefined
      });

      setSavedProfileId(result.birthProfile.id);
      setSaveStatus("saved");
    } catch (requestError) {
      setSaveStatus("error");
      setSaveError(requestError instanceof Error ? requestError.message : "Unknown API error");
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px]">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-primary">Astroprocessor</p>
            <h1 className="text-3xl font-semibold tracking-normal">Натальна карта</h1>
          </div>
          <nav className="flex w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1 lg:w-auto" aria-label="Розділи">
            <Button size="sm" type="button">
              Натал
            </Button>
            <Button size="sm" variant="ghost" type="button">
              Транзити
            </Button>
            <Button size="sm" variant="ghost" type="button">
              Синастрія
            </Button>
          </nav>
        </header>

        <section className="grid items-start gap-4 xl:grid-cols-[360px_minmax(360px,1fr)_420px]">
          <BirthDataCard
            error={error}
            form={form}
            placeError={placeError}
            placeResults={placeResults}
            placeSearchStatus={placeSearchStatus}
            status={status}
            onPlaceSearch={searchBirthplace}
            onPlaceSelect={selectBirthplace}
            onReset={resetForm}
            onSubmit={submit}
            onUpdate={updateForm}
          />

          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardDescription className="font-semibold uppercase text-primary">
                  {chart?.settings.houseSystem ?? "placidus"}
                </CardDescription>
                <CardTitle>{form.displayName}</CardTitle>
              </div>
              <Button
                size="icon"
                variant="secondary"
                type="button"
                aria-label="Зберегти карту"
                disabled={saveStatus === "saving"}
                onClick={saveProfile}
              >
                <Save />
              </Button>
            </CardHeader>
            <CardContent>
              <ChartWheel chart={chart} />
              <div className="mt-5 grid grid-cols-3 gap-2">
                <StatusBadge status={chart?.engine.status ?? "idle"} />
                <Badge variant="secondary" className="justify-center py-2">
                  {chart ? `${chart.bodies.length} об'єктів` : "0 об'єктів"}
                </Badge>
                <Badge variant="secondary" className="justify-center py-2">
                  {chart ? `${chart.aspects.length} аспектів` : "0 аспектів"}
                </Badge>
              </div>

              <SaveStateMessage error={saveError} profileId={savedProfileId} status={saveStatus} />
            </CardContent>
          </Card>

          <Card className="min-w-0 xl:sticky xl:top-5">
            <CardHeader>
              <CardDescription className="font-semibold uppercase text-primary">Data</CardDescription>
              <CardTitle>Положення</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="max-h-[348px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Точка</TableHead>
                      <TableHead>Знак</TableHead>
                      <TableHead>Дім</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {placements.length > 0 ? (
                      placements.map((placement) => (
                        <TableRow key={placement.key}>
                          <TableCell className="font-medium">
                            <span className="mr-2 inline-flex w-6 font-semibold text-primary">
                              {planetGlyphs[placement.key] ?? "•"}
                            </span>
                            {placement.label}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {placement.sign} {placement.signDegree.toFixed(2)}°
                          </TableCell>
                          <TableCell className="text-muted-foreground">{placement.house ?? "n/a"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">
                          Очікує дані карти
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <Separator />
              <AspectList aspects={chart?.aspects ?? []} />

              {chart?.warnings.map((warning) => (
                <div className="rounded-lg border border-astro-amber/30 bg-astro-amber/10 p-3 text-sm text-amber-900" key={warning.code}>
                  {warning.message}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function BirthDataCard({
  error,
  form,
  placeError,
  placeResults,
  placeSearchStatus,
  status,
  onPlaceSearch,
  onPlaceSelect,
  onReset,
  onSubmit,
  onUpdate
}: {
  error: string | null;
  form: FormState;
  placeError: string | null;
  placeResults: PlaceSearchResult[];
  placeSearchStatus: "idle" | "loading" | "ready" | "error";
  status: "idle" | "loading" | "ready" | "error";
  onPlaceSearch: () => Promise<void>;
  onPlaceSelect: (place: PlaceSearchResult) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (field: keyof FormState, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardDescription className="font-semibold uppercase text-primary">Birth data</CardDescription>
          <CardTitle>Дані народження</CardTitle>
        </div>
        <Button size="icon" variant="secondary" type="button" aria-label="Налаштування">
          <Settings2 />
        </Button>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="Назва карти">
            <Input value={form.displayName} onChange={(event) => onUpdate("displayName", event.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <Field label="Дата">
              <Input
                type="date"
                value={form.birthDate}
                onChange={(event) => onUpdate("birthDate", event.target.value)}
              />
            </Field>
            <Field label="Час">
              <Input
                type="time"
                value={form.birthTime}
                onChange={(event) => onUpdate("birthTime", event.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <Label>Місце</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={form.birthplaceName}
                onChange={(event) => onUpdate("birthplaceName", event.target.value)}
              />
              <Button
                variant="secondary"
                type="button"
                disabled={placeSearchStatus === "loading"}
                onClick={onPlaceSearch}
              >
                <Search />
                {placeSearchStatus === "loading" ? "Шукаю" : "Пошук"}
              </Button>
            </div>
            <PlaceSearchPanel
              error={placeError}
              results={placeResults}
              status={placeSearchStatus}
              onSelect={onPlaceSelect}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <Field label="Широта">
              <Input value={form.latitude} onChange={(event) => onUpdate("latitude", event.target.value)} />
            </Field>
            <Field label="Довгота">
              <Input value={form.longitude} onChange={(event) => onUpdate("longitude", event.target.value)} />
            </Field>
          </div>

          <Field label="Часовий пояс">
            <Input value={form.timezone} onChange={(event) => onUpdate("timezone", event.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <Field label="Система домів">
              <Select value={form.houseSystem} onValueChange={(value) => onUpdate("houseSystem", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {houseSystems.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Зодіак">
              <Select value={form.zodiac} onValueChange={(value) => onUpdate("zodiac", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tropical">Тропічний</SelectItem>
                  <SelectItem value="sidereal">Сидеричний</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Button type="submit" disabled={status === "loading"}>
              <Calculator />
              {status === "loading" ? "Рахую" : "Розрахувати"}
            </Button>
            <Button variant="secondary" type="button" onClick={onReset}>
              <RotateCcw />
              Скинути
            </Button>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PlaceSearchPanel({
  error,
  results,
  status,
  onSelect
}: {
  error: string | null;
  results: PlaceSearchResult[];
  status: "idle" | "loading" | "ready" | "error";
  onSelect: (place: PlaceSearchResult) => void;
}) {
  if (status === "idle" || status === "loading") {
    return null;
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? "Не вдалося знайти місце"}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
        Нічого не знайдено. Спробуй уточнити місто або країну.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {results.map((place) => (
        <button
          className="grid w-full gap-1 border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          key={`${place.provider}-${place.providerId}`}
          type="button"
          onClick={() => onSelect(place)}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-primary" />
            {place.displayName}
          </span>
          <span className="pl-6 text-xs text-muted-foreground">
            {place.timezone ?? "timezone n/a"} · {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
          </span>
        </button>
      ))}
    </div>
  );
}

function SaveStateMessage({
  error,
  profileId,
  status
}: {
  error: string | null;
  profileId: string | null;
  status: "idle" | "saving" | "saved" | "error";
}) {
  if (status === "idle") {
    return null;
  }

  if (status === "saving") {
    return (
      <div className="mt-4 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
        Зберігаю карту в базу даних...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? "Не вдалося зберегти карту"}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm text-primary">
      Карту збережено{profileId ? `: ${profileId}` : ""}.
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isStub = status === "stub";
  const isReady = status === "swiss-ephemeris";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "justify-center py-2",
        isStub && "bg-astro-amber/15 text-amber-900 hover:bg-astro-amber/20",
        isReady && "bg-primary/10 text-primary hover:bg-primary/15"
      )}
    >
      {status}
    </Badge>
  );
}

function ChartWheel({ chart }: { chart: ChartResult | null }) {
  const center = 160;
  const outerRadius = 138;
  const signRadius = 119;
  const pointRadius = 94;
  const aspectRadius = 70;

  const toXY = (longitude: number, radius: number): { x: number; y: number } => {
    const angle = ((longitude - 90) * Math.PI) / 180;

    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius
    };
  };

  const points = chart ? [...chart.angles, ...chart.bodies] : [];
  const pointsByKey = new Map(points.map((chartPoint) => [chartPoint.key, chartPoint]));

  return (
    <svg
      className="mx-auto aspect-square w-full max-w-[560px] overflow-visible"
      viewBox="0 0 320 320"
      role="img"
      aria-label="Колесо натальної карти"
    >
      <circle cx={center} cy={center} r={outerRadius} className="fill-none stroke-foreground stroke-[1.6]" />
      <circle cx={center} cy={center} r={pointRadius + 12} className="fill-none stroke-border stroke-[1.2]" />
      <circle
        cx={center}
        cy={center}
        r={aspectRadius}
        className="fill-none stroke-border stroke-[1.2] [stroke-dasharray:3_4]"
      />

      {Array.from({ length: 12 }, (_, index) => {
        const start = toXY(index * 30, outerRadius);
        const end = toXY(index * 30, aspectRadius);
        const sign = toXY(index * 30 + 15, signRadius);

        return (
          <g key={signGlyphs[index]}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="stroke-border stroke-[1]" />
            <text
              x={sign.x}
              y={sign.y}
              className="fill-muted-foreground text-lg [dominant-baseline:middle] [text-anchor:middle]"
            >
              {signGlyphs[index]}
            </text>
          </g>
        );
      })}

      {chart?.aspects.slice(0, 24).map((aspect) => {
        const pointA = pointsByKey.get(aspect.bodyA);
        const pointB = pointsByKey.get(aspect.bodyB);

        if (!pointA || !pointB) {
          return null;
        }

        const a = toXY(pointA.longitude, aspectRadius);
        const b = toXY(pointB.longitude, aspectRadius);

        return (
          <line
            key={`${aspect.bodyA}-${aspect.bodyB}-${aspect.type}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className={cn("stroke-[1.1] opacity-70", getAspectStrokeClass(aspect.type))}
          />
        );
      })}

      {points.map((chartPoint) => {
        const position = toXY(chartPoint.longitude, pointRadius);

        return (
          <g key={chartPoint.key}>
            <circle cx={position.x} cy={position.y} r="13" className="fill-background stroke-primary stroke-[1.4]" />
            <text
              x={position.x}
              y={position.y}
              className="fill-foreground text-xs font-bold [dominant-baseline:middle] [text-anchor:middle]"
            >
              {planetGlyphs[chartPoint.key] ?? chartPoint.label.slice(0, 2)}
            </text>
          </g>
        );
      })}

      {!chart ? (
        <text
          x={center}
          y={center}
          className="fill-muted-foreground text-sm font-semibold [dominant-baseline:middle] [text-anchor:middle]"
        >
          Очікує дані
        </text>
      ) : null}
    </svg>
  );
}

function AspectList({ aspects }: { aspects: Aspect[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Аспекти</h3>
      {aspects.length > 0 ? (
        <div className="space-y-1">
          {aspects.slice(0, 8).map((aspect) => (
            <div
              className="flex min-h-9 items-center justify-between gap-3 border-b text-sm last:border-b-0"
              key={`${aspect.bodyA}-${aspect.bodyB}-${aspect.type}`}
            >
              <span>
                {planetGlyphs[aspect.bodyA] ?? aspect.bodyA} {aspectLabels[aspect.type] ?? aspect.type}{" "}
                {planetGlyphs[aspect.bodyB] ?? aspect.bodyB}
              </span>
              <strong className="text-astro-coral">{aspect.orb.toFixed(2)}°</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Очікує розрахунок</p>
      )}
    </div>
  );
}

function getAspectStrokeClass(type: string): string {
  switch (type) {
    case "square":
      return "stroke-astro-coral";
    case "opposition":
      return "stroke-astro-violet";
    default:
      return "stroke-primary";
  }
}
