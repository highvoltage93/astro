"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConsultationRichPreview } from "@/components/consultation-rich-preview";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { ConsultationError, getConsultationClientDocument } from "@/lib/consultations";
import type { ConsultationClientDocument } from "@/lib/consultations";
import { PrintAssetsContent, PrintAssetsControls, useConsultationPrintAssets } from "@/components/consultation-print-assets";
import { printHouseLabels } from "@/lib/consultation-print-assets";

export function ConsultationPrint({ id, revision }: { id?: string; revision?: string }) {
  const router = useRouter();
  const [document, setDocument] = useState<ConsultationClientDocument | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [includeName, setIncludeName] = useState(true);
  const [includeSource, setIncludeSource] = useState(false);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [retry, setRetry] = useState(0);
  const extras = useConsultationPrintAssets(document);
  const hasContent = selected.length > 0 || extras.hasContent;
  const ready = !!document && hasContent && extras.ready && !loading;
  const printState = JSON.stringify([document?.id, document?.revision, selected, includeName, includeSource, extras.options, extras.forecastId, extras.selectedEvents, extras.acknowledged, ready]);
  const latestPrintState = useRef(printState);
  latestPrintState.current = printState;

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!token) { router.replace("/login"); return; }
    if (!id) { setError("Не вибрано консультацію."); setLoading(false); return; }
    setLoading(true); setError(null); setConflict(false); setDocument(null);
    void getConsultationClientDocument(token, id, revision).then((response) => {
      if (!active) return;
      setDocument(response.document);
      setSelected(response.document.content.sections.map((section) => section.id));
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof ConsultationError && failure.status === 401) { router.replace("/login"); return; }
      setConflict(failure instanceof ConsultationError && failure.status === 409);
      setError(failure instanceof Error ? failure.message : "Не вдалося підготувати документ.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, revision, retry, router]);

  useEffect(() => {
    if (!document) return;
    const previous = window.document.title;
    window.document.title = `${document.title} - консультація`;
    return () => { window.document.title = previous; };
  }, [document]);

  const print = async () => {
    if (!ready || printing) return;
    setPrinting(true);
    try {
      await window.document.fonts.ready;
      if (latestPrintState.current !== printState) return;
      window.print();
    } finally { setPrinting(false); }
  };

  return <main data-print-ready={ready} className="consultation-print-page min-h-screen bg-muted/30 px-3 py-5 sm:px-6">
    <div className="consultation-print-controls mx-auto mb-5 max-w-4xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Клієнтський документ</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost"><Link href={id ? `/consultations?id=${encodeURIComponent(id)}` : "/consultations"}><ArrowLeft />До редактора</Link></Button>
          <Button disabled={!ready || printing} onClick={() => void print()}><Printer />{printing ? "Готую…" : "Друк / PDF"}</Button>
        </div>
      </header>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Завантажую збережену редакцію…</p> : null}
      {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>
        {conflict && id ? <Button asChild variant="outline"><Link href={`/consultations/print?id=${encodeURIComponent(id)}`}>Відкрити актуальну редакцію</Link></Button>
          : <Button variant="outline" onClick={() => setRetry((value) => value + 1)}><RefreshCw />Повторити</Button>}
      </div> : null}
      {document ? <>
        <div className="flex flex-wrap items-center gap-4 border-b pb-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={includeName} onCheckedChange={(value) => setIncludeName(value === true)} />Ім'я клієнта</label>
          <label className="flex items-center gap-2"><Checkbox checked={includeSource} onCheckedChange={(value) => setIncludeSource(value === true)} />Дані народження та розрахунку</label>
          <span className="text-xs text-muted-foreground">Редакція {document.revision} · {new Date(document.updatedAt).toLocaleString("uk-UA")}</span>
        </div>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Розділи документа</legend>
          <div className="grid gap-2 sm:grid-cols-2">{document.content.sections.map((section, index) => <label key={section.id} className="flex min-w-0 items-start gap-2 text-sm">
            <Checkbox className="mt-1 shrink-0" checked={selected.includes(section.id)} onCheckedChange={(checked) => setSelected((current) => checked === true ? [...current, section.id] : current.filter((value) => value !== section.id))} />
            <span className="break-words">{section.title || `Розділ ${index + 1}`}</span>
          </label>)}</div>
        </fieldset>
        <PrintAssetsControls model={extras} />
        {!hasContent ? <p role="status" className="text-sm text-destructive">Вибери щонайменше один розділ, карту або таблицю.</p> : null}
      </> : null}
    </div>
    {!ready ? <p className="consultation-print-warning hidden">Документ не готовий до друку. Перевір вибрані розділи, карти та таблиці.</p> : null}
    {document && hasContent ? <article className="consultation-print-document mx-auto max-w-4xl bg-white p-5 text-zinc-950 shadow-sm sm:p-10">
      <header className="mb-8 space-y-3 border-b border-zinc-300 pb-6">
        {document.status !== "READY" ? <p className="text-xs font-semibold uppercase">Чернетка</p> : null}
        <h1 className="break-words text-2xl font-semibold">{document.title}</h1>
        {includeName ? <p className="break-words text-base">{document.source.displayName}</p> : null}
        {includeSource ? <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt>Народження</dt><dd>{document.source.birthDate} · {document.source.birthTimeKnown ? document.source.birthTime || "Час не зазначено" : "Час невідомий"}</dd>
          <dt>Місце</dt><dd className="break-words">{document.source.birthplaceName}</dd>
          <dt>Часовий пояс</dt><dd className="break-words">{document.source.timezone}</dd>
          <dt>Система домів</dt><dd>{printHouseLabels[document.source.houseSystem] ?? document.source.houseSystem}</dd>
          <dt>Зодіак</dt><dd>{document.source.zodiac === "sidereal" ? "Сидеричний" : "Тропічний"}</dd>
          <dt>Знімок розрахунку</dt><dd>{new Date(document.source.calculatedAt).toLocaleString("uk-UA")}</dd>
        </dl> : null}
      </header>
      <div className="space-y-7">{document.content.sections.filter((section) => selected.includes(section.id)).map((section) => <section key={section.id} className="consultation-print-section space-y-3">
        {section.title ? <h2 className="break-words text-lg font-semibold">{section.title}</h2> : null}
        <ConsultationRichPreview body={section.body} />
      </section>)}</div>
      <PrintAssetsContent model={extras} />
      <footer className="mt-10 border-t border-zinc-300 pt-3 text-xs text-zinc-600">
        Редакція {document.revision} · {new Date(document.updatedAt).toLocaleDateString("uk-UA")}
      </footer>
    </article> : null}
  </main>;
}
