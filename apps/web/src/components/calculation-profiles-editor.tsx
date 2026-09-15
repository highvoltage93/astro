"use client";

import { Check, Copy, RefreshCw, Save, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteCalculationProfile, listCalculationProfiles, saveCalculationProfile, setDefaultCalculationProfile } from "@/lib/api";
import { profileReference, rulershipModelLabels, sameProfileConfig } from "@/lib/calculation-profiles";
import type { CalculationProfile, CalculationProfileConfig, CalculationProfileReference } from "@/lib/calculation-profiles";

export function CalculationProfilesEditor({ token, config, reference, busy: applying, applyError, onChange, onApply }: {
  token: string; config: CalculationProfileConfig; reference?: CalculationProfileReference;
  busy: boolean; applyError: string | null;
  onChange: (config: CalculationProfileConfig) => void;
  onApply: (config: CalculationProfileConfig, reference?: CalculationProfileReference) => Promise<boolean>;
}) {
  const [profiles, setProfiles] = useState<CalculationProfile[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("current");
  const [name, setName] = useState(reference?.name ?? "Мій профіль");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [threshold, setThreshold] = useState(String(config.calculationRules.containedSignMinDegrees ?? 12.5));
  const inFlight = useRef(false);
  const selected = profiles.find((profile) => profile.id === selectedId);
  const matchesSelected = selected && name.trim() === selected.name && sameProfileConfig(config, selected.config);
  const disabled = busy || applying;
  const invalidThreshold = config.calculationRules.containedSignMinDegrees !== null &&
    (threshold.trim() === "" || !Number.isFinite(Number(threshold)) || Number(threshold) < 0 || Number(threshold) > 30);

  useEffect(() => {
    setThreshold(String(config.calculationRules.containedSignMinDegrees ?? 12.5));
  }, [config.calculationRules.containedSignMinDegrees]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    void listCalculationProfiles(token).then((response) => {
      if (!active) return;
      setProfiles(response.profiles); setDefaultId(response.defaultProfileId);
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : "Не вдалося завантажити профілі.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, reload]);

  const execute = async (action: () => Promise<void>): Promise<void> => {
    if (disabled || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null); setMessage(null);
    try { await action(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Не вдалося виконати дію."); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const save = (update: boolean) => execute(async () => {
    if (invalidThreshold || !name.trim() || (update && (!selected || selected.builtIn))) return;
    const response = await saveCalculationProfile(token, { name: name.trim(), config }, update && selected ? selected : undefined);
    setProfiles((current) => [...current.filter((profile) => profile.id !== response.profile.id), response.profile]);
    setSelectedId(response.profile.id); setName(response.profile.name);
    setMessage(`Профіль збережено, редакція ${response.profile.revision}.`);
  });

  return (
    <section className="min-w-0 space-y-4 border-b pb-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Профілі розрахунку</h3>
        <Button size="icon" variant="ghost" title="Оновити профілі" aria-label="Оновити профілі" disabled={disabled || loading} onClick={() => setReload((value) => value + 1)}><RefreshCw /></Button>
      </div>
      <label className="block space-y-1 text-sm font-medium">
        <span>Профіль</span>
        <Select value={selectedId} disabled={disabled || loading} onValueChange={(id) => {
          if (id === "current") { setSelectedId(id); return; }
          const profile = profiles.find((item) => item.id === id);
          if (!profile || profile.schemaVersion !== 1) { setError("Ця версія профілю не підтримується."); return; }
          setSelectedId(id); setName(profile.name); setMessage(null); setError(null);
          onChange(structuredClone(profile.config));
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Поточна чернетка</SelectItem>
            {profiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>
              {profile.name}{profile.builtIn ? "" : ` · v${profile.revision}`}{defaultId === profile.id ? " · основний" : ""}
            </SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-medium sm:col-span-2">
          <span>Назва особистого профілю</span>
          <Input maxLength={120} value={name} disabled={disabled} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block space-y-1 text-sm font-medium sm:col-span-2">
          <span>Система управителів</span>
          <Select value={config.calculationRules.rulershipModel} disabled={disabled || loading || !profiles.length} onValueChange={(model) => {
            const builtin = profiles.find((profile) => profile.builtIn && profile.config.calculationRules.rulershipModel === model);
            if (builtin) onChange({ ...config, calculationRules: structuredClone(builtin.config.calculationRules) });
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(rulershipModelLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="block space-y-1 text-sm font-medium">
          <span>Система домів</span>
          <Select value={config.houseSystem} disabled={disabled} onValueChange={(houseSystem) => onChange({ ...config, houseSystem })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{([
              ["koch", "Кох"], ["placidus", "Плацидус"], ["whole-sign", "Цілознакова"], ["equal", "Рівнодомна"],
              ["campanus", "Кампанус"], ["regiomontanus", "Регіомонтан"], ["porphyry", "Порфирій"]
            ] as const).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="block space-y-1 text-sm font-medium">
          <span>Зодіак</span>
          <Select value={config.zodiac} disabled={disabled} onValueChange={(zodiac) => onChange({ ...config, zodiac: zodiac as CalculationProfileConfig["zodiac"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="tropical">Тропічний</SelectItem><SelectItem value="sidereal">Сидеричний · Лахірі</SelectItem></SelectContent>
          </Select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_130px] sm:items-center">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={config.calculationRules.containedSignMinDegrees !== null} disabled={disabled} onCheckedChange={(checked) =>
            onChange({ ...config, calculationRules: { ...config.calculationRules, containedSignMinDegrees: checked === true ? 12.5 : null } })} />
          Управителі додаткових знаків дому
        </label>
        <label className="block space-y-1 text-xs text-muted-foreground">
          <span>Покриття понад, °</span>
          <Input type="number" min={0} max={30} step={0.1} aria-invalid={invalidThreshold} value={threshold}
            disabled={disabled || config.calculationRules.containedSignMinDegrees === null} onChange={(event) => {
              const value = event.target.value; setThreshold(value);
              if (value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 30) {
                onChange({ ...config, calculationRules: { ...config.calculationRules, containedSignMinDegrees: Number(value) } });
              }
            }} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={config.calculationRules.lilithRulesEighthHouse} disabled={disabled} onCheckedChange={(checked) =>
          onChange({ ...config, calculationRules: { ...config.calculationRules, lilithRulesEighthHouse: checked === true } })} />
        Ліліт завжди править 8 домом
      </label>
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="mb-2 text-sm font-medium">Доми з мінусовим зв'язком при з'єднанні та управлінні</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Array.from({ length: 12 }, (_, index) => index + 1).map((house) => <label className="flex min-h-9 items-center gap-2 text-sm" key={house}>
            <Checkbox checked={config.calculationRules.tenseHouses.includes(house)} disabled={disabled} onCheckedChange={(checked) =>
              onChange({ ...config, calculationRules: { ...config.calculationRules, tenseHouses: checked === true
                ? [...config.calculationRules.tenseHouses, house].sort((a, b) => a - b)
                : config.calculationRules.tenseHouses.filter((value) => value !== house) } })} />{house}
          </label>)}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Правила v{config.calculationRules.version}</Badge>
        {selected && !matchesSelected ? <Badge variant="secondary">Змінена чернетка</Badge> : null}
        {loading ? <span role="status" className="text-xs text-muted-foreground">Завантажую профілі…</span> : null}
      </div>
      {invalidThreshold ? <p role="alert" className="text-sm text-destructive">Поріг має бути від 0 до 30 градусів.</p> : null}
      {error || applyError ? <p role="alert" className="text-sm text-destructive">{error ?? applyError}</p> : null}
      {message ? <p role="status" className="text-sm text-primary">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || invalidThreshold} onClick={() => void execute(async () => {
          const applied = await onApply(config, matchesSelected && selected ? profileReference(selected) : undefined);
          if (applied) setMessage("Профіль застосовано до робочої карти.");
        })}><Check />Застосувати профіль</Button>
        <Button variant="secondary" disabled={disabled || invalidThreshold || !name.trim()} onClick={() => void save(false)}><Copy />Зберегти як новий</Button>
        {selected && !selected.builtIn ? <>
          <Button variant="outline" disabled={disabled || invalidThreshold || !name.trim() || !!matchesSelected} onClick={() => void save(true)}><Save />Оновити профіль</Button>
          <Button variant="outline" disabled={disabled || !matchesSelected} onClick={() => void execute(async () => {
            const response = await setDefaultCalculationProfile(token, defaultId === selected.id ? null : selected.id);
            setDefaultId(response.defaultProfileId);
            setMessage(response.defaultProfileId ? "Основний профіль для нових карт збережено." : "Повернуто базові налаштування для нових карт.");
          })}><Star />{defaultId === selected.id ? "Скасувати основний" : "Для нових карт"}</Button>
          <Button variant="ghost" className="text-destructive" size="icon" title="Видалити профіль" aria-label="Видалити профіль" disabled={disabled} onClick={() => {
            if (!window.confirm(`Видалити профіль «${selected.name}»? Збережені карти залишаться без змін.`)) return;
            void execute(async () => {
              await deleteCalculationProfile(token, selected.id);
              setProfiles((current) => current.filter((profile) => profile.id !== selected.id));
              if (defaultId === selected.id) setDefaultId(null);
              setSelectedId("current"); setMessage("Профіль видалено. Поточна чернетка залишилася.");
            });
          }}><Trash2 /></Button>
        </> : null}
      </div>
    </section>
  );
}
