"use client";

import { useMemo, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { consultationFacts } from "@/lib/consultation-facts";
import type { ChartResult } from "@/lib/chart-types";

export function ConsultationFactsPicker({ chart, sections, disabled, onInsert }: {
  chart: ChartResult; sections: Array<{ id: string; title: string }>; disabled: boolean;
  onInsert: (target: string, lines: string[]) => boolean;
}) {
  const facts = useMemo(() => consultationFacts(chart), [chart]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("placements");
  const [target, setTarget] = useState("new");
  const [inserted, setInserted] = useState(false);
  const visible = facts.filter((fact) => fact.category === category && fact.text.toLocaleLowerCase("uk-UA").includes(query.toLocaleLowerCase("uk-UA").trim()));
  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <Select value={category} onValueChange={setCategory}><SelectTrigger aria-label="Тип даних"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="placements">Положення та управління</SelectItem><SelectItem value="aspects">Аспекти між планетами</SelectItem></SelectContent>
      </Select>
      <Input aria-label="Пошук даних карти" placeholder="Планета, знак або аспект" value={query} onChange={(event) => setQuery(event.target.value)} />
    </div>
    <div className="max-h-80 space-y-2 overflow-y-auto border-y py-3">
      {visible.map((fact) => <label key={fact.id} className="flex items-start gap-2 text-sm leading-6">
        <Checkbox className="mt-1 shrink-0" disabled={disabled} checked={selected.includes(fact.id)} onCheckedChange={(checked) => {
          setInserted(false); setSelected((current) => checked === true ? [...current, fact.id] : current.filter((id) => id !== fact.id));
        }} /><span className="min-w-0 break-words">{fact.text}</span>
      </label>)}
      {!visible.length ? <p className="text-sm text-muted-foreground">Даних не знайдено.</p> : null}
    </div>
    <label className="block space-y-1 text-sm font-medium"><span>Вставити в кінець розділу</span>
      <Select value={target} onValueChange={setTarget}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="new">Новий розділ</SelectItem>
        {sections.map((section, index) => <SelectItem key={section.id} value={section.id}>{section.title || `Розділ ${index + 1}`}</SelectItem>)}
      </SelectContent></Select>
    </label>
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={disabled || !selected.length} onClick={() => {
        if (onInsert(target, facts.filter((fact) => selected.includes(fact.id)).map((fact) => fact.text))) { setSelected([]); setInserted(true); }
      }}><FilePlus2 />Вставити ({selected.length})</Button>
      <Button variant="ghost" disabled={!selected.length} onClick={() => setSelected([])}>Очистити вибір</Button>
      {inserted ? <span role="status" className="text-sm text-primary">Додано до тексту консультації.</span> : null}
    </div>
  </div>;
}
