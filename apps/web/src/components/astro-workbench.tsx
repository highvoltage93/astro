"use client";

import {
  BookOpenText,
  Calculator,
  Activity,
  FolderOpen,
  MapPin,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Trash2
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  deleteBirthProfile,
  getBirthProfile,
  listBirthProfiles,
  requestForecastPreview,
  requestNatalInterpretation,
  requestNatalPreview,
  requestSynastryPreview,
  requestTransitPreview,
  saveBirthProfile,
  searchPlaces
} from "@/lib/api";
import type {
  Aspect,
  ChartPoint,
  ChartResult,
  EssentialDignity,
  ExactTransitEvent,
  ForecastPreviewResult,
  HouseConnection,
  HouseRuler,
  MoonPhase,
  NatalInterpretationPreview,
  NatalPreviewPayload,
  PlanetRulership,
  PlaceSearchResult,
  ReturnEvent,
  SavedBirthProfile,
  SynastryPreviewResult,
  TransitPreviewResult
} from "@/lib/chart-types";
import { cn } from "@/lib/utils";

type FormState = {
  displayName: string;
  birthDate: string;
  birthTime: string;
  birthTimeKnown: boolean;
  birthplaceName: string;
  countryCode: string;
  latitude: string;
  longitude: string;
  timezone: string;
  houseSystem: string;
  zodiac: NatalPreviewPayload["zodiac"];
};

type PointOrbSettings = Record<string, number>;
type VisiblePointSettings = Record<string, boolean>;

const initialForm: FormState = {
  displayName: "Натальна карта",
  birthDate: "1995-04-12",
  birthTime: "14:30:27",
  birthTimeKnown: true,
  birthplaceName: "Kyiv, Ukraine",
  countryCode: "UA",
  latitude: "50.4501",
  longitude: "30.5234",
  timezone: "Europe/Kyiv",
  houseSystem: "placidus",
  zodiac: "tropical"
};

const initialPartnerForm: FormState = {
  displayName: "Партнер",
  birthDate: "1992-09-18",
  birthTime: "09:15:00",
  birthTimeKnown: true,
  birthplaceName: "Lviv, Ukraine",
  countryCode: "UA",
  latitude: "49.8397",
  longitude: "24.0297",
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
  "south-node": "☋",
  chiron: "⚷",
  lilith: "⚸",
  asc: "AC",
  desc: "DC",
  ic: "IC",
  mc: "MC"
};

const defaultPointOrbs: PointOrbSettings = {
  sun: 8,
  moon: 8,
  mercury: 6,
  venus: 6,
  mars: 6,
  jupiter: 6,
  saturn: 6,
  uranus: 5,
  neptune: 5,
  pluto: 5,
  "north-node": 3,
  "south-node": 3,
  chiron: 3,
  lilith: 3,
  asc: 5,
  mc: 5
};

const orbSettingRows = [
  ["sun", "Sun"],
  ["moon", "Moon"],
  ["mercury", "Mercury"],
  ["venus", "Venus"],
  ["mars", "Mars"],
  ["jupiter", "Jupiter"],
  ["saturn", "Saturn"],
  ["uranus", "Uranus"],
  ["neptune", "Neptune"],
  ["pluto", "Pluto"],
  ["north-node", "North Node"],
  ["south-node", "South Node"],
  ["chiron", "Chiron"],
  ["lilith", "Lilith"],
  ["asc", "Ascendant"],
  ["mc", "Midheaven"]
] as const;

const chartObjectRows = [
  ["sun", "Sun"],
  ["moon", "Moon"],
  ["mercury", "Mercury"],
  ["venus", "Venus"],
  ["mars", "Mars"],
  ["jupiter", "Jupiter"],
  ["saturn", "Saturn"],
  ["uranus", "Uranus"],
  ["neptune", "Neptune"],
  ["pluto", "Pluto"],
  ["north-node", "North Node"],
  ["south-node", "South Node"],
  ["chiron", "Chiron"],
  ["lilith", "Lilith"],
  ["asc", "Ascendant"],
  ["desc", "Descendant"],
  ["ic", "Imum Coeli"],
  ["mc", "Midheaven"]
] as const;

const defaultVisiblePointKeys: VisiblePointSettings = Object.fromEntries(
  chartObjectRows.map(([key]) => [key, true])
) as VisiblePointSettings;

const classicalBalancePointKeys = new Set([
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto"
]);

const zodiacSigns = [
  { key: "aries", glyph: "♈", label: "Овен", gender: "чоловічий", cross: "кардинальний", element: "вогонь" },
  { key: "taurus", glyph: "♉", label: "Телець", gender: "жіночий", cross: "фіксований", element: "земля" },
  { key: "gemini", glyph: "♊", label: "Близнюки", gender: "чоловічий", cross: "мутабельний", element: "повітря" },
  { key: "cancer", glyph: "♋", label: "Рак", gender: "жіночий", cross: "кардинальний", element: "вода" },
  { key: "leo", glyph: "♌", label: "Лев", gender: "чоловічий", cross: "фіксований", element: "вогонь" },
  { key: "virgo", glyph: "♍", label: "Діва", gender: "жіночий", cross: "мутабельний", element: "земля" },
  { key: "libra", glyph: "♎", label: "Терези", gender: "чоловічий", cross: "кардинальний", element: "повітря" },
  { key: "scorpio", glyph: "♏", label: "Скорпіон", gender: "жіночий", cross: "фіксований", element: "вода" },
  { key: "sagittarius", glyph: "♐", label: "Стрілець", gender: "чоловічий", cross: "мутабельний", element: "вогонь" },
  { key: "capricorn", glyph: "♑", label: "Козеріг", gender: "жіночий", cross: "кардинальний", element: "земля" },
  { key: "aquarius", glyph: "♒", label: "Водолій", gender: "чоловічий", cross: "фіксований", element: "повітря" },
  { key: "pisces", glyph: "♓", label: "Риби", gender: "жіночий", cross: "мутабельний", element: "вода" }
] as const;

const signGlyphs = zodiacSigns.map((sign) => sign.glyph);
const zodiacSignMetaByKey: Record<string, (typeof zodiacSigns)[number]> = Object.fromEntries(
  zodiacSigns.map((sign) => [sign.key, sign])
) as Record<string, (typeof zodiacSigns)[number]>;

const signRulers: Record<string, Array<{ key: string; label: string; rulerType: "modern" | "traditional" }>> = {
  aries: [{ key: "mars", label: "Mars", rulerType: "modern" }],
  taurus: [{ key: "venus", label: "Venus", rulerType: "modern" }],
  gemini: [{ key: "mercury", label: "Mercury", rulerType: "modern" }],
  cancer: [{ key: "moon", label: "Moon", rulerType: "modern" }],
  leo: [{ key: "sun", label: "Sun", rulerType: "modern" }],
  virgo: [{ key: "mercury", label: "Mercury", rulerType: "modern" }],
  libra: [{ key: "venus", label: "Venus", rulerType: "modern" }],
  scorpio: [
    { key: "pluto", label: "Pluto", rulerType: "modern" },
    { key: "mars", label: "Mars", rulerType: "traditional" }
  ],
  sagittarius: [{ key: "jupiter", label: "Jupiter", rulerType: "modern" }],
  capricorn: [{ key: "saturn", label: "Saturn", rulerType: "modern" }],
  aquarius: [
    { key: "uranus", label: "Uranus", rulerType: "modern" },
    { key: "saturn", label: "Saturn", rulerType: "traditional" }
  ],
  pisces: [
    { key: "neptune", label: "Neptune", rulerType: "modern" },
    { key: "jupiter", label: "Jupiter", rulerType: "traditional" }
  ]
};

const rulerTypeLabelsUk: Record<string, string> = {
  modern: "сучасний",
  traditional: "традиційний"
};

const motionLabelsUk: Record<string, string> = {
  direct: "директний",
  retrograde: "ретроградний",
  stationary: "стаціонарний"
};

const syntheticElementLabelsUk: Record<string, string> = {
  fire: "вогонь",
  earth: "земля",
  air: "повітря",
  water: "вода"
};

const syntheticCrossLabelsUk: Record<string, string> = {
  cardinal: "кардинальний",
  fixed: "фіксований",
  mutable: "мутабельний"
};

const aspectLabels: Record<string, string> = {
  conjunction: "З'єднання",
  opposition: "Опозиція",
  trine: "Трин",
  square: "Квадрат",
  sextile: "Секстиль"
};

const aspectGlyphs: Record<string, string> = {
  conjunction: "☌",
  opposition: "☍",
  trine: "△",
  square: "□",
  sextile: "⚹"
};

const signLabelsUk: Record<string, string> = {
  aries: "Овен",
  taurus: "Телець",
  gemini: "Близнюки",
  cancer: "Рак",
  leo: "Лев",
  virgo: "Діва",
  libra: "Терези",
  scorpio: "Скорпіон",
  sagittarius: "Стрілець",
  capricorn: "Козеріг",
  aquarius: "Водолій",
  pisces: "Риби"
};

const dignityLabelsUk: Record<string, string> = {
  domicile: "обитель",
  exaltation: "екзальтація",
  detriment: "вигнання",
  fall: "падіння",
  peregrine: "перегрин"
};

const moonPhaseLabelsUk: Record<string, string> = {
  new: "Новий Місяць",
  "waxing-crescent": "Зростаючий серп",
  "first-quarter": "Перша чверть",
  "waxing-gibbous": "Зростаючий опуклий",
  full: "Повня",
  "waning-gibbous": "Спадний опуклий",
  "last-quarter": "Остання чверть",
  "waning-crescent": "Спадний серп"
};

const houseTopicsUk: Record<number, string> = {
  1: "тіло, образ, старт",
  2: "гроші, ресурси, цінності",
  3: "мислення, навчання, контакти",
  4: "дім, родина, корені",
  5: "творчість, діти, романтика",
  6: "робота, здоров'я, рутина",
  7: "партнерство, домовленості",
  8: "кризи, близькість, спільні ресурси",
  9: "сенс, подорожі, навчання",
  10: "кар'єра, статус, напрям",
  11: "друзі, спільноти, плани",
  12: "підсвідоме, відновлення, тиша"
};

const transitPhaseLabelsUk: Record<string, string> = {
  applying: "сходиться",
  separating: "розходиться",
  exact: "точний",
  stationary: "стаціонарно"
};

const transitStrengthLabelsUk: Record<string, string> = {
  high: "сильний",
  medium: "середній",
  low: "м'який"
};

const toDateTimeLocalValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
};

const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;

const formatMoonPhase = (phase: MoonPhase | null): string =>
  phase ? `${moonPhaseLabelsUk[phase.name] ?? phase.name} · ${Math.round(phase.illuminatedFraction * 100)}%` : "n/a";

const formatExactAt = (exactAt: string | null): string => {
  if (!exactAt) {
    return "точний час поза вікном прогнозу";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(exactAt));
};

const formatDateTimeCompact = (dateTime: string | null): string => {
  if (!dateTime) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateTime));
};

const formatActiveWindow = ({
  activeFrom,
  activeUntil,
  durationDays
}: {
  activeFrom: string | null;
  activeUntil: string | null;
  durationDays: number | null;
}): string => {
  if (!activeFrom || !activeUntil || durationDays === null) {
    return "активне вікно поза межами прогнозу";
  }

  return `${formatDateTimeCompact(activeFrom)} - ${formatDateTimeCompact(activeUntil)} · ${durationDays.toFixed(1)} дн.`;
};

