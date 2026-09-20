"use client";

import { ArrowDown, ArrowUp, BookOpen, Download, Eye, FileText, History, Lock, Plus, Printer, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConsultationRichText } from "@/components/consultation-rich-text";
import { ConsultationRichPreview } from "@/components/consultation-rich-preview";
import { consultationContentSchema, plainTextToRich, upgradeContent } from "@astroprocessor/consultation-format";
import type { RichDocument } from "@astroprocessor/consultation-format";
import { ConsultationFactsPicker } from "@/components/consultation-facts-picker";
import { appendConsultationFacts } from "@/lib/consultation-facts";
import { ConsultationForecastPicker } from "@/components/consultation-forecast-picker";
import { appendForecastFacts } from "@/lib/consultation-forecast-facts";
import { createForecastRequestId } from "@/lib/forecast-archive";
import { ConsultationTemplateLibrary } from "@/components/consultation-template-library";
import { appendTextTemplate } from "@/lib/consultation-templates";
import { consultationDraft, ConsultationError, isConsultationDraft, restoreConsultationDraft, updateConsultation } from "@/lib/consultations";
import { ConsultationHistory } from "@/components/consultation-history";
import type { Consultation, ConsultationDraft, ConsultationMutation } from "@/lib/consultations";

type Recovery = { draft: ConsultationDraft; revision: number; pending: ConsultationMutation | null };
const textareaClass = "w-full min-h-40 resize-y rounded-md border bg-background p-3 text-base leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

