"use client";

import { useEffect, useState } from "react";
import { Columns2, Eye, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConsultationRichPreview } from "@/components/consultation-rich-preview";
import { getConsultationVersion, listConsultationHistory, type ConsultationDraft, type ConsultationVersion, type ConsultationVersionSummary } from "@/lib/consultations";
import { ConsultationComparison } from "@/components/consultation-comparison";

export function ConsultationHistory({ token, consultationId, currentRevision, currentSavedDraft, disabled, onRestore }: {
  token: string; consultationId: string; currentRevision: number; currentSavedDraft: ConsultationDraft; disabled: boolean;
  onRestore: (version: ConsultationVersion, includePrivateNotes: boolean) => boolean;
}) {
  const [before, setBefore] = useState<number | undefined>();
  const [page, setPage] = useState<{ versions: ConsultationVersionSummary[]; nextBefore: number | null; currentRevision: number }>({ versions: [], nextBefore: null, currentRevision });
  const [selected, setSelected] = useState<number | null>(null);
  const [version, setVersion] = useState<ConsultationVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [includePrivateNotes, setIncludePrivateNotes] = useState(false);
  const [mode, setMode] = useState<"preview" | "compare">("preview");
  useEffect(() => {
    let active = true;
    setLoading(true); setListError(null);
    void listConsultationHistory(token, consultationId, before).then((result) => { if (active) setPage(result); })
      .catch((failure: unknown) => { if (active) setListError(failure instanceof Error ? failure.message : "Історія недоступна."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, consultationId, before, refresh, currentRevision]);
  useEffect(() => {
    let active = true;
    setVersion(null); setIncludePrivateNotes(false); setDetailError(null);
    if (selected === null) return () => { active = false; };
    setDetailLoading(true);
    void getConsultationVersion(token, consultationId, selected).then((result) => { if (active) setVersion(result.version); })
      .catch((failure: unknown) => { if (active) setDetailError(failure instanceof Error ? failure.message : "Не вдалося відкрити версію."); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [token, consultationId, selected, detailRefresh]);

  return <div className="min-w-0 space-y-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-base font-semibold">Історія збережень</h3>
      <Button size="icon" variant="ghost" title="Оновити історію" aria-label="Оновити історію" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw /></Button>
    </div>
    {loading ? <p role="status" className="text-sm text-muted-foreground">Завантаження…</p> : listError ?
      <p role="alert" className="text-sm text-destructive">{listError}</p> : <>
        <div className="max-h-64 divide-y overflow-y-auto border-y">
          {page.versions.map((item) => <button type="button" key={item.revision} onClick={() => { setVersion(null); setSelected(item.revision); setDetailRefresh((value) => value + 1); }}
            aria-pressed={selected === item.revision} className={`block w-full rounded-sm px-2 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === item.revision ? "bg-muted" : ""}`}>
            <span className="flex flex-wrap gap-x-2 text-sm font-medium"><span>Версія {item.revision}</span><span>{new Date(item.savedAt).toLocaleString("uk-UA")}</span>
              {item.revision === page.currentRevision ? <span className="text-primary">Поточна</span> : null}
            </span>
            <span className="block break-words text-sm text-muted-foreground">{item.title} · {item.status === "READY" ? "Готово" : "Чернетка"}</span>
          </button>)}
          {!page.versions.length ? <p className="py-3 text-sm text-muted-foreground">Збережених версій ще немає.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {before ? <Button variant="ghost" onClick={() => setBefore(undefined)}>Найновіші</Button> : null}
          {page.nextBefore ? <Button variant="outline" onClick={() => setBefore(page.nextBefore ?? undefined)}>Старіші версії</Button> : null}
        </div>
      </>}
    {page.currentRevision !== currentRevision ? <p role="status" className="text-sm text-destructive">На сервері є інша редакція. Онови консультацію перед відновленням.</p> : null}
    {detailLoading ? <p role="status" className="text-sm text-muted-foreground">Відкриваю версію…</p> : null}
    {detailError ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{detailError}</p>
      <Button variant="outline" onClick={() => setDetailRefresh((value) => value + 1)}><RefreshCw />Повторити</Button></div> : null}
    {version ? <div className="min-w-0 space-y-4 border-t pt-4">
      <h3 className="break-words text-base font-semibold">Версія {version.revision}: {version.title}</h3>
      <div className="flex flex-wrap gap-1 border-b pb-2" role="tablist" aria-label="Перегляд версії">
        <Button role="tab" aria-selected={mode === "preview"} variant={mode === "preview" ? "secondary" : "ghost"} onClick={() => setMode("preview")}><Eye />Текст версії</Button>
        <Button role="tab" aria-selected={mode === "compare"} variant={mode === "compare" ? "secondary" : "ghost"} onClick={() => setMode("compare")}><Columns2 />Порівняння</Button>
      </div>
      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm"><Checkbox checked={includePrivateNotes} onCheckedChange={(value) => setIncludePrivateNotes(value === true)} />Також відновити приватні нотатки</label>
        <Button disabled={disabled || version.revision === currentRevision || page.currentRevision !== currentRevision} onClick={() => {
          if (!window.confirm(`Відновити версію ${version.revision} як нову чернетку? Поточна збережена версія залишиться в історії.${includePrivateNotes ? " Приватні нотатки також буде замінено." : " Приватні нотатки залишаться поточними."}`)) return;
          onRestore(version, includePrivateNotes);
        }}><History />Відновити як нову редакцію</Button>
      </div>
      {mode === "compare" ? <ConsultationComparison key={`${version.revision}:${currentRevision}`} previous={version} current={currentSavedDraft} currentRevision={currentRevision} /> : <>
      <article className="min-w-0 space-y-5">
        {version.content.sections.map((section) => <section key={section.id} className="space-y-2">
          <h4 className="break-words text-sm font-semibold">{section.title}</h4><ConsultationRichPreview body={section.body} />
        </section>)}
      </article>
      <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Приватні нотатки цієї версії</summary>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{version.privateNotes || "Нотаток немає."}</p>
      </details>
      </>}
    </div> : null}
  </div>;
}