const formatHouseList = (houses: number[] | undefined): string => {
  if (!houses || houses.length === 0) {
    return "n/a";
  }

  return houses.join(", ");
};

const getRuledHouseNumbers = (chart: ChartResult | null | undefined, pointKey: string): number[] => {
  const rulership = chart?.planetRulerships?.find((item) => item.pointKey === pointKey);

  if (rulership) {
    return rulership.houses;
  }

  return [
    ...new Set(
      chart?.houseRulers
        ?.filter((ruler) => ruler.rulerKey === pointKey)
        .map((ruler) => ruler.house) ?? []
    )
  ].sort((a, b) => a - b);
};

const motionLabelForPoint = (point: ChartPoint | undefined): string => {
  if (!point || point.speed === undefined) {
    return "рух n/a";
  }

  if (Math.abs(point.speed) < 0.0001) {
    return motionLabelsUk.stationary ?? "стаціонарний";
  }

  return point.speed < 0
    ? motionLabelsUk.retrograde ?? "ретроградний"
    : motionLabelsUk.direct ?? "директний";
};

const formatPointTooltip = (point: ChartPoint, chart?: ChartResult | null): string => {
  const house = point.house ? `${point.house} дім` : "дім n/a";
  const speed = point.speed === undefined ? "" : `\nШвидкість: ${point.speed.toFixed(4)}°/день`;
  const ruledHouses = formatHouseList(getRuledHouseNumbers(chart, point.key));

  return `${point.label}\nЗнак: ${signLabelsUk[point.sign] ?? point.sign}\nГрадус знака: ${point.signDegree.toFixed(
    2
  )}°\nАбсолютна довгота: ${point.longitude.toFixed(2)}°\n${house}\nПравить домами: ${ruledHouses}${speed}`;
};

const formatSignTooltip = (sign: (typeof zodiacSigns)[number], chart?: ChartResult | null): string => {
  const pointsByKey = new Map(chart?.bodies.map((point) => [point.key, point]) ?? []);
  const rulers = signRulers[sign.key] ?? [];
  const directRulers = rulers.filter((ruler) => motionLabelForPoint(pointsByKey.get(ruler.key)) !== motionLabelsUk.retrograde);
  const retrogradeRulers = rulers.filter((ruler) => motionLabelForPoint(pointsByKey.get(ruler.key)) === motionLabelsUk.retrograde);
  const formatRuler = (ruler: (typeof rulers)[number]): string =>
    `${planetGlyphs[ruler.key] ?? ""} ${ruler.label} (${rulerTypeLabelsUk[ruler.rulerType]}, ${motionLabelForPoint(
      pointsByKey.get(ruler.key)
    )})`;

  return [
    sign.label,
    `Стать: ${sign.gender}`,
    `Хрест: ${sign.cross}`,
    `Стихія: ${sign.element}`,
    `Директні правителі: ${directRulers.map(formatRuler).join(", ") || "немає"}`,
    `Ретроградні правителі: ${retrogradeRulers.map(formatRuler).join(", ") || "немає"}`
  ].join("\n");
};

const isPointVisible = (settings: VisiblePointSettings, key: string): boolean => settings[key] !== false;

const formatMotion = (point: ChartPoint): string => {
  if (point.speed === undefined) {
    return "n/a";
  }

  if (Math.abs(point.speed) < 0.0001) {
    return "S";
  }

  return point.speed < 0 ? `R ${Math.abs(point.speed).toFixed(4)}` : `D ${point.speed.toFixed(4)}`;
};

const formatPointPosition = (point: ChartPoint | null): string => {
  if (!point) {
    return "n/a";
  }

  const house = point.house ? ` · ${point.house} дім` : "";

  return `${signLabelsUk[point.sign] ?? point.sign} ${point.signDegree.toFixed(2)}°${house}`;
};