export function ConsultationEditor({ record, token, userId }: { record: Consultation; token: string; userId: string }) {
  const [draft, setDraft] = useState<ConsultationDraft>(() => consultationDraft(record));
  const [saved, setSaved] = useState(() => JSON.stringify(consultationDraft(record)));
  const [phase, setPhase] = useState<"idle" | "saving" | "error" | "conflict">("idle");
  const [error, setError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [view, setView] = useState<"text" | "notes" | "preview" | "source" | "forecast" | "templates" | "history">("text");
  const [templatesOpened, setTemplatesOpened] = useState(false);
  const [savedAt, setSavedAt] = useState(record.updatedAt);
  const baseRevision = useRef(record.revision);
  const pending = useRef<ConsultationMutation | null>(null);
  const inFlight = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;
  const alive = useRef(true);
  const key = `astroprocessor:consultation:${userId}:${record.id}`;
  const dirty = JSON.stringify(draft) !== saved;
  const unsaved = dirty || phase === "saving" || !!recovery || !!pending.current;

  useEffect(() => {
    alive.current = true;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const value = JSON.parse(stored) as Recovery;
        if (isConsultationDraft(value.draft) && Number.isInteger(value.revision) && value.revision > 0) {
          if (JSON.stringify(value.draft) !== JSON.stringify(consultationDraft(record))) {
            // An invalid pending request is never replayed from browser storage.
            const request = value.pending;
            setRecovery({ ...value, pending: request && isConsultationDraft(request) &&
              Number.isInteger(request.revision) && typeof request.mutationId === "string" ? request : null });
          } else sessionStorage.removeItem(key);
        } else setLocalError("Локальну чернетку не вдалося прочитати. Серверна версія доступна.");
      }
    } catch { setLocalError("Локальне відновлення недоступне в цьому браузері."); }
    setInitialized(true);
    return () => { alive.current = false; };
  }, [key, record]);

  const persist = (value: Recovery | null) => {
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value));
      else sessionStorage.removeItem(key);
      if (alive.current) setLocalError(null);
    } catch { if (alive.current) setLocalError("Не вдалося записати локальну копію. Не закривай сторінку до збереження на сервері."); }
  };

  useEffect(() => {
    if (!initialized || recovery) return;
    persist(dirty || pending.current ? { draft, revision: baseRevision.current, pending: pending.current } : null);
  }, [draft, dirty, initialized, recovery, saved]);

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const save = async () => {
    if (inFlight.current || recovery || !initialized || phase === "conflict") return;
    if (!latest.current.title.trim()) { setError("Додай назву консультації."); setPhase("error"); return; }
    inFlight.current = true;
    setPhase("saving"); setError(null);
    const attempt = pending.current ?? { ...structuredClone(latest.current), revision: baseRevision.current, mutationId: crypto.randomUUID() };
    pending.current = attempt;
    persist({ draft: latest.current, revision: baseRevision.current, pending: attempt });
    try {
      const response = await updateConsultation(token, record.id, attempt);
      if (!alive.current) return;
      baseRevision.current = response.consultation.revision;
      pending.current = null;
      const acknowledged = consultationDraft(response.consultation);
      // Normalize only the acknowledged title; typing during a request is retained.
      const submitted = { title: attempt.title, status: attempt.status, content: attempt.content, privateNotes: attempt.privateNotes };
      const unchanged = JSON.stringify(latest.current) === JSON.stringify(submitted);
      const remaining = unchanged ? acknowledged : latest.current;
      persist(JSON.stringify(remaining) === JSON.stringify(acknowledged) ? null : { draft: remaining, revision: baseRevision.current, pending: null });
      if (unchanged) setDraft(acknowledged);
      setSaved(JSON.stringify(acknowledged)); setSavedAt(response.consultation.updatedAt); setPhase("idle");
    } catch (failure) {
      if (!alive.current) return;
      setError(failure instanceof Error ? failure.message : "Помилка збереження.");
      if (failure instanceof ConsultationError && failure.status === 409) setPhase("conflict");
      else {
        if (failure instanceof ConsultationError && failure.status === 400) {
          pending.current = null;
          persist({ draft: latest.current, revision: baseRevision.current, pending: null });
        }
        setPhase("error");
      }
    } finally { inFlight.current = false; }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!dirty || !initialized || recovery || phase !== "idle") return;
    const timeout = window.setTimeout(() => void saveRef.current(), 1200);
    return () => window.clearTimeout(timeout);
  }, [draft, dirty, initialized, recovery, phase]);

  const edit = (next: ConsultationDraft) => {
    if (!consultationContentSchema.safeParse(next.content).success) {
      setContentError("Документ перевищує допустимий розмір. Зміна не застосована; попередній текст збережено в редакторі.");
      return;
    }
    setContentError(null);
    latest.current = next;
    persist({ draft: next, revision: baseRevision.current, pending: pending.current });
    setDraft(next);
    // A conflict or uncertain response requires an explicit action, not a silent overwrite.
  };
  const editSection = (index: number, field: "title", value: string) => edit({
    ...draft, status: "DRAFT", content: { ...draft.content, sections: draft.content.sections.map((section, position) =>
      position === index ? { ...section, [field]: value } : section) }
  });
  const richContent = (id: string, body: RichDocument) => {
    const content = upgradeContent(latest.current.content);
    return { ...content, sections: content.sections.map((section) => section.id === id ? { ...section, body } : section) };
  };
  const downloadDraft = () => {
    const data = recovery?.draft ?? draft;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `consultation-${record.id}-private-backup.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <section className="min-w-0 space-y-4">
    <div className="space-y-2 border-b pb-3">
      <p className="break-words text-xs text-muted-foreground">{record.source.displayName} · {record.source.birthDate} · {record.source.birthplaceName}</p>
      <p className="break-words text-xs text-muted-foreground">Знімок карти: {new Date(record.source.calculatedAt).toLocaleString("uk-UA")} · {record.source.chart.settings.houseSystem}</p>
      <label className="block space-y-1 text-sm font-medium"><span>Назва консультації</span>
        <Input maxLength={120} value={draft.title} disabled={!initialized || !!recovery} onChange={(event) => edit({ ...draft, title: event.target.value, status: "DRAFT" })} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={draft.status} disabled={!initialized || !!recovery} onValueChange={(status) => edit({ ...draft, status: status as ConsultationDraft["status"] })}>
          <SelectTrigger className="w-36" aria-label="Статус консультації"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="DRAFT">Чернетка</SelectItem><SelectItem value="READY">Готово</SelectItem></SelectContent>
        </Select>
        <Button size="icon" variant="secondary" title="Зберегти" aria-label="Зберегти" disabled={!initialized || !!recovery || phase === "saving" || phase === "conflict" || (!dirty && !pending.current)} onClick={() => void save()}><Save /></Button>
        <Button size="icon" variant="ghost" title="Завантажити приватну резервну копію з нотатками" aria-label="Завантажити приватну резервну копію з нотатками" onClick={downloadDraft}><Download /></Button>
        <Button variant="outline" disabled={!initialized || unsaved || phase !== "idle"} title={unsaved ? "Спершу збережи зміни" : "Клієнтський документ"} onClick={() => {
          window.open(`/consultations/print?id=${encodeURIComponent(record.id)}&revision=${baseRevision.current}`, "_blank", "noopener,noreferrer");
        }}><Printer />Друк / PDF</Button>
        <span role="status" className="text-xs text-muted-foreground">{phase === "saving" ? "Зберігаю…" : phase === "conflict" ? "Конфлікт версій" : phase === "error" ? "Не збережено" : dirty || recovery ? "Незбережена чернетка" : `Збережено ${new Date(savedAt).toLocaleTimeString("uk-UA")}`}</span>
      </div>
    </div>
    {localError ? <p role="alert" className="text-sm text-destructive">{localError}</p> : null}
    {contentError ? <p role="alert" className="text-sm text-destructive">{contentError}</p> : null}
    {recovery ? <div className="space-y-2 border-l-2 border-primary pl-3">
      <p className="text-sm">Є незбережена чернетка цієї вкладки.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { baseRevision.current = recovery.revision; pending.current = recovery.pending; setDraft(recovery.draft); setRecovery(null); }}>Відновити</Button>
        <Button variant="outline" onClick={() => { if (window.confirm("Відкинути локальну чернетку та залишити серверну версію?")) { persist(null); setRecovery(null); } }}>Відкинути чернетку</Button>
      </div>
    </div> : null}
    {error ? <div role="alert" className="space-y-2 text-sm text-destructive">
      <p>{error}</p>
      {phase === "conflict" ? <Button variant="outline" onClick={() => {
        if (window.confirm("Завантажити серверну версію? Незбережений текст буде відкинуто. За потреби спершу завантаж приватну резервну копію.")) { persist(null); window.location.reload(); }
      }}><RefreshCw />Завантажити серверну версію</Button> : <Button variant="outline" disabled={phase === "saving"} onClick={() => void save()}><RefreshCw />Повторити збереження</Button>}
    </div> : null}
    <div className="flex flex-wrap gap-1 border-b pb-2" role="tablist" aria-label="Вміст консультації">
      {([ ["text", "Текст", FileText], ["source", "Дані карти", Plus], ["forecast", "Прогнози", FileText], ["templates", "Бібліотека", BookOpen], ["history", "Історія", History], ["notes", "Приватні нотатки", Lock], ["preview", "Перегляд", Eye] ] as const).map(([value, label, Icon]) =>
        <Button key={value} role="tab" aria-selected={view === value} variant={view === value ? "secondary" : "ghost"} onClick={() => { setView(value); if (value === "templates") setTemplatesOpened(true); }}><Icon />{label}</Button>)}
    </div>
    <div hidden={view !== "source"}>
      <ConsultationFactsPicker chart={record.source.chart} sections={draft.content.sections} disabled={!initialized || !!recovery || phase === "conflict"} onInsert={(target, lines) => {
        try {
          const content = appendConsultationFacts(latest.current.content, target,
            [`Натальна карта. Знімок розрахунку: ${record.source.calculatedAt}.`, ...lines], crypto.randomUUID());
          edit({ ...latest.current, status: "DRAFT", content });
          return true;
        } catch (failure) { setContentError(failure instanceof Error ? failure.message : "Не вдалося вставити дані."); return false; }
      }} />
    </div>
    {view === "forecast" ? <ConsultationForecastPicker token={token} content={draft.content} disabled={!initialized || !!recovery || phase === "conflict"} onInsert={(target, forecast, ids) => {
      try {
        const content = appendForecastFacts(latest.current.content, target, forecast, ids, createForecastRequestId());
        edit({ ...latest.current, status: "DRAFT", content });
        setContentError(null);
        return true;
      } catch (failure) { setContentError(failure instanceof Error ? failure.message : "Не вдалося вставити прогноз."); return false; }
    }} /> : null}
    {templatesOpened ? <div hidden={view !== "templates"}>
      <ConsultationTemplateLibrary key={userId} token={token} userId={userId} content={draft.content} disabled={!initialized || !!recovery || phase === "conflict"} onInsert={(target, template) => {
        try {
          const content = appendTextTemplate(latest.current.content, target, template, createForecastRequestId());
          edit({ ...latest.current, status: "DRAFT", content });
          return true;
        } catch (failure) { setContentError(failure instanceof Error ? failure.message : "Не вдалося вставити шаблон."); return false; }
      }} />
    </div> : null}
    {view === "history" ? <ConsultationHistory key={record.id} token={token} consultationId={record.id} currentRevision={baseRevision.current}
      disabled={!initialized || unsaved || phase !== "idle"} onRestore={(version, includePrivateNotes) => {
        if (!initialized || recovery || inFlight.current || pending.current || phase !== "idle" || JSON.stringify(latest.current) !== saved) {
          setContentError("Спершу збережи поточні зміни та виріши конфлікти версій."); return false;
        }
        try {
          edit(restoreConsultationDraft(latest.current, version, includePrivateNotes));
          setView("text");
          // Restoration records a new revision even when the selected text matches the current text.
          void saveRef.current();
          return true;
        } catch (failure) { setContentError(failure instanceof Error ? failure.message : "Не вдалося відновити версію."); return false; }
      }} /> : null}
    <fieldset disabled={!initialized || !!recovery} className="min-w-0 space-y-4">
      <div hidden={view !== "text"} className="space-y-4">
        {draft.content.sections.map((section, index) => <div className="min-w-0 space-y-2 border-b pb-4" key={section.id}>
          <div className="flex flex-wrap items-center gap-1">
            <Input className="min-w-0 flex-1 basis-40 font-semibold" aria-label={`Назва розділу ${index + 1}`} value={section.title} maxLength={200} onChange={(event) => editSection(index, "title", event.target.value)} />
            {([-1, 1] as const).map((direction) => <Button key={direction} size="icon" variant="ghost" title={direction === -1 ? "Вище" : "Нижче"} aria-label={direction === -1 ? "Перемістити розділ вище" : "Перемістити розділ нижче"} disabled={index + direction < 0 || index + direction >= draft.content.sections.length} onClick={() => {
              const sections = [...draft.content.sections];
              const other = sections[index + direction]!; sections[index + direction] = section; sections[index] = other;
              edit({ ...draft, status: "DRAFT", content: { ...draft.content, sections } });
            }}>{direction === -1 ? <ArrowUp /> : <ArrowDown />}</Button>)}
            <Button size="icon" variant="ghost" title="Видалити розділ" aria-label="Видалити розділ" disabled={draft.content.sections.length === 1} onClick={() => {
              if (!window.confirm(`Видалити розділ «${section.title}» разом із текстом?`)) return;
              edit({ ...draft, status: "DRAFT", content: { ...draft.content, sections: draft.content.sections.filter((item) => item.id !== section.id) } });
            }}><Trash2 /></Button>
          </div>
          <ConsultationRichText value={section.body} disabled={!initialized || !!recovery} label={`Текст: ${section.title}`}
            canChange={(body) => consultationContentSchema.safeParse(richContent(section.id, body)).success}
            onChange={(body) => edit({ ...latest.current, status: "DRAFT", content: richContent(section.id, body) })} />
        </div>)}
        <Button variant="outline" disabled={draft.content.sections.length >= 30} onClick={() => edit({ ...draft, status: "DRAFT", content: {
          ...draft.content, sections: [...draft.content.sections, { id: crypto.randomUUID(), title: "Новий розділ", body: draft.content.version === 2 ? plainTextToRich("") : "" }]
        } })}><Plus />Додати розділ</Button>
      </div>
      {view === "notes" ? <label className="block space-y-2 text-sm font-medium"><span>Приватні нотатки астролога</span>
        <textarea className={textareaClass} maxLength={10000} value={draft.privateNotes} onChange={(event) => edit({ ...draft, privateNotes: event.target.value })} />
      </label> : null}
    </fieldset>
    {view === "preview" ? <article className="min-w-0 space-y-6">
      <h2 className="break-words text-xl font-semibold">{draft.title}</h2>
      {draft.content.sections.map((section) => <section key={section.id} className="space-y-2">
        <h3 className="break-words text-base font-semibold">{section.title}</h3>
        <ConsultationRichPreview body={section.body} />
      </section>)}
    </article> : null}
  </section>;
}
