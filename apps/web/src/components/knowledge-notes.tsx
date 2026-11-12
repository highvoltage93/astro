"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Archive, ChevronRight, Copy, History, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { createForecastRequestId } from "@/lib/forecast-archive";
import { knowledgeSeedDraft } from "@/lib/knowledge-note-seed";
import { planetLabelsUk, signLabelsUk, aspectLabels } from "@/lib/astrology-labels";
import { emptyKnowledgeDraft, knowledgeConditionText as conditionText, knowledgeRequest, KnowledgeError, noteDraft,
  type KnowledgeDraft, type KnowledgeHistory, type KnowledgeHistoryEntry, type KnowledgeNote, type KnowledgeSummary, type NoteCondition } from "@/lib/knowledge-notes";

const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "lilith", "north-node", "south-node"];
const aspects = ["conjunction", "sextile", "square", "trine", "opposition"];
const kinds = { house: "Планета в домі", sign: "Планета у знаку", aspect: "Аспект", retrograde: "Ретроградність" };
const date = (value: string) => new Date(value).toLocaleString("uk-UA");
const selectCondition = (kind: NoteCondition["kind"], planet = "mercury"): NoteCondition => {
  if (kind === "house") return { kind, planet, house: 5 };
  if (kind === "sign") return { kind, planet, sign: "aries" };
  if (kind === "aspect") return { kind, planet, otherPlanet: planet === "saturn" ? "moon" : "saturn", aspect: "square" };
  return { kind, planet };
};
function Choice({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className="min-w-0" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select>;
}
type Editor = { id: string; record: KnowledgeNote | null; draft: KnowledgeDraft; sourceProfileId: string | null };

export function KnowledgeNotesPage({ source, noteId, seed }: { source?: string; noteId?: string; seed?: string }) {
  const router = useRouter();
  const editorParams = new URLSearchParams(noteId ? { note: noteId } : { ...(source ? { source } : {}), ...(seed !== undefined ? { seed } : {}) });
  const loginPath = `/login?next=${encodeURIComponent(`/knowledge${editorParams.size ? `?${editorParams}` : ""}`)}`;
  const [notes, setNotes] = useState<KnowledgeSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [baseline, setBaseline] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<KnowledgeHistory | null>(null);
  const [entry, setEntry] = useState<KnowledgeHistoryEntry | null>(null);
  const dirty = !!editor && JSON.stringify(editor.draft) !== baseline;
  const canLeave = () => !dirty || window.confirm("Є незбережені зміни. Відкинути їх?");

  function failed(failure: unknown) {
    if (failure instanceof KnowledgeError && failure.status === 401) {
      setEditor(null); setNotes([]); setHistory(null); setEntry(null); router.replace(loginPath);
    }
    setError(failure instanceof Error ? failure.message : "Не вдалося виконати запит.");
  }
  function show(record: KnowledgeNote) {
    const draft = noteDraft(record);
    setEditor({ id: record.id, record, draft, sourceProfileId: record.sourceProfileId });
    setTagsText(draft.tags.join(", ")); setBaseline(JSON.stringify(draft)); setHistory(null); setEntry(null);
  }
  function create(sourceId: string | null = null, draft = emptyKnowledgeDraft()) {
    setEditor({ id: createForecastRequestId(), record: null, draft, sourceProfileId: sourceId });
    setTagsText(draft.tags.join(", ")); setBaseline(JSON.stringify(emptyKnowledgeDraft())); setHistory(null); setEntry(null); setError(""); setNotice("");
  }
  useEffect(() => {
    if (!localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) { router.replace(loginPath); return; }
    const controller = new AbortController();
    if (noteId) {
      setBusy(true);
      void knowledgeRequest<{ note: KnowledgeNote }>(`/${encodeURIComponent(noteId)}`, { signal: controller.signal })
        .then(({ note }) => { if (!controller.signal.aborted) show(note); })
        .catch((failure: unknown) => { if (!controller.signal.aborted) failed(failure); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    } else if (seed !== undefined) {
      const draft = knowledgeSeedDraft(seed);
      if (draft) create(source ?? null, draft);
      else setError("Умови з посилання некоректні. Створіть спостереження вручну або відкрийте його з карти ще раз.");
    } else if (source) create(source);
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_STORAGE_KEY || event.key === null) {
        setEditor(null); setNotes([]); setHistory(null); setEntry(null); router.replace(loginPath);
      }
    };
    window.addEventListener("storage", changed);
    return () => { controller.abort(); window.removeEventListener("storage", changed); };
  }, [source, noteId, seed, router, loginPath]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ query, status, ...(cursor ? { cursor } : {}) });
    void knowledgeRequest<{ notes: KnowledgeSummary[]; nextCursor: string | null }>(`/?${params}`, { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) { setNotes(response.notes); setNextCursor(response.nextCursor); } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) failed(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, status, cursor, refresh]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target === "_blank" || link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Є незбережені зміни. Залишити сторінку?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  useEffect(() => { if (editor) document.getElementById("knowledge-editor")?.scrollIntoView({ block: "start" }); }, [editor?.id]);

  function edit(patch: Partial<KnowledgeDraft>) {
    setEditor((current) => current ? { ...current, draft: { ...current.draft, ...patch } } : null); setNotice("");
  }
  function changeCondition(index: number, value: NoteCondition) {
    if (editor) edit({ conditions: { ...editor.draft.conditions, items: editor.draft.conditions.items.map((item, at) => at === index ? value : item) } });
  }
  async function open(id: string) {
    if (!canLeave()) return;
    setBusy(true); setError(""); setNotice("");
    try { show((await knowledgeRequest<{ note: KnowledgeNote }>(`/${id}`)).note); }
    catch (failure) { failed(failure); } finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || busy) return;
    if (!editor.draft.title.trim() || !editor.draft.body.trim()) {
      setError("Заповніть назву та текст спостереження."); return;
    }
    if (editor.draft.tags.length > 10 || editor.draft.tags.some((tag) => tag.length > 40)) {
      setError("Додайте до 10 тегів, не більше 40 символів у кожному."); return;
    }
    if (editor.draft.conditions.items.some((item) => item.kind === "aspect" && item.planet === item.otherPlanet)) {
      setError("Для аспекту оберіть дві різні планети."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = editor.record ? { revision: editor.record.revision, draft: editor.draft }
        : { id: editor.id, draft: editor.draft, ...(editor.sourceProfileId ? { sourceProfileId: editor.sourceProfileId } : {}) };
      const response = await knowledgeRequest<{ note: KnowledgeNote }>(editor.record ? `/${editor.id}` : "/", {
        method: editor.record ? "PUT" : "POST", body: JSON.stringify(payload)
      });
      show(response.note); setNotice("Спостереження збережено."); setCursor(null); setRefresh((value) => value + 1);
      if (!editor.record) router.replace(`/knowledge?note=${response.note.id}`, { scroll: false });
    } catch (failure) { failed(failure); } finally { setBusy(false); }
  }
  async function remove() {
    if (!editor?.record || !window.confirm("Видалити спостереження разом з усією історією? Цю дію не можна скасувати.")) return;
    setBusy(true); setError("");
    try { await knowledgeRequest(`/${editor.id}?revision=${editor.record.revision}`, { method: "DELETE" });
      setEditor(null); setHistory(null); setEntry(null); setCursor(null); setRefresh((value) => value + 1); setNotice("Спостереження видалено.");
    } catch (failure) { failed(failure); } finally { setBusy(false); }
  }
  async function loadHistory(before?: number) {
    if (!editor?.record) return;
    setBusy(true); setError("");
    try { setHistory(await knowledgeRequest<KnowledgeHistory>(`/${editor.id}/history${before ? `?before=${before}` : ""}`)); setEntry(null); }
    catch (failure) { failed(failure); } finally { setBusy(false); }
  }
  async function readRevision(revision: number) {
    if (!editor) return;
    setBusy(true); setError("");
    try { setEntry((await knowledgeRequest<{ entry: KnowledgeHistoryEntry }>(`/${editor.id}/history/${revision}`)).entry); }
    catch (failure) { failed(failure); } finally { setBusy(false); }
  }

  return <main className="app-shell-background min-h-screen px-3 py-5 sm:px-6">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Особиста база знань</p><h1 className="text-2xl font-semibold">Мої спостереження</h1></div>
        <Button disabled={busy} onClick={() => { if (canLeave()) create(); }}><Plus />Нове спостереження</Button></header>
      {error ? <p role="alert" className="break-words text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="text-primary">{notice}</p> : null}
      {editor ? <section id="knowledge-editor" className="scroll-mt-4 space-y-4 border-y bg-background/90 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{editor.record ? `Спостереження · v${editor.record.revision}` : "Нове спостереження"}</h2>
          <Button size="icon" variant="ghost" title="Закрити" aria-label="Закрити редактор" disabled={busy} onClick={() => { if (canLeave()) { setEditor(null); setHistory(null); setEntry(null); } }}><X /></Button></div>
        <form onSubmit={save}><fieldset disabled={busy} className="min-w-0 space-y-4">
          <div className="space-y-2"><Label htmlFor="note-title">Назва</Label><Input id="note-title" value={editor.draft.title} maxLength={160} required onChange={(event) => edit({ title: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="note-body">Спостереження</Label><textarea id="note-body" className="min-h-48 w-full rounded-md border bg-secondary p-3 text-base leading-7 focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" value={editor.draft.body} maxLength={20000} required onChange={(event) => edit({ body: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="note-tags">Теги через кому</Label><Input id="note-tags" value={tagsText} maxLength={409} onChange={(event) => { setTagsText(event.target.value); edit({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }); }} /></div>
          <section className="space-y-3"><h3 className="font-semibold">Натальна карта · усі умови одночасно</h3>
            {editor.draft.conditions.items.map((item, index) => <div key={index} className="flex flex-wrap items-center gap-2 border-b pb-3">
              <div className="w-full sm:w-44"><Choice label={`Тип умови ${index + 1}`} value={item.kind} options={Object.entries(kinds)} onChange={(kind) => changeCondition(index, selectCondition(kind as NoteCondition["kind"], item.planet))} /></div>
              <div className="min-w-0 flex-1 basis-36"><Choice label={`Планета умови ${index + 1}`} value={item.planet} options={planets.map((key) => [key, planetLabelsUk[key] ?? key])} onChange={(planet) => changeCondition(index, { ...item, planet })} /></div>
              {item.kind === "house" ? <div className="w-28"><Choice label="Дім" value={String(item.house)} options={Array.from({ length: 12 }, (_, at) => [String(at + 1), `Дім ${at + 1}`])} onChange={(house) => changeCondition(index, { ...item, house: Number(house) })} /></div> : null}
              {item.kind === "sign" ? <div className="min-w-0 flex-1 basis-36"><Choice label="Знак" value={item.sign} options={Object.entries(signLabelsUk)} onChange={(sign) => changeCondition(index, { ...item, sign })} /></div> : null}
              {item.kind === "aspect" ? <><div className="min-w-0 flex-1 basis-36"><Choice label="Аспект" value={item.aspect} options={aspects.map((key) => [key, aspectLabels[key] ?? key])} onChange={(aspect) => changeCondition(index, { ...item, aspect })} /></div><div className="min-w-0 flex-1 basis-36"><Choice label="Друга планета" value={item.otherPlanet} options={planets.map((key) => [key, planetLabelsUk[key] ?? key])} onChange={(otherPlanet) => changeCondition(index, { ...item, otherPlanet })} /></div></> : null}
              <Button type="button" size="icon" variant="ghost" title="Прибрати умову" aria-label={`Прибрати умову ${index + 1}`} disabled={editor.draft.conditions.items.length <= 1} onClick={() => edit({ conditions: { ...editor.draft.conditions, items: editor.draft.conditions.items.filter((_, at) => at !== index) } })}><Trash2 /></Button>
            </div>)}
            <Button type="button" variant="outline" disabled={editor.draft.conditions.items.length >= 10} onClick={() => edit({ conditions: { ...editor.draft.conditions, items: [...editor.draft.conditions.items, selectCondition("house")] } })}><Plus />Умова</Button>
          </section>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {editor.sourceProfileId ? <><span>Карта-джерело:</span><Link className="break-words text-primary underline" target="_blank" rel="noopener noreferrer" href={`/workspace?chartId=${encodeURIComponent(editor.sourceProfileId)}`}>{editor.record?.sourceLabel ?? "Карта з робочої зони"}</Link>
              {!editor.record ? <Button type="button" size="icon" variant="ghost" title="Прибрати джерело" aria-label="Прибрати карту-джерело" onClick={() => setEditor({ ...editor, sourceProfileId: null })}><X /></Button> : null}</>
              : <span>{editor.record?.sourceLabel ? `Карта-джерело видалена: ${editor.record.sourceLabel}` : "Без карти-джерела"}</span>}
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm"><Checkbox checked={editor.draft.archived} onCheckedChange={(checked) => edit({ archived: checked === true })} /><Archive className="size-4" />В архіві</label>
          <div className="flex flex-wrap gap-2"><Button type="submit"><Save />{busy ? "Зберігаю…" : "Зберегти"}</Button>
            {editor.record ? <><Button type="button" variant="secondary" onClick={() => void loadHistory()}><History />Історія</Button><Button type="button" variant="outline" onClick={() => create(editor.sourceProfileId, noteDraft(editor.draft))}><Copy />Як нове</Button><Button type="button" variant="outline" onClick={() => void open(editor.id)}><RefreshCw />Перечитати</Button><Button type="button" size="icon" variant="destructive" title="Видалити спостереження" aria-label="Видалити спостереження" onClick={() => void remove()}><Trash2 /></Button></> : null}
            <span role="status" className="self-center text-sm text-muted-foreground">{dirty ? "Незбережені зміни" : editor.record ? `Збережено ${date(editor.record.updatedAt)}` : "Чернетка"}</span>
          </div>
        </fieldset></form>
        {history ? <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Редакції</h3>
          <div className="flex flex-wrap gap-2">{history.history.map((item) => <Button key={item.revision} disabled={busy} variant="outline" onClick={() => void readRevision(item.revision)}>v{item.revision} · {date(item.savedAt)}</Button>)}</div>
          {history.nextBefore ? <Button variant="secondary" disabled={busy} onClick={() => void loadHistory(history.nextBefore!)}><ChevronRight />Старіші редакції</Button> : null}
          {entry ? <article className="space-y-3 border-l-2 border-primary pl-4"><h4 className="break-words font-semibold">v{entry.revision}: {entry.title}</h4><p className="whitespace-pre-wrap break-words leading-7">{entry.body}</p><ul className="space-y-1 text-sm text-muted-foreground">{entry.conditions.items.map((item, index) => <li key={index}>{conditionText(item)}</li>)}</ul><p className="text-sm">{entry.tags.join(", ")}</p>
            <Button disabled={busy} variant="secondary" onClick={() => { if (canLeave()) { edit(noteDraft(entry)); setTagsText(entry.tags.join(", ")); setEntry(null); setNotice("Редакцію перенесено у форму. Натисніть «Зберегти», щоб створити нову версію."); } }}><Copy />Взяти за основу</Button></article> : null}
        </section> : null}
      </section> : null}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row"><form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setCursor(null); setQuery(search.trim()); setRefresh((value) => value + 1); }}><Input aria-label="Пошук спостережень" placeholder="Назва, текст або тег" value={search} maxLength={160} onChange={(event) => setSearch(event.target.value)} /><Button type="submit" size="icon" title="Знайти" aria-label="Знайти" disabled={busy || loading}><Search /></Button></form>
          <div className="sm:w-48"><Choice label="Статус спостережень" value={status} options={[["active", "Активні"], ["archived", "Архів"], ["all", "Усі"]]} onChange={(value) => { setCursor(null); setStatus(value); }} /></div></div>
        {loading ? <p role="status" className="text-muted-foreground">Завантаження…</p> : null}
        {!loading && !notes.length ? <p className="text-muted-foreground">Спостережень не знайдено.</p> : null}
        <div className="divide-y">{notes.map((note) => <button key={note.id} type="button" disabled={busy || loading} className="flex min-h-16 w-full items-start justify-between gap-3 py-4 text-left hover:bg-accent disabled:opacity-50" onClick={() => void open(note.id)}>
          <span className="min-w-0"><span className="block break-words font-medium">{note.archived ? "Архів · " : ""}{note.title}</span><span className="mt-1 block break-words text-sm text-muted-foreground">{note.tags.join(" · ")}</span><span className="mt-1 block text-xs text-muted-foreground">Оновлено {date(note.updatedAt)} · v{note.revision}</span></span><ChevronRight className="size-5 shrink-0" /></button>)}</div>
        <div className="flex flex-wrap gap-2">{cursor ? <Button disabled={busy || loading} variant="outline" onClick={() => setCursor(null)}><RefreshCw />На початок списку</Button> : null}{nextCursor ? <Button disabled={busy || loading} variant="secondary" onClick={() => setCursor(nextCursor)}><ChevronRight />Наступні спостереження</Button> : null}</div>
      </section>
    </div>
  </main>;
}
