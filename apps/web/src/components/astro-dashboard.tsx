"use client";

import { ChevronDown, FolderOpen, LogOut, MapPin, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser, listBirthProfiles, searchPlaces } from "@/lib/api";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import type { AuthUser, NatalPreviewPayload, PlaceSearchResult, SavedBirthProfile } from "@/lib/chart-types";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_CHART_DRAFT_STORAGE_KEY,
  SAVED_PROFILE_OPEN_STORAGE_KEY,
  type DashboardChartDraft
} from "@/lib/workspace-storage";

type DashboardFormState = {
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

const initialDashboardForm: DashboardFormState = {
  displayName: "Натальна карта",
  birthDate: "1995-04-12",
  birthTime: "14:30:27",
  birthTimeKnown: true,
  birthplaceName: "Kyiv, Ukraine",
  countryCode: "UA",
  latitude: "50.4501",
  longitude: "30.5234",
  timezone: "Europe/Kyiv",
  houseSystem: "koch",
  zodiac: "tropical"
};

const houseSystems = [
  ["koch", "Koch"],
  ["placidus", "Placidus"]
] as const;

const formatSavedProfileCreatedAt = (createdAt: string): string =>
  new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(createdAt));

export function AstroDashboard() {
  const router = useRouter();
  const [form, setForm] = useState<DashboardFormState>(initialDashboardForm);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [savedProfiles, setSavedProfiles] = useState<SavedBirthProfile[]>([]);
  const [savedProfilesStatus, setSavedProfilesStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [savedProfilesError, setSavedProfilesError] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [placeSearchStatus, setPlaceSearchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [placeError, setPlaceError] = useState<string | null>(null);

  const refreshSavedProfiles = async (tokenOverride: string | null = authToken): Promise<void> => {
    setSavedProfilesStatus("loading");
    setSavedProfilesError(null);

    try {
      const response = await listBirthProfiles(tokenOverride);
      setSavedProfiles(response.profiles);
      setSavedProfilesStatus("ready");
    } catch (requestError) {
      setSavedProfilesStatus("error");
      setSavedProfilesError(requestError instanceof Error ? requestError.message : "Unknown saved profiles error");
    }
  };

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    if (!storedToken) {
      router.replace("/login");
      return;
    }

    setAuthToken(storedToken);
    setAuthStatus("loading");

    void getCurrentUser(storedToken)
      .then((response) => {
        setAuthUser(response.user);
        setAuthStatus("ready");
        void refreshSavedProfiles(storedToken);
      })
      .catch(() => {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        setAuthToken(null);
        setAuthUser(null);
        setAuthStatus("idle");
        router.replace("/login");
      });
  }, [router]);

  const updateForm = <Field extends keyof DashboardFormState>(
    field: Field,
    value: DashboardFormState[Field]
  ): void => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));

    if (field === "birthplaceName") {
      setPlaceResults([]);
      setPlaceError(null);
      setPlaceSearchStatus("idle");
    }
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
    setPlaceResults([]);
    setPlaceError(null);
    setPlaceSearchStatus("idle");
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const draft: DashboardChartDraft = {
      displayName: form.displayName,
      birthplaceName: form.birthplaceName,
      countryCode: form.countryCode || undefined,
      natal: {
        birthDate: form.birthDate,
        birthTime: form.birthTime,
        birthTimeKnown: form.birthTimeKnown,
        timezone: form.timezone,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        houseSystem: form.houseSystem,
        zodiac: form.zodiac
      },
      createdAt: new Date().toISOString()
    };

    window.localStorage.setItem(DASHBOARD_CHART_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    router.push("/workspace");
  };

  const openSavedProfile = (profile: SavedBirthProfile): void => {
    window.localStorage.setItem(SAVED_PROFILE_OPEN_STORAGE_KEY, profile.id);
    router.push("/workspace");
  };

  const logout = (): void => {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setAuthUser(null);
    router.replace("/login");
  };

  if (!authUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardDescription className="font-semibold uppercase text-primary">Astroprocessor</CardDescription>
            <CardTitle>Перевіряю сесію</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Якщо сесії немає, відкриється сторінка авторизації.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-primary">Astroprocessor</p>
            <h1 className="text-3xl font-semibold tracking-normal">Дешборд</h1>
          </div>
          <DashboardAccountMenu
            isOpen={isUserMenuOpen}
            status={authStatus}
            user={authUser}
            onLogout={logout}
            onOpenChange={setIsUserMenuOpen}
          />
        </header>

        <section className="space-y-4">
          <Card className="min-w-0">
            <CardHeader className="space-y-1">
              <CardDescription className="font-semibold uppercase text-primary">New calculation</CardDescription>
              <CardTitle>Швидкий розрахунок карти</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 lg:grid-cols-12" onSubmit={submit}>
                <DashboardField className="lg:col-span-3" label="Назва карти">
                  <Input value={form.displayName} onChange={(event) => updateForm("displayName", event.target.value)} />
                </DashboardField>
                <DashboardField className="sm:col-span-1 lg:col-span-2" label="Дата">
                  <Input type="date" value={form.birthDate} onChange={(event) => updateForm("birthDate", event.target.value)} />
                </DashboardField>
                <DashboardField className="sm:col-span-1 lg:col-span-2" label="Час">
                  <Input
                    disabled={!form.birthTimeKnown}
                    step={1}
                    type="time"
                    value={form.birthTime}
                    onChange={(event) => updateForm("birthTime", event.target.value)}
                  />
                </DashboardField>
                <DashboardField className="lg:col-span-3" label="Місце">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      value={form.birthplaceName}
                      onChange={(event) => updateForm("birthplaceName", event.target.value)}
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={placeSearchStatus === "loading"}
                      onClick={searchBirthplace}
                    >
                      <Search />
                      {placeSearchStatus === "loading" ? "Шукаю" : "Пошук"}
                    </Button>
                  </div>
                </DashboardField>
                <label className="flex min-h-10 items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm lg:col-span-2 lg:self-end">
                  <Checkbox
                    checked={form.birthTimeKnown}
                    onCheckedChange={(checked) => updateForm("birthTimeKnown", checked === true)}
                  />
                  <span>Час відомий</span>
                </label>

                <div className="lg:col-span-12">
                  <DashboardPlaceSearchPanel
                    error={placeError}
                    results={placeResults}
                    status={placeSearchStatus}
                    onSelect={selectBirthplace}
                  />
                </div>

                <DashboardField className="lg:col-span-2" label="Широта">
                  <Input value={form.latitude} onChange={(event) => updateForm("latitude", event.target.value)} />
                </DashboardField>
                <DashboardField className="lg:col-span-2" label="Довгота">
                  <Input value={form.longitude} onChange={(event) => updateForm("longitude", event.target.value)} />
                </DashboardField>
                <DashboardField className="lg:col-span-3" label="Часовий пояс">
                  <Input value={form.timezone} onChange={(event) => updateForm("timezone", event.target.value)} />
                </DashboardField>
                <DashboardField className="lg:col-span-2" label="Система домів">
                  <Select value={form.houseSystem} onValueChange={(value) => updateForm("houseSystem", value)}>
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
                </DashboardField>
                <DashboardField className="lg:col-span-2" label="Зодіак">
                  <Select
                    value={form.zodiac}
                    onValueChange={(value) => updateForm("zodiac", value as NatalPreviewPayload["zodiac"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tropical">Тропічний</SelectItem>
                      <SelectItem value="sidereal">Сидеричний</SelectItem>
                    </SelectContent>
                  </Select>
                </DashboardField>
                <div className="flex items-end lg:col-span-1">
                  <Button className="w-full" type="submit">
                    Розрахувати
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <SavedProfilesDashboardCard
            error={savedProfilesError}
            profiles={savedProfiles}
            status={savedProfilesStatus}
            onOpen={openSavedProfile}
            onRefresh={refreshSavedProfiles}
          />
        </section>
      </div>
    </main>
  );
}

function DashboardAccountMenu({
  isOpen,
  status,
  user,
  onLogout,
  onOpenChange
}: {
  isOpen: boolean;
  status: "idle" | "loading" | "ready" | "error";
  user: AuthUser;
  onLogout: () => void;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <div className="relative">
      {isOpen ? (
        <button
          aria-label="Закрити меню користувача"
          className="fixed inset-0 z-40 cursor-default"
          tabIndex={-1}
          type="button"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="h-auto w-full justify-between gap-3 px-3 py-2 lg:min-w-64"
        variant="secondary"
        type="button"
        onClick={() => onOpenChange(!isOpen)}
      >
        <span className="grid min-w-0 text-left leading-tight">
          <span className="truncate text-sm font-semibold">{user.username}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-full min-w-64 rounded-lg border bg-card p-1 text-card-foreground shadow-xl lg:w-72"
          role="menu"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.username}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <Badge className="mt-2" variant="secondary">
              {status === "loading" ? "Сесія перевіряється" : "Залогінено"}
            </Badge>
          </div>
          <Separator className="my-1" />
          <button
            className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            role="menuitem"
            type="button"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Вийти
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DashboardField({
  children,
  className,
  label
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function DashboardPlaceSearchPanel({
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
    <div className="grid gap-2 rounded-lg border bg-background p-2 md:grid-cols-2">
      {results.map((place) => (
        <button
          className="grid gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

function SavedProfilesDashboardCard({
  error,
  profiles,
  status,
  onOpen,
  onRefresh
}: {
  error: string | null;
  profiles: SavedBirthProfile[];
  status: "idle" | "loading" | "ready" | "error";
  onOpen: (profile: SavedBirthProfile) => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardDescription className="font-semibold uppercase text-primary">Saved charts</CardDescription>
          <CardTitle>Збережені карти</CardTitle>
        </div>
        <Button size="icon" variant="secondary" type="button" aria-label="Оновити список" onClick={() => void onRefresh()}>
          <RefreshCw className={cn(status === "loading" && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "loading" ? (
          <p className="text-sm text-muted-foreground">Завантажую збережені карти...</p>
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
          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Карта</TableHead>
                  <TableHead>Дата народження</TableHead>
                  <TableHead>Місце</TableHead>
                  <TableHead>Створено</TableHead>
                  <TableHead className="w-28 text-right">Дія</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="min-w-56 font-medium">
                      <span className="flex min-w-0 items-center gap-2">
                        <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{profile.displayName}</span>
                      </span>
                    </TableCell>
                    <TableCell className="min-w-40 text-muted-foreground">
                      {profile.birthDate} · {profile.birthTimeKnown ? profile.birthTime : "час невідомий"}
                    </TableCell>
                    <TableCell className="min-w-64 text-muted-foreground">{profile.birthplaceName}</TableCell>
                    <TableCell className="min-w-44 text-muted-foreground">
                      {formatSavedProfileCreatedAt(profile.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="secondary" type="button" onClick={() => onOpen(profile)}>
                        Відкрити
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