export function AstroWorkbench() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [partnerForm, setPartnerForm] = useState<FormState>(initialPartnerForm);
  const [pointOrbs, setPointOrbs] = useState<PointOrbSettings>(defaultPointOrbs);
  const [visiblePointKeys, setVisiblePointKeys] = useState<VisiblePointSettings>(defaultVisiblePointKeys);
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [interpretation, setInterpretation] = useState<NatalInterpretationPreview | null>(null);
  const [transitDateTime, setTransitDateTime] = useState("");
  const [transitPreview, setTransitPreview] = useState<TransitPreviewResult | null>(null);
  const [forecastFromDateTime, setForecastFromDateTime] = useState("");
  const [forecastTargetYear, setForecastTargetYear] = useState(String(new Date().getFullYear()));
  const [forecastDays, setForecastDays] = useState("90");
  const [forecastPreview, setForecastPreview] = useState<ForecastPreviewResult | null>(null);
  const [synastryPreview, setSynastryPreview] = useState<SynastryPreviewResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [transitStatus, setTransitStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [forecastStatus, setForecastStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [synastryStatus, setSynastryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [savedProfilesStatus, setSavedProfilesStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [placeSearchStatus, setPlaceSearchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [partnerPlaceSearchStatus, setPartnerPlaceSearchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [partnerPlaceResults, setPartnerPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [savedProfiles, setSavedProfiles] = useState<SavedBirthProfile[]>([]);
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interpretationError, setInterpretationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [transitError, setTransitError] = useState<string | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [synastryError, setSynastryError] = useState<string | null>(null);
  const [savedProfilesError, setSavedProfilesError] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [partnerPlaceError, setPartnerPlaceError] = useState<string | null>(null);
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);

  const placements = useMemo(() => {
    if (!chart) {
      return [];
    }

    return [...chart.angles, ...chart.bodies].sort((a, b) => a.longitude - b.longitude);
  }, [chart]);

  const visiblePlacements = useMemo(
    () => placements.filter((placement) => isPointVisible(visiblePointKeys, placement.key)),
    [placements, visiblePointKeys]
  );

  const visibleAspects = useMemo(() => {
    if (!chart) {
      return [];
    }

    return chart.aspects.filter(
      (aspect) => isPointVisible(visiblePointKeys, aspect.bodyA) && isPointVisible(visiblePointKeys, aspect.bodyB)
    );
  }, [chart, visiblePointKeys]);

  const clearForecastState = (): void => {
    setForecastPreview(null);
    setForecastError(null);
    setForecastStatus("idle");
  };

  const updateForm = <Field extends keyof FormState>(field: Field, value: FormState[Field]): void => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
    setSaveStatus("idle");
    setSaveError(null);
    setSavedProfileId(null);
    setChart(null);
    setInterpretation(null);
    setInterpretationError(null);
    setTransitPreview(null);
    setTransitError(null);
    setTransitStatus("idle");
    clearForecastState();
    setSynastryPreview(null);
    setSynastryError(null);
    setSynastryStatus("idle");
    setStatus("idle");

    if (field === "birthplaceName") {
      setPlaceResults([]);
      setPlaceError(null);
      setPlaceSearchStatus("idle");
    }
  };

  const updatePointOrb = (key: string, value: string): void => {
    const nextValue = Number(value);

    setPointOrbs((current) => ({
      ...current,
      [key]: Number.isFinite(nextValue) ? Math.max(0, Math.min(15, nextValue)) : 0
    }));
    setSaveStatus("idle");
    setSaveError(null);
    setSavedProfileId(null);
    setChart(null);
    setInterpretation(null);
    setInterpretationError(null);
    setTransitPreview(null);
    setTransitError(null);
    setTransitStatus("idle");
    clearForecastState();
    setSynastryPreview(null);
    setSynastryError(null);
    setSynastryStatus("idle");
    setStatus("idle");
  };

  const updatePartnerForm = <Field extends keyof FormState>(field: Field, value: FormState[Field]): void => {
    setPartnerForm((current) => ({
      ...current,
      [field]: value
    }));
    setSynastryPreview(null);
    setSynastryError(null);
    setSynastryStatus("idle");

    if (field === "birthplaceName") {
      setPartnerPlaceResults([]);
      setPartnerPlaceError(null);
      setPartnerPlaceSearchStatus("idle");
    }
  };

  const updatePointVisibility = (key: string, checked: boolean): void => {
    setVisiblePointKeys((current) => ({
      ...current,
      [key]: checked
    }));
  };

  const setVisibilityPreset = (preset: "all" | "classical"): void => {
    setVisiblePointKeys(
      Object.fromEntries(
        chartObjectRows.map(([key]) => [
          key,
          preset === "all" || classicalBalancePointKeys.has(key) || key === "asc" || key === "mc"
        ])
      ) as VisiblePointSettings
    );
  };

  const resetForm = (): void => {
    setForm(initialForm);
    setPartnerForm(initialPartnerForm);
    setPointOrbs(defaultPointOrbs);
    setVisiblePointKeys(defaultVisiblePointKeys);
    setChart(null);
    setInterpretation(null);
    setInterpretationError(null);
    setTransitPreview(null);
    setTransitError(null);
    setTransitStatus("idle");
    clearForecastState();
    setSynastryPreview(null);
    setSynastryError(null);
    setSynastryStatus("idle");
    setStatus("idle");
    setSaveStatus("idle");
    setSaveError(null);
    setSavedProfileId(null);
    setPlaceResults([]);
    setPlaceError(null);
    setPlaceSearchStatus("idle");
    setPartnerPlaceResults([]);
    setPartnerPlaceError(null);
    setPartnerPlaceSearchStatus("idle");
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
    setInterpretation(null);
    setInterpretationError(null);
    setTransitPreview(null);
    setTransitError(null);
    setTransitStatus("idle");
    clearForecastState();
    setSynastryPreview(null);
    setSynastryError(null);
    setSynastryStatus("idle");
    setStatus("idle");
    setSaveStatus("idle");
    setSaveError(null);
    setSavedProfileId(null);
    setPlaceResults([]);
    setPlaceError(null);
    setPlaceSearchStatus("idle");
  };

  const searchPartnerBirthplace = async (): Promise<void> => {
    if (partnerForm.birthplaceName.trim().length < 2) {
      setPartnerPlaceError("Введи щонайменше 2 символи для пошуку міста.");
      setPartnerPlaceSearchStatus("error");
      return;
    }

    setPartnerPlaceSearchStatus("loading");
    setPartnerPlaceError(null);

    try {
      const response = await searchPlaces(partnerForm.birthplaceName);
      setPartnerPlaceResults(response.results);
      setPartnerPlaceSearchStatus("ready");
    } catch (requestError) {
      setPartnerPlaceSearchStatus("error");
      setPartnerPlaceError(requestError instanceof Error ? requestError.message : "Unknown place search error");
    }
  };

  const selectPartnerBirthplace = (place: PlaceSearchResult): void => {
    setPartnerForm((current) => ({
      ...current,
      birthplaceName: place.displayName,
      countryCode: place.countryCode ?? "",
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: place.timezone ?? current.timezone
    }));
    setSynastryPreview(null);
    setSynastryError(null);
    setSynastryStatus("idle");
    setPartnerPlaceResults([]);
    setPartnerPlaceError(null);
    setPartnerPlaceSearchStatus("idle");
  };

  const buildNatalPayloadFromForm = (source: FormState): NatalPreviewPayload => ({
    birthDate: source.birthDate,
    birthTime: source.birthTime,
    birthTimeKnown: source.birthTimeKnown,
    timezone: source.timezone,
    latitude: Number(source.latitude),
    longitude: Number(source.longitude),
    houseSystem: source.houseSystem,
    zodiac: source.zodiac,
    pointOrbs
  });

  const buildNatalPayload = (): NatalPreviewPayload => buildNatalPayloadFromForm(form);

  const refreshSavedProfiles = async (): Promise<void> => {
    setSavedProfilesStatus("loading");
    setSavedProfilesError(null);

    try {
      const response = await listBirthProfiles();
      setSavedProfiles(response.profiles);
      setSavedProfilesStatus("ready");
    } catch (requestError) {
      setSavedProfilesStatus("error");
      setSavedProfilesError(requestError instanceof Error ? requestError.message : "Unknown saved profiles error");
    }
  };

  useEffect(() => {
    const now = new Date();

    setTransitDateTime((current) => current || toDateTimeLocalValue(now));
    setForecastFromDateTime((current) => current || toDateTimeLocalValue(now));
    setForecastTargetYear((current) => current || String(now.getFullYear()));
    void refreshSavedProfiles();
  }, []);

  const loadSavedProfile = async (profile: SavedBirthProfile): Promise<void> => {
    setLoadingProfileId(profile.id);
    setSavedProfilesError(null);

    try {
      const response = await getBirthProfile(profile.id);
      const detailedProfile = response.profile;
      const calculation = response.latestCalculation;

      setForm({
        displayName: detailedProfile.displayName,
        birthDate: detailedProfile.birthDate,
        birthTime: detailedProfile.birthTime ?? "12:00:00",
        birthTimeKnown: detailedProfile.birthTimeKnown,
        birthplaceName: detailedProfile.birthplaceName,
        countryCode: detailedProfile.countryCode ?? "",
        latitude: String(detailedProfile.latitude),
        longitude: String(detailedProfile.longitude),
        timezone: detailedProfile.timezone,
        houseSystem: detailedProfile.latestCalculation?.houseSystem ?? "placidus",
        zodiac: detailedProfile.latestCalculation?.zodiacType ?? "tropical"
      });
      setPointOrbs(calculation?.result.settings.pointOrbs ?? defaultPointOrbs);
      setChart(calculation?.result ?? null);
      setInterpretation(response.interpretation);
      setInterpretationError(null);
      setTransitPreview(null);
      setTransitError(null);
      setTransitStatus("idle");
      clearForecastState();
      setSynastryPreview(null);
      setSynastryError(null);
      setSynastryStatus("idle");
      setStatus(calculation ? "ready" : "idle");
      setSaveStatus("saved");
      setSaveError(null);
      setSavedProfileId(detailedProfile.id);
      setPlaceResults([]);
      setPlaceError(null);
      setPlaceSearchStatus("idle");
      setSavedProfilesStatus("ready");
    } catch (requestError) {
      setSavedProfilesStatus("error");
      setSavedProfilesError(requestError instanceof Error ? requestError.message : "Unknown saved profile error");
    } finally {
      setLoadingProfileId(null);
    }
  };

  const deleteSavedProfile = async (profile: SavedBirthProfile): Promise<void> => {
    const confirmed = window.confirm(`Видалити карту "${profile.displayName}"?`);

    if (!confirmed) {
      return;
    }

    setDeletingProfileId(profile.id);
    setSavedProfilesError(null);

    try {
      const response = await deleteBirthProfile(profile.id);
      setSavedProfiles((current) => current.filter((savedProfile) => savedProfile.id !== response.deletedProfileId));

      if (savedProfileId === response.deletedProfileId) {
        setSavedProfileId(null);
        setSaveStatus("idle");
        setSaveError(null);
      }

      setSavedProfilesStatus("ready");
    } catch (requestError) {
      setSavedProfilesStatus("error");
      setSavedProfilesError(requestError instanceof Error ? requestError.message : "Unknown delete profile error");
    } finally {
      setDeletingProfileId(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setInterpretationError(null);
    setInterpretation(null);
    setSynastryPreview(null);
    setSynastryError(null);
    setSynastryStatus("idle");
    clearForecastState();

    try {
      const payload = buildNatalPayload();
      const [chartResult, interpretationResult] = await Promise.allSettled([
        requestNatalPreview(payload),
        requestNatalInterpretation(payload)
      ]);

      if (chartResult.status === "rejected") {
        throw chartResult.reason;
      }

      setChart(chartResult.value);

      if (interpretationResult.status === "fulfilled") {
        setInterpretation(interpretationResult.value);
      } else {
        setInterpretationError(
          interpretationResult.reason instanceof Error
            ? interpretationResult.reason.message
            : "Unable to load interpretation"
        );
      }

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
        birthplaceName: form.birthplaceName,
        countryCode: form.countryCode || undefined
      });

      setSavedProfileId(result.birthProfile.id);
      setSaveStatus("saved");
      await refreshSavedProfiles();
    } catch (requestError) {
      setSaveStatus("error");
      setSaveError(requestError instanceof Error ? requestError.message : "Unknown API error");
    }
  };

  const calculateTransits = async (): Promise<void> => {
    if (!transitDateTime) {
      setTransitStatus("error");
      setTransitError("Вкажи дату і час транзиту.");
      return;
    }

    const selectedTransitDate = new Date(transitDateTime);

    if (Number.isNaN(selectedTransitDate.getTime())) {
      setTransitStatus("error");
      setTransitError("Вкажи коректну дату і час транзиту.");
      return;
    }

    setTransitStatus("loading");
    setTransitError(null);

    try {
      const result = await requestTransitPreview({
        transitDateTime: selectedTransitDate.toISOString(),
        natal: buildNatalPayload(),
        zodiac: form.zodiac,
        pointOrbs
      });

      setTransitPreview(result);
      setTransitStatus("ready");
    } catch (requestError) {
      setTransitStatus("error");
      setTransitError(requestError instanceof Error ? requestError.message : "Unknown transit API error");
    }
  };

  const calculateForecast = async (): Promise<void> => {
    if (!forecastFromDateTime) {
      setForecastStatus("error");
      setForecastError("Вкажи стартову дату прогнозу.");
      return;
    }

    const selectedForecastDate = new Date(forecastFromDateTime);
    const parsedTargetYear = Number(forecastTargetYear);
    const parsedDays = Number(forecastDays);

    if (Number.isNaN(selectedForecastDate.getTime())) {
      setForecastStatus("error");
      setForecastError("Вкажи коректну стартову дату прогнозу.");
      return;
    }

    if (!Number.isInteger(parsedTargetYear) || parsedTargetYear < 1900 || parsedTargetYear > 2100) {
      setForecastStatus("error");
      setForecastError("Рік соляра має бути між 1900 і 2100.");
      return;
    }

    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 366) {
      setForecastStatus("error");
      setForecastError("Період точних транзитів має бути від 1 до 366 днів.");
      return;
    }

    setForecastStatus("loading");
    setForecastError(null);

    try {
      const result = await requestForecastPreview({
        fromDateTime: selectedForecastDate.toISOString(),
        natal: buildNatalPayload(),
        targetYear: parsedTargetYear,
        days: parsedDays,
        zodiac: form.zodiac,
        pointOrbs
      });

      setForecastPreview(result);
      setForecastStatus("ready");
    } catch (requestError) {
      setForecastStatus("error");
      setForecastError(requestError instanceof Error ? requestError.message : "Unknown forecast API error");
    }
  };

  const calculateSynastry = async (): Promise<void> => {
    setSynastryStatus("loading");
    setSynastryError(null);

    try {
      const result = await requestSynastryPreview({
        subjectA: buildNatalPayload(),
        subjectB: buildNatalPayloadFromForm(partnerForm),
        zodiac: form.zodiac,
        pointOrbs
      });

      setSynastryPreview(result);
      setSynastryStatus("ready");
    } catch (requestError) {
      setSynastryStatus("error");
      setSynastryError(requestError instanceof Error ? requestError.message : "Unknown synastry API error");
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
          <div className="space-y-4">
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
            <OrbSettingsCard pointOrbs={pointOrbs} onUpdate={updatePointOrb} />
            <ChartObjectSettingsCard
              visiblePointKeys={visiblePointKeys}
              onPreset={setVisibilityPreset}
              onToggle={updatePointVisibility}
            />
            <SavedProfilesCard
              deletingProfileId={deletingProfileId}
              error={savedProfilesError}
              loadingProfileId={loadingProfileId}
              profiles={savedProfiles}
              status={savedProfilesStatus}
              onDelete={deleteSavedProfile}
              onLoad={loadSavedProfile}
              onRefresh={refreshSavedProfiles}
            />
          </div>

          <div className="min-w-0 space-y-4">
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
                <ChartWheel chart={chart} visiblePointKeys={visiblePointKeys} />
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <StatusBadge status={chart?.engine.status ?? "idle"} />
                  <Badge variant="secondary" className="justify-center py-2">
                    {chart ? `${visiblePlacements.length}/${placements.length} точок` : "0 точок"}
                  </Badge>
                  <Badge variant="secondary" className="justify-center py-2">
                    {chart ? `${visibleAspects.length}/${chart.aspects.length} аспектів` : "0 аспектів"}
                  </Badge>
                </div>

                <SaveStateMessage error={saveError} profileId={savedProfileId} status={saveStatus} />
              </CardContent>
            </Card>

            <InterpretationCard error={interpretationError} interpretation={interpretation} status={status} />
            <ForecastModuleCard
              days={forecastDays}
              error={forecastError}
              fromDateTime={forecastFromDateTime}
              preview={forecastPreview}
              status={forecastStatus}
              targetYear={forecastTargetYear}
              onCalculate={calculateForecast}
              onDaysChange={(value) => {
                setForecastDays(value);
                clearForecastState();
              }}
              onFromDateTimeChange={(value) => {
                setForecastFromDateTime(value);
                clearForecastState();
              }}
              onTargetYearChange={(value) => {
                setForecastTargetYear(value);
                clearForecastState();
              }}
            />
            <TransitForecastCard
              error={transitError}
              preview={transitPreview}
              status={transitStatus}
              transitDateTime={transitDateTime}
              onCalculate={calculateTransits}
              onTransitDateTimeChange={setTransitDateTime}
            />
            <SynastryCard
              error={synastryError}
              form={partnerForm}
              placeError={partnerPlaceError}
              placeResults={partnerPlaceResults}
              placeSearchStatus={partnerPlaceSearchStatus}
              preview={synastryPreview}
              status={synastryStatus}
              subjectAName={form.displayName}
              onCalculate={calculateSynastry}
              onPlaceSearch={searchPartnerBirthplace}
              onPlaceSelect={selectPartnerBirthplace}
              onUpdate={updatePartnerForm}
            />
          </div>

          <ProfessionalDataCard aspects={visibleAspects} chart={chart} placements={visiblePlacements} />
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
  onUpdate: <Field extends keyof FormState>(field: Field, value: FormState[Field]) => void;
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
                step={1}
                disabled={!form.birthTimeKnown}
                value={form.birthTime}
                onChange={(event) => onUpdate("birthTime", event.target.value)}
              />
            </Field>
          </div>

          <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm leading-5">
            <Checkbox
              checked={form.birthTimeKnown}
              className="mt-0.5"
              onCheckedChange={(checked) => onUpdate("birthTimeKnown", checked === true)}
            />
            <span>
              <span className="block font-medium">Час народження відомий</span>
              <span className="text-muted-foreground">
                Якщо вимкнути, карта рахує планети на 12:00 локального часу без Ascendant, MC і домів.
              </span>
            </span>
          </label>

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
              <Select
                value={form.zodiac}
                onValueChange={(value) => onUpdate("zodiac", value as NatalPreviewPayload["zodiac"])}
              >
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

function OrbSettingsCard({
  pointOrbs,
  onUpdate
}: {
  pointOrbs: PointOrbSettings;
  onUpdate: (key: string, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Settings2 className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <CardDescription className="font-semibold uppercase text-primary">Orbs</CardDescription>
          <CardTitle>Налаштування орбісів</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {orbSettingRows.map(([key, label]) => (
            <label className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-2 text-sm" key={key}>
              <span className="min-w-0 truncate">
                <span className="mr-2 inline-flex w-7 font-semibold text-primary">{planetGlyphs[key] ?? "•"}</span>
                {label}
              </span>
              <Input
                type="number"
                min={0}
                max={15}
                step={0.5}
                value={pointOrbs[key] ?? 0}
                onChange={(event) => onUpdate(key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartObjectSettingsCard({
  visiblePointKeys,
  onPreset,
  onToggle
}: {
  visiblePointKeys: VisiblePointSettings;
  onPreset: (preset: "all" | "classical") => void;
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Settings2 className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <CardDescription className="font-semibold uppercase text-primary">Objects</CardDescription>
          <CardTitle>Планети і точки</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" type="button" onClick={() => onPreset("all")}>
            Усі точки
          </Button>
          <Button size="sm" variant="secondary" type="button" onClick={() => onPreset("classical")}>
            Базові
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {chartObjectRows.map(([key, label]) => (
            <label
              className="flex min-h-9 items-center gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm"
              key={key}
            >
              <Checkbox checked={isPointVisible(visiblePointKeys, key)} onCheckedChange={(checked) => onToggle(key, checked === true)} />
              <span className="min-w-0 flex-1 truncate">
                <span className="mr-2 inline-flex w-7 font-semibold text-primary">{planetGlyphs[key] ?? "•"}</span>
                {label}
              </span>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SavedProfilesCard({
  deletingProfileId,
  error,
  loadingProfileId,
  profiles,
  status,
  onDelete,
  onLoad,
  onRefresh
}: {
  deletingProfileId: string | null;
  error: string | null;
  loadingProfileId: string | null;
  profiles: SavedBirthProfile[];
  status: "idle" | "loading" | "ready" | "error";
  onDelete: (profile: SavedBirthProfile) => Promise<void>;
  onLoad: (profile: SavedBirthProfile) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardDescription className="font-semibold uppercase text-primary">Saved charts</CardDescription>
          <CardTitle>Збережені карти</CardTitle>
        </div>
        <Button size="icon" variant="secondary" type="button" aria-label="Оновити список" onClick={onRefresh}>
          <RefreshCw className={cn(status === "loading" && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "idle" ? (
          <p className="text-sm text-muted-foreground">Онови список, щоб побачити останні збережені карти.</p>
        ) : null}

        {status === "error" ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error ?? "Не вдалося завантажити збережені карти"}
          </div>
        ) : null}

        {status === "ready" && profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Збережених карт ще немає.</p>
        ) : null}

        {profiles.length > 0 ? (
          <div className="space-y-2">
            {profiles.map((profile) => {
              const isLoading = loadingProfileId === profile.id;
              const isDeleting = deletingProfileId === profile.id;
              const isBusy = isLoading || isDeleting;

              return (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2 rounded-lg border p-2"
                  key={profile.id}
                >
                  <button
                    className="grid min-w-0 gap-1 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                    disabled={isBusy}
                    type="button"
                    onClick={() => onLoad(profile)}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      ) : (
                        <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className="truncate">{profile.displayName}</span>
                    </span>
                    <span className="pl-6 text-xs text-muted-foreground">
                      {profile.birthDate} · {profile.birthTimeKnown ? profile.birthTime : "час невідомий"}
                    </span>
                    <span className="truncate pl-6 text-xs text-muted-foreground">{profile.birthplaceName}</span>
                  </button>
                  <Button
                    size="icon"
                    variant="destructive"
                    type="button"
                    aria-label={`Видалити карту ${profile.displayName}`}
                    disabled={isBusy}
                    onClick={() => onDelete(profile)}
                  >
                    {isDeleting ? <RefreshCw className="animate-spin" /> : <Trash2 />}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
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

function InterpretationCard({
  error,
  interpretation,
  status
}: {
  error: string | null;
  interpretation: NatalInterpretationPreview | null;
  status: "idle" | "loading" | "ready" | "error";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BookOpenText className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <CardDescription className="font-semibold uppercase text-primary">Interpretation</CardDescription>
          <CardTitle>Базова трактовка</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "loading" ? (
          <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
            Готую базові трактування...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!interpretation && status !== "loading" && !error ? (
          <p className="text-sm text-muted-foreground">Розрахуй карту, щоб побачити перший шар інтерпретації.</p>
        ) : null}

        {interpretation ? (
          <>
            <p className="rounded-lg border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
              {interpretation.summary}
            </p>
            <div className="space-y-3">
              {interpretation.highlights.map((highlight) => (
                <article className="rounded-lg border p-4" key={highlight.factorKey}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{highlight.title}</h3>
                    <Badge variant="outline">{highlight.source}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{highlight.body}</p>
                </article>
              ))}
            </div>
            {interpretation.missingFactorKeys.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Missing content: {interpretation.missingFactorKeys.join(", ")}
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ForecastModuleCard({
  days,
  error,
  fromDateTime,
  preview,
  status,
  targetYear,
  onCalculate,
  onDaysChange,
  onFromDateTimeChange,
  onTargetYearChange
}: {
  days: string;
  error: string | null;
  fromDateTime: string;
  preview: ForecastPreviewResult | null;
  status: "idle" | "loading" | "ready" | "error";
  targetYear: string;
  onCalculate: () => Promise<void>;
  onDaysChange: (value: string) => void;
  onFromDateTimeChange: (value: string) => void;
  onTargetYearChange: (value: string) => void;
}) {
  const exactTransits = preview?.exactTransits ?? [];
  const highPriorityTransits = exactTransits.filter((event) => event.strength === "high").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <CardDescription className="font-semibold uppercase text-primary">Forecast v1</CardDescription>
          <CardTitle>Прогностичний модуль</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.7fr_auto]">
          <Field label="Старт прогнозу">
            <Input
              type="datetime-local"
              value={fromDateTime}
              onChange={(event) => onFromDateTimeChange(event.target.value)}
            />
          </Field>
          <Field label="Днів транзитів">
            <Input
              min={1}
              max={366}
              type="number"
              value={days}
              onChange={(event) => onDaysChange(event.target.value)}
            />
          </Field>
          <Field label="Рік соляра">
            <Input
              min={1900}
              max={2100}
              type="number"
              value={targetYear}
              onChange={(event) => onTargetYearChange(event.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" disabled={status === "loading"} onClick={onCalculate}>
              <Activity />
              {status === "loading" ? "Рахую" : "Порахувати"}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!preview && status !== "loading" && !error ? (
          <p className="text-sm text-muted-foreground">
            Модуль рахує соляр, найближчий лунар і точні дати major-транзитів до натальних точок у вибраному вікні.
          </p>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <ForecastMetric label="Соляр" value={preview.solarReturn ? formatDateTimeCompact(preview.solarReturn.exactAt) : "n/a"} />
              <ForecastMetric label="Лунар" value={preview.lunarReturn ? formatDateTimeCompact(preview.lunarReturn.exactAt) : "n/a"} />
              <ForecastMetric label="Точних транзитів" value={`${exactTransits.length} · ${highPriorityTransits} сильних`} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <ReturnEventPanel event={preview.solarReturn} title="Соляр" />
              <ReturnEventPanel event={preview.lunarReturn} title="Лунар" />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Точні дати транзитів</h3>
                <Badge variant="secondary">{exactTransits.length}</Badge>
              </div>
              <ExactTransitsTable events={exactTransits} />
            </div>

            {preview.warnings.map((warning) => (
              <div
                className="rounded-lg border border-astro-amber/30 bg-astro-amber/10 p-3 text-sm text-amber-900"
                key={`forecast-warning-${warning.code}`}
              >
                {warning.message}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ForecastMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ReturnEventPanel({ event, title }: { event: ReturnEvent | null; title: string }) {
  const targetPoint = event?.chart.bodies.find((point) => point.key === event.targetPointKey) ?? null;
  const ascendant = event?.chart.angles.find((point) => point.key === "asc") ?? null;
  const midheaven = event?.chart.angles.find((point) => point.key === "mc") ?? null;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant={event ? "secondary" : "outline"}>{event ? formatExactAt(event.exactAt) : "не знайдено"}</Badge>
      </div>
      {event ? (
        <div className="grid gap-2 text-sm">
          <ReturnPointRow label={event.targetPointKey === "sun" ? "Сонце" : "Місяць"} point={targetPoint} />
          <ReturnPointRow label="ASC" point={ascendant} />
          <ReturnPointRow label="MC" point={midheaven} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Повернення не знайдено в пошуковому вікні.</p>
      )}
    </div>
  );
}

function ReturnPointRow({ label, point }: { label: string; point: ChartPoint | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2">
      <span className="font-medium">{label}</span>
      <span className="text-right text-muted-foreground">{formatPointPosition(point)}</span>
    </div>
  );
}

function ExactTransitsTable({ events }: { events: ExactTransitEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">У вибраному вікні точних major-транзитів не знайдено.</p>;
  }

  return (
    <div className="max-h-[460px] overflow-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Транзит</TableHead>
            <TableHead>Аспект</TableHead>
            <TableHead>Натал</TableHead>
            <TableHead>Дім</TableHead>
            <TableHead>Сила</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.slice(0, 36).map((event) => (
            <TableRow key={`exact-${event.bodyA}-${event.type}-${event.bodyB}-${event.exactAt}`}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTimeCompact(event.exactAt)}</TableCell>
              <TableCell className="font-medium">
                {planetGlyphs[event.bodyA] ?? event.bodyA} {event.transitPointLabel}
              </TableCell>
              <TableCell className={cn("font-medium", getAspectTextClass(event.type))}>
                {aspectLabels[event.type] ?? event.type}
              </TableCell>
              <TableCell className="font-medium">
                {planetGlyphs[event.bodyB] ?? event.bodyB} {event.natalPointLabel}
              </TableCell>
              <TableCell className="text-muted-foreground">{event.natalHouse ?? "n/a"}</TableCell>
              <TableCell className="text-muted-foreground">
                {transitStrengthLabelsUk[event.strength] ?? event.strength} · {event.score.toFixed(1)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {events.length > 36 ? (
        <p className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Показано перші 36 подій із {events.length}. Зменш період, щоб сфокусувати консультаційне вікно.
        </p>
      ) : null}
    </div>
  );
}

function TransitForecastCard({
  error,
  preview,
  status,
  transitDateTime,
  onCalculate,
  onTransitDateTimeChange
}: {
  error: string | null;
  preview: TransitPreviewResult | null;
  status: "idle" | "loading" | "ready" | "error";
  transitDateTime: string;
  onCalculate: () => Promise<void>;
  onTransitDateTimeChange: (value: string) => void;
}) {
  const moon = preview?.transit.bodies.find((point) => point.key === "moon") ?? null;
  const moonPhase = preview?.moonPhase ?? null;
  const transitHousePlacements = preview?.transitHousePlacements ?? [];
  const transitPoints = new Map(preview?.transit.bodies.map((point) => [point.key, point]) ?? []);
  const natalPoints = new Map([...(preview?.natal.angles ?? []), ...(preview?.natal.bodies ?? [])].map((point) => [point.key, point]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <CardDescription className="font-semibold uppercase text-primary">Forecast</CardDescription>
          <CardTitle>Транзити</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Field label="Дата і час прогнозу">
            <Input
              type="datetime-local"
              value={transitDateTime}
              onChange={(event) => onTransitDateTimeChange(event.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" disabled={status === "loading"} onClick={onCalculate}>
              <Activity />
              {status === "loading" ? "Рахую" : "Порахувати"}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!preview && status !== "loading" && !error ? (
          <p className="text-sm text-muted-foreground">
            Порахуй транзити, щоб побачити поточні планети й найточніші аспекти до натальної карти.
          </p>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Місяць зараз</p>
                <p className="mt-1 text-sm font-medium">
                  {moon ? `${signLabelsUk[moon.sign] ?? moon.sign} ${moon.signDegree.toFixed(2)}°` : "n/a"}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Фаза</p>
                <p className="mt-1 text-sm font-medium">{formatMoonPhase(moonPhase)}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Транзитів</p>
                <p className="mt-1 text-sm font-medium">{preview.transit.bodies.length} тіл</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Аспектів</p>
                <p className="mt-1 text-sm font-medium">{preview.transitToNatalAspects.length} до наталу</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Транзитні планети в натальних домах</h3>
              {transitHousePlacements.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {transitHousePlacements.slice(0, 10).map((point) => (
                    <div className="rounded-lg border px-3 py-2 text-sm" key={`house-transit-${point.key}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {planetGlyphs[point.key] ?? point.key} {point.label}
                        </span>
                        <Badge variant="secondary">{point.house ?? "n/a"} дім</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {point.house ? houseTopicsUk[point.house] ?? "тема дому" : "дім не визначено"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Для транзитів по домах потрібен відомий час народження і розраховані натальні доми.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Найточніші транзити до наталу</h3>
              {preview.transitToNatalAspects.length > 0 ? (
                <div className="space-y-1">
                  {preview.transitToNatalAspects.slice(0, 8).map((aspect) => {
                    const transitPoint = transitPoints.get(aspect.bodyA);
                    const natalPoint = natalPoints.get(aspect.bodyB);

                    return (
                      <div
                        className="grid gap-2 rounded-lg border px-3 py-2 text-sm"
                        key={`transit-${aspect.bodyA}-${aspect.type}-${aspect.bodyB}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0">
                            <span className="font-medium">
                              {planetGlyphs[aspect.bodyA] ?? aspect.bodyA} {transitPoint?.label ?? aspect.bodyA}
                            </span>{" "}
                            {aspectLabels[aspect.type] ?? aspect.type} натальний{" "}
                            <span className="font-medium">
                              {planetGlyphs[aspect.bodyB] ?? aspect.bodyB} {natalPoint?.label ?? aspect.bodyB}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{transitPhaseLabelsUk[aspect.phase] ?? aspect.phase}</Badge>
                            <Badge variant="outline">{transitStrengthLabelsUk[aspect.strength] ?? aspect.strength}</Badge>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Exact: {formatExactAt(aspect.exactAt)}</span>
                          <span>
                            score {aspect.score.toFixed(1)} · orb{" "}
                            <strong className="text-astro-coral">{aspect.orb.toFixed(2)}°</strong>
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Active:{" "}
                          {formatActiveWindow({
                            activeFrom: aspect.activeFrom,
                            activeUntil: aspect.activeUntil,
                            durationDays: aspect.durationDays
                          })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Немає major aspects у поточних орбах.</p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Найближчі 7 днів</h3>
              <div className="space-y-2">
                {preview.weekAhead.map((day) => {
                  const strongestAspect = day.strongestAspects[0];
                  const transitPoint = strongestAspect ? transitPoints.get(strongestAspect.bodyA) : null;
                  const natalPoint = strongestAspect ? natalPoints.get(strongestAspect.bodyB) : null;

                  return (
                    <div className="rounded-lg border p-3" key={day.date}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{day.date}</p>
                        <Badge variant="secondary">
                          {day.moon
                            ? `${signLabelsUk[day.moon.sign] ?? day.moon.sign} ${day.moon.signDegree.toFixed(1)}°${
                                day.moon.house ? ` · ${day.moon.house} дім` : ""
                              }`
                            : "Moon n/a"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatMoonPhase(day.moonPhase)}</p>
                      {strongestAspect ? (
                        <div className="mt-2 space-y-1 text-sm">
                          <p>
                            <span className="font-medium">
                              {planetGlyphs[strongestAspect.bodyA] ?? strongestAspect.bodyA}{" "}
                              {transitPoint?.label ?? strongestAspect.bodyA}
                            </span>{" "}
                            {aspectLabels[strongestAspect.type] ?? strongestAspect.type} натальний{" "}
                            <span className="font-medium">
                              {planetGlyphs[strongestAspect.bodyB] ?? strongestAspect.bodyB}{" "}
                              {natalPoint?.label ?? strongestAspect.bodyB}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {transitPhaseLabelsUk[strongestAspect.phase] ?? strongestAspect.phase} · Exact:{" "}
                            {formatExactAt(strongestAspect.exactAt)} · score {strongestAspect.score.toFixed(1)} · orb{" "}
                            <strong className="text-astro-coral">{strongestAspect.orb.toFixed(2)}°</strong>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Active:{" "}
                            {formatActiveWindow({
                              activeFrom: strongestAspect.activeFrom,
                              activeUntil: strongestAspect.activeUntil,
                              durationDays: strongestAspect.durationDays
                            })}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Без major aspects у поточних орбах.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SynastryCard({
  error,
  form,
  placeError,
  placeResults,
  placeSearchStatus,
  preview,
  status,
  subjectAName,
  onCalculate,
  onPlaceSearch,
  onPlaceSelect,
  onUpdate
}: {
  error: string | null;
  form: FormState;
  placeError: string | null;
  placeResults: PlaceSearchResult[];
  placeSearchStatus: "idle" | "loading" | "ready" | "error";
  preview: SynastryPreviewResult | null;
  status: "idle" | "loading" | "ready" | "error";
  subjectAName: string;
  onCalculate: () => Promise<void>;
  onPlaceSearch: () => Promise<void>;
  onPlaceSelect: (place: PlaceSearchResult) => void;
  onUpdate: <Field extends keyof FormState>(field: Field, value: FormState[Field]) => void;
}) {
  const subjectAPoints = new Map([...(preview?.subjectA.angles ?? []), ...(preview?.subjectA.bodies ?? [])].map((point) => [point.key, point]));
  const subjectBPoints = new Map([...(preview?.subjectB.angles ?? []), ...(preview?.subjectB.bodies ?? [])].map((point) => [point.key, point]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <CardDescription className="font-semibold uppercase text-primary">Synastry</CardDescription>
          <CardTitle>Синастрія</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ім'я / назва другої карти">
            <Input value={form.displayName} onChange={(event) => onUpdate("displayName", event.target.value)} />
          </Field>
          <Field label="Часовий пояс">
            <Input value={form.timezone} onChange={(event) => onUpdate("timezone", event.target.value)} />
          </Field>
          <Field label="Дата">
            <Input type="date" value={form.birthDate} onChange={(event) => onUpdate("birthDate", event.target.value)} />
          </Field>
          <Field label="Час">
            <Input
              type="time"
              step={1}
              disabled={!form.birthTimeKnown}
              value={form.birthTime}
              onChange={(event) => onUpdate("birthTime", event.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm leading-5">
          <Checkbox
            checked={form.birthTimeKnown}
            className="mt-0.5"
            onCheckedChange={(checked) => onUpdate("birthTimeKnown", checked === true)}
          />
          <span>
            <span className="block font-medium">Час другої карти відомий</span>
            <span className="text-muted-foreground">Якщо вимкнути, синастрія рахується без кутів і домів другої карти.</span>
          </span>
        </label>

        <div className="space-y-2">
          <Label>Місце другої карти</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input value={form.birthplaceName} onChange={(event) => onUpdate("birthplaceName", event.target.value)} />
            <Button variant="secondary" type="button" disabled={placeSearchStatus === "loading"} onClick={onPlaceSearch}>
              <Search />
              {placeSearchStatus === "loading" ? "Шукаю" : "Пошук"}
            </Button>
          </div>
          <PlaceSearchPanel error={placeError} results={placeResults} status={placeSearchStatus} onSelect={onPlaceSelect} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Широта">
            <Input value={form.latitude} onChange={(event) => onUpdate("latitude", event.target.value)} />
          </Field>
          <Field label="Довгота">
            <Input value={form.longitude} onChange={(event) => onUpdate("longitude", event.target.value)} />
          </Field>
        </div>

        <Button type="button" disabled={status === "loading"} onClick={onCalculate}>
          <Activity />
          {status === "loading" ? "Рахую" : "Порахувати синастрію"}
        </Button>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!preview && status !== "loading" && !error ? (
          <p className="text-sm text-muted-foreground">
            Синастрія порівнює поточну натальну карту "{subjectAName}" з другою картою і показує найточніші міжкартові аспекти.
          </p>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            <SynastryOverlayWheel preview={preview} subjectAName={subjectAName} subjectBName={form.displayName} />

            <div className="grid gap-2 sm:grid-cols-5">
              <SynastryMetric label="Усього" value={preview.summary.totalAspects} />
              <SynastryMetric label="Гармонічні" value={preview.summary.harmoniousAspects} />
              <SynastryMetric label="Напружені" value={preview.summary.tenseAspects} />
              <SynastryMetric label="З'єднання" value={preview.summary.conjunctions} />
              <SynastryMetric label="≤ 1°" value={preview.summary.exactAspects} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Найточніші міжкартові аспекти</h3>
              {preview.interAspects.length > 0 ? (
                <div className="max-h-[360px] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead>{subjectAName}</TableHead>
                        <TableHead>Аспект</TableHead>
                        <TableHead>{form.displayName}</TableHead>
                        <TableHead>Орб</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.interAspects.slice(0, 18).map((aspect) => {
                        const pointA = subjectAPoints.get(aspect.bodyA);
                        const pointB = subjectBPoints.get(aspect.bodyB);

                        return (
                          <TableRow key={`synastry-${aspect.bodyA}-${aspect.type}-${aspect.bodyB}`}>
                            <TableCell className="font-medium">
                              {planetGlyphs[aspect.bodyA] ?? aspect.bodyA} {pointA?.label ?? aspect.bodyA}
                            </TableCell>
                            <TableCell className={getAspectTextClass(aspect.type)}>{aspectLabels[aspect.type] ?? aspect.type}</TableCell>
                            <TableCell className="font-medium">
                              {planetGlyphs[aspect.bodyB] ?? aspect.bodyB} {pointB?.label ?? aspect.bodyB}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{aspect.orb.toFixed(2)}°</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Немає міжкартових major aspects у поточних орбах.</p>
              )}
            </div>

            {preview.warnings.map((warning) => (
              <div
                className="rounded-lg border border-astro-amber/30 bg-astro-amber/10 p-3 text-sm text-amber-900"
                key={warning.code}
              >
                {warning.message}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SynastryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SynastryOverlayWheel({
  preview,
  subjectAName,
  subjectBName
}: {
  preview: SynastryPreviewResult;
  subjectAName: string;
  subjectBName: string;
}) {
  const center = 160;
  const outerRadius = 138;
  const innerRadius = 54;
  const signRadius = 123;
  const subjectARadius = 101;
  const subjectBRadius = 76;
  const subjectAHouseLabelRadius = 111;
  const subjectBHouseLabelRadius = 43;
  const subjectAAspectRadius = 88;
  const subjectBAspectRadius = 63;
  const ascendant = preview.subjectA.angles.find((angle) => angle.key === "asc") ?? null;
  const wheelOffset = ascendant ? normalizeDegrees(270 + ascendant.longitude) : 0;

  const toXY = (longitude: number, radius: number): { x: number; y: number } => {
    const visualLongitude = normalizeDegrees(wheelOffset - longitude);
    const angle = ((visualLongitude - 90) * Math.PI) / 180;

    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius
    };
  };

  const subjectAPoints = new Map(preview.subjectA.bodies.map((point) => [point.key, point]));
  const subjectBPoints = new Map(preview.subjectB.bodies.map((point) => [point.key, point]));

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">{subjectAName}</Badge>
        <Badge variant="outline">{subjectBName}</Badge>
        <span className="text-muted-foreground">Bi-wheel · аспекти між планетами партнерів</span>
      </div>
      <svg
        className="mx-auto aspect-square w-full max-w-[520px] overflow-visible"
        viewBox="-26 -26 372 372"
        role="img"
        aria-label="Накладена карта синастрії"
      >
        <circle cx={center} cy={center} r={outerRadius} className="fill-background stroke-foreground stroke-[1.4]" />
        <circle cx={center} cy={center} r={subjectARadius + 15} className="fill-none stroke-border stroke-[1]" />
        <circle cx={center} cy={center} r={subjectBRadius + 15} className="fill-none stroke-border stroke-[1]" />
        <circle cx={center} cy={center} r={innerRadius} className="fill-none stroke-border stroke-[1] [stroke-dasharray:3_4]" />

        {preview.subjectA.houses.map((cusp) => {
          const next = preview.subjectA.houses[cusp.house % preview.subjectA.houses.length];
          const start = toXY(cusp.longitude, outerRadius);
          const end = toXY(cusp.longitude, innerRadius);
          const houseCenterLongitude = next
            ? normalizeDegrees(cusp.longitude + normalizeDegrees(next.longitude - cusp.longitude) / 2)
            : cusp.longitude;
          const label = toXY(houseCenterLongitude, subjectAHouseLabelRadius);
          const isAngularHouse = cusp.house === 1 || cusp.house === 4 || cusp.house === 7 || cusp.house === 10;

          return (
            <g key={`syn-house-${cusp.house}`}>
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                className={cn("stroke-[0.9]", isAngularHouse ? "stroke-primary" : "stroke-border")}
              />
              <text
                x={label.x}
                y={label.y}
                className="fill-primary text-[9px] font-semibold [dominant-baseline:middle] [text-anchor:middle]"
              >
                {cusp.house}
              </text>
            </g>
          );
        })}

        {preview.subjectB.houses.map((cusp) => {
          const next = preview.subjectB.houses[cusp.house % preview.subjectB.houses.length];
          const start = toXY(cusp.longitude, subjectBRadius + 15);
          const end = toXY(cusp.longitude, innerRadius);
          const houseCenterLongitude = next
            ? normalizeDegrees(cusp.longitude + normalizeDegrees(next.longitude - cusp.longitude) / 2)
            : cusp.longitude;
          const label = toXY(houseCenterLongitude, subjectBHouseLabelRadius);

          return (
            <g key={`syn-partner-house-${cusp.house}`}>
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                className="stroke-astro-coral stroke-[0.9] opacity-60 [stroke-dasharray:2_3]"
              />
              <text
                x={label.x}
                y={label.y}
                className="fill-astro-coral text-[8px] font-semibold [dominant-baseline:middle] [text-anchor:middle]"
              >
                {cusp.house}
              </text>
            </g>
          );
        })}

        {Array.from({ length: 12 }, (_, index) => {
          const signMeta = zodiacSigns[index];
          const divider = toXY(index * 30, outerRadius);
          const dividerEnd = toXY(index * 30, subjectARadius + 15);
          const sign = toXY(index * 30 + 15, signRadius);

          return (
            <g key={`syn-sign-${signMeta?.key ?? index}`}>
              {signMeta ? <title>{formatSignTooltip(signMeta, preview.subjectA)}</title> : null}
              <line x1={divider.x} y1={divider.y} x2={dividerEnd.x} y2={dividerEnd.y} className="stroke-border stroke-[1]" />
              <text
                x={sign.x}
                y={sign.y}
                className="fill-muted-foreground text-base [dominant-baseline:middle] [text-anchor:middle]"
              >
                {signGlyphs[index]}
              </text>
            </g>
          );
        })}

        {preview.interAspects.slice(0, 36).map((aspect) => {
          const pointA = subjectAPoints.get(aspect.bodyA);
          const pointB = subjectBPoints.get(aspect.bodyB);

          if (!pointA || !pointB) {
            return null;
          }

          const a = toXY(pointA.longitude, subjectAAspectRadius);
          const b = toXY(pointB.longitude, subjectBAspectRadius);

          return (
            <line
              key={`syn-wheel-${aspect.bodyA}-${aspect.type}-${aspect.bodyB}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={cn("stroke-[1] opacity-75", getAspectStrokeClass(aspect.type))}
            >
              <title>
                {pointA.label} {aspectLabels[aspect.type] ?? aspect.type} {pointB.label} · orb {aspect.orb.toFixed(2)}°
              </title>
            </line>
          );
        })}

        {preview.subjectA.bodies.map((point) => {
          const position = toXY(point.longitude, subjectARadius);

          return (
            <g key={`syn-a-${point.key}`}>
              <title>{`${subjectAName}\n${formatPointTooltip(point, preview.subjectA)}`}</title>
              <circle cx={position.x} cy={position.y} r="12" className="fill-background stroke-primary stroke-[1.3]" />
              <text
                x={position.x}
                y={position.y}
                className="fill-primary text-xs font-bold [dominant-baseline:middle] [text-anchor:middle]"
              >
                {planetGlyphs[point.key] ?? point.label.slice(0, 2)}
              </text>
            </g>
          );
        })}

        {preview.subjectB.bodies.map((point) => {
          const position = toXY(point.longitude, subjectBRadius);

          return (
            <g key={`syn-b-${point.key}`}>
              <title>{`${subjectBName}\n${formatPointTooltip(point, preview.subjectB)}`}</title>
              <circle cx={position.x} cy={position.y} r="11" className="fill-background stroke-astro-coral stroke-[1.3]" />
              <text
                x={position.x}
                y={position.y}
                className="fill-astro-coral text-[11px] font-bold [dominant-baseline:middle] [text-anchor:middle]"
              >
                {planetGlyphs[point.key] ?? point.label.slice(0, 2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ProfessionalDataCard({
  aspects,
  chart,
  placements
}: {
  aspects: Aspect[];
  chart: ChartResult | null;
  placements: ChartPoint[];
}) {
  const balancePoints = placements.filter((point) => classicalBalancePointKeys.has(point.key));

  return (
    <Card className="min-w-0 xl:sticky xl:top-5">
      <CardHeader>
        <CardDescription className="font-semibold uppercase text-primary">Data</CardDescription>
        <CardTitle>Професійні таблиці</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <SyntheticSignatureCard chart={chart} />

        <Separator />
        <BalanceSummary points={balancePoints} />

        <Separator />
        <PlacementsTable placements={placements} />

        <Separator />
        <PlanetRulershipsTable chart={chart} />

        <Separator />
        <DignitiesTable chart={chart} />

        <Separator />
        <HousesTable chart={chart} />

        <Separator />
        <HouseConnectionsTable chart={chart} />

        <Separator />
        <AspectsTable aspects={aspects} points={placements} />

        {chart?.warnings.map((warning) => (
          <div
            className="rounded-lg border border-astro-amber/30 bg-astro-amber/10 p-3 text-sm text-amber-900"
            key={warning.code}
          >
            {warning.message}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SyntheticSignatureCard({ chart }: { chart: ChartResult | null }) {
  const signature = chart?.syntheticSignature;

  if (!signature) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Синтетична сигнатура</h3>
        <p className="text-sm text-muted-foreground">Очікує перерахунок карти для балів синтетичного знаку.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Синтетична сигнатура</h3>
        <Badge variant="secondary">{signature.scores.total.toFixed(1)} балів</Badge>
      </div>
      <div className="grid gap-2">
        <SyntheticLeader
          label="Знак"
          value={signLabelsUk[signature.sign.key] ?? signature.sign.key}
          score={signature.sign.score}
        />
        <SyntheticLeader
          label="Стихія"
          value={syntheticElementLabelsUk[signature.element.key] ?? signature.element.key}
          score={signature.element.score}
        />
        <SyntheticLeader
          label="Хрест"
          value={syntheticCrossLabelsUk[signature.cross.key] ?? signature.cross.key}
          score={signature.cross.score}
        />
      </div>
      <div className="grid gap-3">
        <SyntheticScoreGroup
          label="Топ знаків"
          rows={signature.scores.signs.slice(0, 4).map((row) => ({
            ...row,
            label: signLabelsUk[row.key] ?? row.key
          }))}
          total={signature.scores.total}
        />
        <SyntheticScoreGroup
          label="Стихії"
          rows={signature.scores.elements.map((row) => ({
            ...row,
            label: syntheticElementLabelsUk[row.key] ?? row.key
          }))}
          total={signature.scores.total}
        />
        <SyntheticScoreGroup
          label="Хрести"
          rows={signature.scores.crosses.map((row) => ({
            ...row,
            label: syntheticCrossLabelsUk[row.key] ?? row.key
          }))}
          total={signature.scores.total}
        />
      </div>
    </div>
  );
}

function SyntheticLeader({ label, score, value }: { label: string; score: number; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">
        {value} · {score.toFixed(1)}
      </span>
    </div>
  );
}

function SyntheticScoreGroup({
  label,
  rows,
  total
}: {
  label: string;
  rows: Array<{ key: string; label: string; score: number }>;
  total: number;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="space-y-2">
        {rows.map((row) => {
          const percentage = total > 0 ? (row.score / total) * 100 : 0;

          return (
            <div className="grid gap-1" key={row.key}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="capitalize text-muted-foreground">{row.label}</span>
                <span className="font-semibold">{row.score.toFixed(1)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BalanceSummary({ points }: { points: ChartPoint[] }) {
  const elementRows = buildBalanceRows(points, "element", ["вогонь", "земля", "повітря", "вода"]);
  const crossRows = buildBalanceRows(points, "cross", ["кардинальний", "фіксований", "мутабельний"]);
  const genderRows = buildBalanceRows(points, "gender", ["чоловічий", "жіночий"]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Баланс карти</h3>
        <Badge variant="secondary">{points.length} планет</Badge>
      </div>
      {points.length > 0 ? (
        <div className="grid gap-3">
          <BalanceGroup title="Стихії" rows={elementRows} total={points.length} />
          <BalanceGroup title="Хрести" rows={crossRows} total={points.length} />
          <BalanceGroup title="Полярність" rows={genderRows} total={points.length} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Очікує видимі класичні планети.</p>
      )}
    </div>
  );
}

function BalanceGroup({
  rows,
  title,
  total
}: {
  rows: Array<{ count: number; key: string; label: string }>;
  title: string;
  total: number;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => {
          const percentage = total > 0 ? (row.count / total) * 100 : 0;

          return (
            <div className="grid gap-1" key={row.key}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="capitalize text-muted-foreground">{row.label}</span>
                <span className="font-semibold">{row.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlacementsTable({ placements }: { placements: ChartPoint[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Положення</h3>
      <div className="max-h-[338px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Точка</TableHead>
              <TableHead>Позиція</TableHead>
              <TableHead>Дім</TableHead>
              <TableHead>Рух</TableHead>
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
                    {signLabelsUk[placement.sign] ?? placement.sign} {placement.signDegree.toFixed(2)}°
                  </TableCell>
                  <TableCell className="text-muted-foreground">{placement.house ?? "n/a"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatMotion(placement)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Очікує дані карти
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PlanetRulershipsTable({ chart }: { chart: ChartResult | null }) {
  const rulerships = chart?.planetRulerships?.filter((rulership) => rulership.houses.length > 0) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Планети-управителі</h3>
        <Badge variant="secondary">{rulerships.length}</Badge>
      </div>
      <div className="max-h-[300px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Планета</TableHead>
              <TableHead>Доми</TableHead>
              <TableHead>Сучасні</TableHead>
              <TableHead>Традиц.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rulerships.length > 0 ? (
              rulerships.map((rulership) => (
                <TableRow key={`rulership-${rulership.pointKey}`}>
                  <TableCell className="font-medium">
                    <span className="mr-2 inline-flex w-6 font-semibold text-primary">
                      {planetGlyphs[rulership.pointKey] ?? "•"}
                    </span>
                    {rulership.pointLabel}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">({formatHouseList(rulership.houses)})</TableCell>
                  <TableCell className="text-muted-foreground">{formatHouseList(rulership.modernHouses)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatHouseList(rulership.traditionalHouses)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Для списку управителів потрібні розраховані доми. Перерахуй стару збережену карту, якщо таблиця порожня.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DignitiesTable({ chart }: { chart: ChartResult | null }) {
  const dignities = chart?.essentialDignities ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Диспозитори</h3>
        <Badge variant="secondary">{dignities.length}</Badge>
      </div>
      <div className="max-h-[338px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Планета</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Диспозитор</TableHead>
              <TableHead>Ланцюг</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dignities.length > 0 ? (
              dignities.map((dignity) => (
                <TableRow key={dignity.pointKey}>
                  <TableCell className="font-medium">
                    <span className="mr-2 inline-flex w-6 font-semibold text-primary">
                      {planetGlyphs[dignity.pointKey] ?? "•"}
                    </span>
                    {dignity.pointLabel}
                  </TableCell>
                  <TableCell className={cn("font-medium", getDignityTextClass(dignity.dignity))}>
                    {dignityLabelsUk[dignity.dignity] ?? dignity.dignity} ({dignity.score})
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dignity.dispositorKey ? `${planetGlyphs[dignity.dispositorKey] ?? ""} ${dignity.dispositorLabel}` : "n/a"}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground" title={formatDispositorChain(dignity)}>
                    {formatDispositorChain(dignity)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Очікує розрахунок диспозиторів.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function HousesTable({ chart }: { chart: ChartResult | null }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Доми</h3>
      <div className="max-h-[260px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Дім</TableHead>
              <TableHead>Куспід</TableHead>
              <TableHead>Тема</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chart && chart.houses.length > 0 ? (
              chart.houses.map((house) => (
                <TableRow key={house.house}>
                  <TableCell className="font-medium">{house.house}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {signLabelsUk[house.sign] ?? house.sign} {house.signDegree.toFixed(2)}°
                  </TableCell>
                  <TableCell className="text-muted-foreground">{houseTopicsUk[house.house] ?? "n/a"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Для домів потрібен відомий час народження.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function HouseConnectionsTable({ chart }: { chart: ChartResult | null }) {
  const connections = chart?.houseConnections ?? [];
  const houseRulers = chart?.houseRulers ?? [];
  const connectionMap = new Map(connections.map((connection) => [`${connection.fromHouse}-${connection.toHouse}`, connection]));
  const houses = Array.from({ length: 12 }, (_, index) => index + 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Зв'язки домів</h3>
        <Badge variant="secondary">{connections.length}</Badge>
      </div>
      {connections.length > 0 || houseRulers.length > 0 ? (
        <>
          <HouseRulersTable houseRulers={houseRulers} />

          <div className="overflow-auto rounded-lg border">
            <table className="min-w-[620px] border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  <th className="h-8 w-9 border-b border-r px-2 text-left font-semibold text-muted-foreground">→</th>
                  {houses.map((house) => (
                    <th className="h-8 border-b border-r px-2 text-center font-semibold text-muted-foreground" key={`house-col-${house}`}>
                      {house}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {houses.map((fromHouse) => (
                  <tr key={`house-row-${fromHouse}`}>
                    <th className="h-9 border-b border-r bg-muted/30 px-2 text-left font-semibold">{fromHouse}</th>
                    {houses.map((toHouse) => {
                      const connection = connectionMap.get(`${fromHouse}-${toHouse}`);

                      return (
                        <td
                          className={cn(
                            "h-9 min-w-12 border-b border-r px-1 text-center align-middle",
                            getHouseConnectionCellClass(connection)
                          )}
                          key={`house-cell-${fromHouse}-${toHouse}`}
                          title={connection ? formatHouseConnectionTitle(connection) : undefined}
                        >
                          {connection ? formatHouseConnectionScore(connection) : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">+ гармонійні</Badge>
            <Badge variant="outline">- напружені</Badge>
            <Badge variant="outline">○ нейтральні</Badge>
          </div>
          <div className="space-y-2">
            {connections.slice(0, 8).map((connection) => (
              <div className="rounded-lg border bg-muted/20 p-3 text-xs" key={`house-link-${connection.fromHouse}-${connection.toHouse}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {connection.fromHouse} дім → {connection.toHouse} дім
                  </span>
                  <span className="text-muted-foreground">{formatHouseConnectionScore(connection)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{formatHouseConnectionTitle(connection)}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Для зв'язків домів потрібен відомий час народження і розраховані доми. Якщо відкрито стару збережену карту,
          перерахуй її ще раз.
        </p>
      )}
    </div>
  );
}

function HouseRulersTable({ houseRulers }: { houseRulers: HouseRuler[] }) {
  return (
    <div className="max-h-[300px] overflow-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead>Дім</TableHead>
            <TableHead>Куспід</TableHead>
            <TableHead>Управитель</TableHead>
            <TableHead>Стоїть</TableHead>
            <TableHead>Рух</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {houseRulers.length > 0 ? (
            houseRulers.map((ruler) => (
              <TableRow key={`house-ruler-${ruler.house}-${ruler.rulerKey}-${ruler.rulerType}`}>
                <TableCell className="font-semibold">{ruler.house}</TableCell>
                <TableCell className="text-muted-foreground">{signLabelsUk[ruler.sign] ?? ruler.sign}</TableCell>
                <TableCell className="font-medium">
                  {planetGlyphs[ruler.rulerKey] ?? ruler.rulerKey} {ruler.rulerLabel}{" "}
                  <span className="text-xs text-muted-foreground">({rulerTypeLabelsUk[ruler.rulerType]})</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{ruler.rulerHouse ? `${ruler.rulerHouse} дім` : "n/a"}</TableCell>
                <TableCell className="text-muted-foreground">{ruler.motion ? motionLabelsUk[ruler.motion] : "n/a"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Очікує управителів домів.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function getHouseConnectionCellClass(connection: HouseConnection | undefined): string {
  if (!connection) {
    return "bg-background";
  }

  if (connection.tense > connection.harmonious) {
    return "bg-blue-600/15 text-blue-800";
  }

  if (connection.harmonious > 0) {
    return "bg-astro-coral/15 text-astro-coral";
  }

  return "bg-muted/50 text-muted-foreground";
}

function formatHouseConnectionScore(connection: HouseConnection): string {
  const parts = [
    connection.harmonious > 0 ? `+${connection.harmonious}` : "",
    connection.tense > 0 ? `-${connection.tense}` : "",
    connection.neutral > 0 ? `○${connection.neutral}` : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : String(connection.total);
}

function formatHouseConnectionTitle(connection: HouseConnection): string {
  return connection.details
    .slice(0, 4)
    .map((detail) => {
      const roleA = detail.fromRole === "ruler" ? "R" : "D";
      const roleB = detail.toRole === "ruler" ? "R" : "D";
      const planetA = planetGlyphs[detail.planetA] ?? detail.planetA;
      const planetB = detail.planetB ? planetGlyphs[detail.planetB] ?? detail.planetB : "";
      const aspect = detail.aspectType ? ` ${aspectLabels[detail.aspectType] ?? detail.aspectType} ` : " → ";

      return detail.source === "aspect"
        ? `${planetA}${roleA}${connection.fromHouse}${aspect}${planetB}${roleB}${connection.toHouse}`
        : `${planetA} R${connection.fromHouse} → D${connection.toHouse}`;
    })
    .join("; ");
}

function AspectsTable({ aspects, points }: { aspects: Aspect[]; points: ChartPoint[] }) {
  const matrixPoints = points.slice(0, 18);
  const pointsByKey = new Map(points.map((point) => [point.key, point]));
  const aspectMap = new Map<string, Aspect>();

  for (const aspect of aspects) {
    aspectMap.set(`${aspect.bodyA}-${aspect.bodyB}`, aspect);
    aspectMap.set(`${aspect.bodyB}-${aspect.bodyA}`, aspect);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Аспекти</h3>
        <Badge variant="secondary">{aspects.length}</Badge>
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="min-w-[760px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              <th className="h-9 w-11 border-b border-r bg-card px-2 text-left font-semibold text-muted-foreground" />
              {matrixPoints.map((point) => (
                <th
                  className="h-9 min-w-10 border-b border-r px-1 text-center font-semibold text-muted-foreground"
                  key={`aspect-col-${point.key}`}
                  title={point.label}
                >
                  {planetGlyphs[point.key] ?? point.label.slice(0, 2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixPoints.map((rowPoint, rowIndex) => (
              <tr key={`aspect-row-${rowPoint.key}`}>
                <th
                  className="h-10 border-b border-r bg-muted/30 px-2 text-center font-semibold text-muted-foreground"
                  title={rowPoint.label}
                >
                  {planetGlyphs[rowPoint.key] ?? rowPoint.label.slice(0, 2)}
                </th>
                {matrixPoints.map((columnPoint, columnIndex) => {
                  const aspect = rowIndex > columnIndex ? aspectMap.get(`${rowPoint.key}-${columnPoint.key}`) : undefined;

                  return (
                    <td
                      className={cn(
                        "h-10 min-w-10 border-b border-r px-1 text-center align-middle",
                        aspect ? getAspectMatrixCellClass(aspect.type) : "bg-background text-muted-foreground"
                      )}
                      key={`aspect-cell-${rowPoint.key}-${columnPoint.key}`}
                      title={aspect ? formatAspectTitle(aspect, pointsByKey) : undefined}
                    >
                      {aspect ? (
                        <span className="inline-grid gap-0.5">
                          <span className="text-sm font-bold leading-none">{aspectGlyphs[aspect.type] ?? aspect.type}</span>
                          <span className="text-[10px] leading-none">{aspect.orb.toFixed(1)}°</span>
                        </span>
                      ) : rowIndex === columnIndex ? (
                        "·"
                      ) : (
                        ""
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="max-h-[260px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Планета A</TableHead>
              <TableHead>Аспект</TableHead>
              <TableHead>Планета B</TableHead>
              <TableHead>Орб</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aspects.length > 0 ? (
              aspects.slice(0, 24).map((aspect) => {
                const pointA = pointsByKey.get(aspect.bodyA);
                const pointB = pointsByKey.get(aspect.bodyB);

                return (
                  <TableRow key={`${aspect.bodyA}-${aspect.type}-${aspect.bodyB}`}>
                    <TableCell className="font-medium">
                      {planetGlyphs[aspect.bodyA] ?? aspect.bodyA} {pointA?.label ?? aspect.bodyA}
                    </TableCell>
                    <TableCell className={cn("font-medium", getAspectTextClass(aspect.type))}>
                      {aspectGlyphs[aspect.type] ?? ""} {aspectLabels[aspect.type] ?? aspect.type}
                    </TableCell>
                    <TableCell className="font-medium">
                      {planetGlyphs[aspect.bodyB] ?? aspect.bodyB} {pointB?.label ?? aspect.bodyB}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{aspect.orb.toFixed(2)}°</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Немає аспектів у поточних фільтрах.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function buildBalanceRows(
  points: ChartPoint[],
  field: "cross" | "element" | "gender",
  order: string[]
): Array<{ count: number; key: string; label: string }> {
  const counts = new Map(order.map((key) => [key, 0]));

  for (const point of points) {
    const signMeta = zodiacSignMetaByKey[point.sign];

    if (!signMeta) {
      continue;
    }

    const value = signMeta[field];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return order.map((key) => ({
    key,
    label: key,
    count: counts.get(key) ?? 0
  }));
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

function ChartWheel({
  chart,
  visiblePointKeys
}: {
  chart: ChartResult | null;
  visiblePointKeys: VisiblePointSettings;
}) {
  const [hoveredPointKey, setHoveredPointKey] = useState<string | null>(null);
  const center = 160;
  const outerRadius = 138;
  const signRadius = 119;
  const pointRadius = 94;
  const houseLabelRadius = 82;
  const aspectRadius = 70;
  const ascendant = chart?.angles.find((angle) => angle.key === "asc") ?? null;
  const midheaven = chart?.angles.find((angle) => angle.key === "mc") ?? null;
  const wheelOffset = ascendant ? normalizeDegrees(270 + ascendant.longitude) : 0;

  const toXY = (longitude: number, radius: number): { x: number; y: number } => {
    const visualLongitude = normalizeDegrees(wheelOffset - longitude);
    const angle = ((visualLongitude - 90) * Math.PI) / 180;

    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius
    };
  };

  const points = chart ? [...chart.angles, ...chart.bodies].filter((point) => isPointVisible(visiblePointKeys, point.key)) : [];
  const pointMarkers = chart?.bodies.filter((point) => isPointVisible(visiblePointKeys, point.key)) ?? [];
  const pointsByKey = new Map(points.map((chartPoint) => [chartPoint.key, chartPoint]));
  const highlightedHouses = new Set(hoveredPointKey ? getRuledHouseNumbers(chart, hoveredPointKey) : []);
  const angleMarkers = [
    ascendant,
    chart?.angles.find((angle) => angle.key === "desc") ??
      (ascendant
        ? {
            key: "desc",
            label: "Descendant",
            longitude: normalizeDegrees(ascendant.longitude + 180)
          }
        : null),
    chart?.angles.find((angle) => angle.key === "ic") ??
      (midheaven
        ? {
            key: "ic",
            label: "Imum Coeli",
            longitude: normalizeDegrees(midheaven.longitude + 180)
          }
        : null),
    midheaven
  ].filter(
    (angle): angle is { key: string; label: string; longitude: number } =>
      angle !== null && angle !== undefined && isPointVisible(visiblePointKeys, angle.key)
  );

  return (
    <svg
      className="mx-auto aspect-square w-full max-w-[560px] overflow-visible"
      viewBox="-34 -34 388 388"
      role="img"
      aria-label="Колесо натальної карти"
    >
      <defs>
        <marker id="angle-arrowhead" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
          <path d="M 0 0 L 7 3.5 L 0 7 z" fill="context-stroke" />
        </marker>
      </defs>

      <circle cx={center} cy={center} r={outerRadius} className="fill-none stroke-foreground stroke-[1.6]" />
      <circle cx={center} cy={center} r={pointRadius + 12} className="fill-none stroke-border stroke-[1.2]" />
      <circle
        cx={center}
        cy={center}
        r={aspectRadius}
        className="fill-none stroke-border stroke-[1.2] [stroke-dasharray:3_4]"
      />

      {chart?.houses.map((cusp, index) => {
        const next = chart.houses[(index + 1) % chart.houses.length];
        const start = toXY(cusp.longitude, outerRadius);
        const end = toXY(cusp.longitude, aspectRadius);
        const houseCenterLongitude = next
          ? normalizeDegrees(cusp.longitude + normalizeDegrees(next.longitude - cusp.longitude) / 2)
          : cusp.longitude;
        const label = toXY(houseCenterLongitude, houseLabelRadius);
        const isAngularHouse = cusp.house === 1 || cusp.house === 4 || cusp.house === 7 || cusp.house === 10;
        const isHighlightedHouse = highlightedHouses.has(cusp.house);

        return (
          <g key={`house-${cusp.house}`}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              className={cn(
                "stroke-[1]",
                isHighlightedHouse ? "stroke-astro-coral stroke-[2]" : isAngularHouse ? "stroke-primary" : "stroke-border"
              )}
            />
            {isHighlightedHouse ? (
              <circle cx={label.x} cy={label.y} r="11" className="fill-astro-coral/15 stroke-astro-coral stroke-[1]" />
            ) : null}
            <text
              x={label.x}
              y={label.y}
              className={cn(
                "text-[10px] font-semibold [dominant-baseline:middle] [text-anchor:middle]",
                isHighlightedHouse ? "fill-astro-coral" : "fill-muted-foreground"
              )}
            >
              {cusp.house}
            </text>
          </g>
        );
      })}

      {Array.from({ length: 12 }, (_, index) => {
        const signMeta = zodiacSigns[index];
        const start = toXY(index * 30, outerRadius);
        const end = toXY(index * 30, aspectRadius);
        const sign = toXY(index * 30 + 15, signRadius);

        return (
          <g key={signMeta?.key ?? index}>
            {signMeta ? <title>{formatSignTooltip(signMeta, chart)}</title> : null}
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

      {chart?.aspects
        .filter((aspect) => isPointVisible(visiblePointKeys, aspect.bodyA) && isPointVisible(visiblePointKeys, aspect.bodyB))
        .slice(0, 24)
        .map((aspect) => {
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

      {angleMarkers.map((anglePoint) => {
        const tail = toXY(anglePoint.longitude, outerRadius + 26);
        const head = toXY(anglePoint.longitude, outerRadius + 3);
        const label = toXY(anglePoint.longitude, outerRadius + 42);
        const fullAnglePoint = pointsByKey.get(anglePoint.key);

        return (
          <g key={`angle-${anglePoint.key}`}>
            {fullAnglePoint ? <title>{formatPointTooltip(fullAnglePoint, chart)}</title> : null}
            <line
              x1={tail.x}
              y1={tail.y}
              x2={head.x}
              y2={head.y}
              markerEnd="url(#angle-arrowhead)"
              className={cn("stroke-[2]", getAngleStrokeClass(anglePoint.key))}
            />
            <text
              x={label.x}
              y={label.y}
              className={cn(
                "text-[11px] font-bold uppercase [dominant-baseline:middle] [text-anchor:middle]",
                getAngleFillClass(anglePoint.key)
              )}
            >
              {planetGlyphs[anglePoint.key] ?? anglePoint.label}
            </text>
          </g>
        );
      })}

      {pointMarkers.map((chartPoint) => {
        const position = toXY(chartPoint.longitude, pointRadius);

        return (
          <g
            className="cursor-help"
            key={chartPoint.key}
            onMouseEnter={() => setHoveredPointKey(chartPoint.key)}
            onMouseLeave={() => setHoveredPointKey(null)}
          >
            <title>{formatPointTooltip(chartPoint, chart)}</title>
            <circle
              cx={position.x}
              cy={position.y}
              r="13"
              className={cn(
                "fill-background stroke-[1.4]",
                hoveredPointKey === chartPoint.key ? "stroke-astro-coral stroke-[2]" : "stroke-primary"
              )}
            />
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
              <strong className={getAspectTextClass(aspect.type)}>{aspect.orb.toFixed(2)}°</strong>
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
    case "trine":
    case "sextile":
      return "stroke-astro-coral";
    case "square":
    case "opposition":
      return "stroke-blue-600";
    default:
      return "stroke-primary";
  }
}

function getAspectTextClass(type: string): string {
  switch (type) {
    case "trine":
    case "sextile":
      return "text-astro-coral";
    case "square":
    case "opposition":
      return "text-blue-600";
    default:
      return "text-primary";
  }
}

function getAspectMatrixCellClass(type: string): string {
  switch (type) {
    case "trine":
    case "sextile":
      return "bg-astro-coral/15 text-astro-coral";
    case "square":
    case "opposition":
      return "bg-blue-600/15 text-blue-700";
    default:
      return "bg-primary/10 text-primary";
  }
}

function formatAspectTitle(aspect: Aspect, pointsByKey: Map<string, ChartPoint>): string {
  const pointA = pointsByKey.get(aspect.bodyA);
  const pointB = pointsByKey.get(aspect.bodyB);

  return `${pointA?.label ?? aspect.bodyA} ${aspectLabels[aspect.type] ?? aspect.type} ${
    pointB?.label ?? aspect.bodyB
  } · orb ${aspect.orb.toFixed(2)}°`;
}

function getDignityTextClass(type: string): string {
  switch (type) {
    case "domicile":
    case "exaltation":
      return "text-primary";
    case "detriment":
    case "fall":
      return "text-blue-600";
    default:
      return "text-muted-foreground";
  }
}

function formatDispositorChain(dignity: EssentialDignity): string {
  const chain = dignity.chain.map((key) => planetGlyphs[key] ?? key).join(" → ");
  return dignity.cycle ? `${chain} ↺` : chain;
}

function getAngleStrokeClass(key: string): string {
  switch (key) {
    case "mc":
    case "ic":
      return "stroke-astro-coral";
    default:
      return "stroke-primary";
  }
}

function getAngleFillClass(key: string): string {
  switch (key) {
    case "mc":
    case "ic":
      return "fill-astro-coral";
    default:
      return "fill-primary";
  }
}
