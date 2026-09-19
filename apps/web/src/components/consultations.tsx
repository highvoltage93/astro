"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown, FileText, Maximize2, Plus, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsultationEditor } from "@/components/consultation-editor";
import { consultationTemplate, createConsultation, getConsultation, listConsultations } from "@/lib/consultations";
import type { Consultation, ConsultationDraft, ConsultationSummary } from "@/lib/consultations";

export function ConsultationsList({ token, sourceProfileId, onOpen }: {
  token: string; sourceProfileId?: string; onOpen?: (id: string) => void;
}) {
  const [items, setItems] = useState<ConsultationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const moreInFlight = useRef(false);
  useEffect(() => {
    const version = ++generation.current;
    setLoading(true); setError(null); setItems([]); setCursor(null);
    void listConsultations(token, sourceProfileId).then((response) => {
      if (version === generation.current) { setItems(response.consultations); setCursor(response.nextCursor); }
    }).catch((failure: unknown) => { if (version === generation.current) setError(failure instanceof Error ? failure.message : "Не вдалося завантажити консультації."); })
      .finally(() => { if (version === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [token, sourceProfileId, refresh]);
  const more = async () => {
    if (!cursor || loading || moreInFlight.current) return;
    const version = generation.current;
    moreInFlight.current = true; setLoading(true); setError(null);
    try {
      const response = await listConsultations(token, sourceProfileId, cursor);
      if (version === generation.current) {
        setItems((current) => [...current, ...response.consultations.filter((item) => !current.some((existing) => existing.id === item.id))]);
        setCursor(response.nextCursor);
      }
    } catch (failure) { if (version === generation.current) setError(failure instanceof Error ? failure.message : "Не вдалося завантажити консультації."); }
    finally { moreInFlight.current = false; if (version === generation.current) setLoading(false); }
  };
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Консультації</h3>
      <Button variant="ghost" size="icon" title="Оновити консультації" aria-label="Оновити консультації" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw /></Button>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {loading ? <p role="status" className="text-sm text-muted-foreground">Завантажую…</p> : null}
    {!loading && !error && !items.length ? <p className="text-sm text-muted-foreground">Консультацій ще немає.</p> : null}
    <div className="divide-y">{items.map((item) => {
      const content = <><span className="block break-words font-medium">{item.title}</span><span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{item.status === "READY" ? "Готово" : "Чернетка"}</Badge>
        <span>Оновлено {new Date(item.updatedAt).toLocaleString("uk-UA")}</span>
      </span></>;
      return onOpen ? <button key={item.id} className="block w-full rounded-md py-3 text-left text-sm hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpen(item.id)}>{content}</button>
        : <Link key={item.id} className="block rounded-md py-3 text-sm hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring" href={`/consultations?id=${encodeURIComponent(item.id)}`}>{content}</Link>;
    })}</div>
    {cursor ? <Button variant="outline" disabled={loading} onClick={() => void more()}><ChevronDown />Ще консультації</Button> : null}
  </div>;
}

export function ConsultationPanel({ token, userId, sourceProfileId, sourceName }: {
  token: string; userId: string; sourceProfileId: string | null; sourceName: string;
}) {
  const [record, setRecord] = useState<Consultation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingCreate = useRef<(ConsultationDraft & { id: string; sourceProfileId: string }) | null>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const open = async (id?: string) => {
    if (inFlight.current) return;
    if (!id && !sourceProfileId) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      if (!id) pendingCreate.current ??= { ...consultationTemplate(sourceName), id: crypto.randomUUID(), sourceProfileId: sourceProfileId! };
      const response = id ? await getConsultation(token, id) : await createConsultation(token, pendingCreate.current!);
      pendingCreate.current = null;
      if (alive.current) setRecord(response.consultation);
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Не вдалося відкрити консультацію."); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  return <div className="space-y-4">
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {record ? <>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={() => { if (window.confirm("Повернутися до списку? Незбережена чернетка залишиться в цій вкладці.")) setRecord(null); }}><ArrowLeft />До списку</Button>
        <Button asChild variant="ghost" size="icon" title="Відкрити редактор в окремій вкладці" aria-label="Відкрити редактор в окремій вкладці"><a href={`/consultations?id=${encodeURIComponent(record.id)}`} target="_blank" rel="noopener noreferrer"><Maximize2 /></a></Button>
      </div>
      <ConsultationEditor key={record.id} record={record} token={token} userId={userId} />
    </> : <>
      <Button disabled={busy || !sourceProfileId} onClick={() => void open()}>{busy ? <RefreshCw className="animate-spin" /> : <Plus />}Створити консультацію</Button>
      {!sourceProfileId ? <p className="text-sm text-muted-foreground">Спершу збережи власну карту, щоб створити консультацію.</p> :
        <div className={busy ? "pointer-events-none opacity-60" : undefined}><ConsultationsList token={token} sourceProfileId={sourceProfileId} onOpen={(id) => void open(id)} /></div>}
    </>}
  </div>;
}

export function ConsultationsCard({ token }: { token: string }) {
  return <Card className="min-w-0"><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Мої консультації</CardTitle></CardHeader>
    <CardContent><ConsultationsList token={token} /></CardContent></Card>;
}
