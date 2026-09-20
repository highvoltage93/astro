"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ConsultationRichPreview } from "@/components/consultation-rich-preview";
import { compareConsultationDrafts } from "@/lib/consultation-comparison";
import type { ConsultationDraft, ConsultationVersion } from "@/lib/consultations";

const statusLabel = (value: ConsultationDraft["status"]) => value === "READY" ? "Готово" : "Чернетка";
const kindLabels = { added: "Додано", removed: "Видалено", changed: "Змінено", unchanged: "Без змін" };
const kindColors = { added: "text-emerald-700 dark:text-emerald-400", removed: "text-rose-700 dark:text-rose-400", changed: "text-amber-700 dark:text-amber-400", unchanged: "text-muted-foreground" };

export function ConsultationComparison({ previous, current, currentRevision }: {
  previous: ConsultationVersion; current: ConsultationDraft; currentRevision: number;
}) {
  const [onlyChanged, setOnlyChanged] = useState(true);
  const result = useMemo(() => {
    try { return { data: compareConsultationDrafts(previous, current), error: null }; }
    catch { return { data: null, error: "Не вдалося порівняти формат цих версій. Їхній текст не змінено." }; }
  }, [previous, current]);
  if (!result.data) return <p role="alert" className="text-sm text-destructive">{result.error}</p>;
  const comparison = result.data;
  const visible = comparison.sections.filter((section) => !onlyChanged || section.kind !== "unchanged");
  const headings = <><p className="text-xs font-semibold text-muted-foreground">Обрана: версія {previous.revision}</p><p className="text-xs font-semibold text-muted-foreground">Збережена: версія {currentRevision}</p></>;

  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" role="status">
      <span className={kindColors.added}>Додано: {comparison.counts.added}</span>
      <span className={kindColors.removed}>Видалено: {comparison.counts.removed}</span>
      <span className={kindColors.changed}>Змінено: {comparison.counts.changed}</span>
      <span className="text-muted-foreground">Без змін: {comparison.counts.unchanged}</span>
    </div>
    {comparison.titleChanged || comparison.statusChanged ? <section className="space-y-2 border-y py-3">
      <h4 className="text-sm font-semibold">Назва й статус</h4>
      <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2">
        {headings}
        {comparison.titleChanged ? <><p className="min-w-0 break-words text-sm">{previous.title}</p><p className="min-w-0 break-words text-sm">{current.title}</p></> : null}
        {comparison.statusChanged ? <><p className="text-sm">{statusLabel(previous.status)}</p><p className="text-sm">{statusLabel(current.status)}</p></> : null}
      </div>
    </section> : null}
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={onlyChanged} onCheckedChange={(value) => setOnlyChanged(value === true)} />Лише змінені розділи</label>
    <div className="min-w-0 divide-y border-y">
      {visible.map((section) => <details key={section.id} className="min-w-0 py-3">
        <summary className="cursor-pointer break-words text-sm font-medium">
          <span className={kindColors[section.kind]}>{kindLabels[section.kind]}</span>{" · "}{section.after?.title || section.before?.title || "Без назви"}
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {[
              section.titleChanged && "Назва", section.textChanged && "Текст", section.formattingOnly && "Форматування / структура",
              section.sourcesChanged && "Джерела прогнозів", section.moved && `Порядок: ${section.beforePosition} → ${section.afterPosition}`
            ].filter(Boolean).join(" · ")}
          </span>
        </summary>
        <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Обрана: версія {previous.revision}{section.beforePosition ? ` · Розділ ${section.beforePosition}` : ""}</p>
            {section.before ? <><h5 className="break-words text-sm font-semibold">{section.before.title}</h5><ConsultationRichPreview body={section.before.body} /></> : <p className="text-sm text-muted-foreground">Розділу немає.</p>}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Збережена: версія {currentRevision}{section.afterPosition ? ` · Розділ ${section.afterPosition}` : ""}</p>
            {section.after ? <><h5 className="break-words text-sm font-semibold">{section.after.title}</h5><ConsultationRichPreview body={section.after.body} /></> : <p className="text-sm text-muted-foreground">Розділу немає.</p>}
          </div>
        </div>
      </details>)}
      {!visible.length ? <p className="py-3 text-sm text-muted-foreground">У розділах змін немає.</p> : null}
    </div>
    <details className="border-b pb-3"><summary className="cursor-pointer text-sm font-medium">Приватні нотатки · {comparison.notesChanged ? "Змінено" : "Без змін"}</summary>
      <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2"><p className="text-xs font-semibold text-muted-foreground">Обрана: версія {previous.revision}</p><p className="whitespace-pre-wrap break-words text-sm">{previous.privateNotes || "Нотаток немає."}</p></div>
        <div className="min-w-0 space-y-2"><p className="text-xs font-semibold text-muted-foreground">Збережена: версія {currentRevision}</p><p className="whitespace-pre-wrap break-words text-sm">{current.privateNotes || "Нотаток немає."}</p></div>
      </div>
    </details>
  </div>;
}
