"use client";

import { useEffect, useState } from "react";
import { Copy, EyeOff, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { knowledgeConditionText, knowledgeRequest, type KnowledgeNote, type KnowledgePublication } from "@/lib/knowledge-notes";

export function KnowledgePublicationEditor({ note, disabled }: { note: KnowledgeNote; disabled: boolean }) {
  const [publication, setPublication] = useState<KnowledgePublication | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void knowledgeRequest<{ publication: KnowledgePublication | null }>(`/${note.id}/publication`, { signal: controller.signal })
      .then(({ publication: result }) => { if (!controller.signal.aborted) { setPublication(result); setConsent(false); } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Публікація недоступна."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [note.id, reload]);
  const blocked = disabled || busy || loading;
  async function copyLink() {
    const link = `${location.origin}/knowledge/library?note=${encodeURIComponent(note.id)}`;
    setShareLink(link);
    try { await navigator.clipboard.writeText(link); setNotice("Посилання скопійовано."); }
    catch { setNotice("Посилання на публікацію:"); }
  }
  async function publish() {
    if (blocked || !consent || note.archived) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await knowledgeRequest<{ publication: KnowledgePublication }>(`/${note.id}/publication`, {
        method: "PUT", body: JSON.stringify({ noteRevision: note.revision, publicationRevision: publication?.revision ?? null,
          title, body, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), consent })
      });
      setPublication(response.publication); setOpen(false); setConsent(false);
      setNotice("Публічну редакцію збережено. Приватна нотатка не змінилася.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Не вдалося опублікувати."); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    if (!publication || blocked || !window.confirm("Зняти спостереження з каталогу та підказок інших користувачів?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await knowledgeRequest(`/${note.id}/publication`, { method: "DELETE", body: JSON.stringify({ revision: publication.revision }) });
      setOpen(false); setShareLink(""); setReload((value) => value + 1); setNotice("Публікацію знято.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Не вдалося зняти публікацію."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t pt-4">
    <h3 className="font-semibold">Публікація для спільноти</h3>
    <p className="text-sm text-muted-foreground">{loading ? "Завантаження…" : publication?.published ? `Опубліковано · v${publication.revision}` : "Приватне спостереження"}</p>
    {disabled ? <p className="text-sm text-muted-foreground">Є незбережені зміни нотатки</p> : null}
    {error ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><Button variant="outline" disabled={blocked} onClick={() => setReload((value) => value + 1)}><RefreshCw />Перечитати публікацію</Button></div> : null}
    {notice ? <p role="status" className="text-sm text-primary">{notice}</p> : null}
    {shareLink && publication?.published ? <a className="block break-all text-sm text-primary underline" href={shareLink} target="_blank" rel="noopener noreferrer">{shareLink}</a> : null}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={blocked || note.archived || !!error} onClick={() => {
        setTitle(publication?.title ?? note.title); setBody(publication?.body ?? note.body);
        setTags((publication?.tags ?? note.tags).join(", ")); setConsent(false); setOpen(true); setNotice("");
      }}><Share2 />{publication ? "Підготувати нову редакцію" : "Підготувати публікацію"}</Button>
      {publication?.published ? <>
        <Button variant="outline" disabled={blocked} onClick={() => void copyLink()}><Copy />Посилання</Button>
        <Button variant="outline" disabled={blocked} onClick={() => void withdraw()}><EyeOff />Зняти публікацію</Button>
      </> : null}
    </div>
    {open ? <fieldset disabled={blocked} className="space-y-3 border-l-2 border-primary pl-3">
      <label className="block space-y-1 text-sm">Публічна назва<Input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="block space-y-1 text-sm">Публічний текст<textarea className="min-h-48 w-full rounded-md border bg-secondary p-3 text-base leading-7 sm:text-sm" maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)} /></label>
      <label className="block space-y-1 text-sm">Публічні теги<Input value={tags} maxLength={409} onChange={(event) => setTags(event.target.value)} /></label>
      <ul className="space-y-1 text-sm text-muted-foreground">{note.conditions.items.map((condition, index) => <li key={index}>{knowledgeConditionText(condition)}</li>)}</ul>
      <label className="flex min-h-11 items-start gap-3 text-sm"><Checkbox className="mt-1" checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
        Підтверджую право на публікацію. Текст, назва та теги не містять персональних даних клієнтів. Публікація буде доступна іншим користувачам з доступом до каталогу.</label>
      <div className="flex flex-wrap gap-2"><Button disabled={blocked || !consent || !title.trim() || !body.trim()} onClick={() => void publish()}><Share2 />Опублікувати</Button><Button variant="ghost" onClick={() => setOpen(false)}>Скасувати</Button></div>
    </fieldset> : null}
  </section>;
}
