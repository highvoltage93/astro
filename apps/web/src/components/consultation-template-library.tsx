"use client";

import { useEffect, useRef, useState } from "react";
import { CopyPlus, FilePlus2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import type { ConsultationContent } from "@astroprocessor/consultation-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConsultationRichText } from "@/components/consultation-rich-text";
import { createForecastRequestId } from "@/lib/forecast-archive";
import {
  deleteTextTemplate, getTextTemplate, listTextTemplates, saveTextTemplate, templateCategories, validTemplateDraft,
  type TemplateCategory, type TemplateDraft, type TemplateMutation, type TemplateSummary
} from "@/lib/consultation-templates";

type EditorState = { id: string; revision: number | null; draft: TemplateDraft; baseline: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const revisionValid = (value: unknown) => value === null || (typeof value === "number" && Number.isInteger(value) && value > 0);

export function ConsultationTemplateLibrary({ token, userId, content, disabled, onInsert }: {
  token: string; userId: string; content: ConsultationContent; disabled: boolean;
  onInsert: (target: string, template: TemplateDraft) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [cursor, setCursor] = useState<string | undefined>();
  const [page, setPage] = useState<{ templates: TemplateSummary[]; nextCursor: string | null }>({ templates: [], nextCursor: null });
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pending, setPending] = useState<TemplateMutation | null>(null);
  const pendingRef = useRef<TemplateMutation | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const [target, setTarget] = useState("new");
  const [inserted, setInserted] = useState(false);
  const key = `astroprocessor:template-draft:${userId}`;
  const dirty = !!editor && JSON.stringify(editor.draft) !== editor.baseline;

  useEffect(() => {
    alive.current = true;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const value = JSON.parse(stored) as { editor?: EditorState; pending?: TemplateMutation | null };
        const draft = value.editor;
        const mutation = value.pending;
        if (draft && uuid.test(draft.id) && revisionValid(draft.revision) && typeof draft.baseline === "string" && validTemplateDraft(draft.draft) &&
          (!mutation || (mutation.id === draft.id && uuid.test(mutation.mutationId) && revisionValid(mutation.revision) &&
            mutation.revision === draft.revision && validTemplateDraft(mutation.draft) && JSON.stringify(mutation.draft) === JSON.stringify(draft.draft)))) {
          setEditor(draft); setPending(mutation ?? null); pendingRef.current = mutation ?? null;
        } else setStorageError("Локальну чернетку шаблону не вдалося прочитати.");
      }
    } catch { setStorageError("Локальне відновлення шаблонів недоступне."); }
    setHydrated(true);
    return () => { alive.current = false; };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (editor && (dirty || pending)) sessionStorage.setItem(key, JSON.stringify({ editor, pending }));
      else sessionStorage.removeItem(key);
    } catch { setStorageError("Не вдалося записати локальну копію шаблону. Збережи його перед закриттям."); }
  }, [editor, pending, dirty, hydrated, key]);

  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  useEffect(() => {
    let active = true;
    setLoading(true); setListError(null);
    const timer = setTimeout(() => {
      void listTextTemplates(token, query.trim(), category, cursor).then((result) => { if (active) setPage(result); })
        .catch((failure: unknown) => { if (active) setListError(failure instanceof Error ? failure.message : "Не вдалося завантажити бібліотеку."); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [token, query, category, cursor, refresh]);

  const canLeave = () => !dirty && !pendingRef.current || window.confirm("Відкинути локальні зміни шаблону? Після помилки мережі останній запит уже міг зберегтися на сервері.");
  const clearPending = () => { pendingRef.current = null; setPending(null); };
  const newTemplate = (draft: TemplateDraft = { title: "", category: "general", body: "" }) => {
    if (busyRef.current || !canLeave()) return;
    clearPending(); setError(null); setInserted(false);
    setEditor({ id: createForecastRequestId(), revision: null, draft: structuredClone(draft), baseline: "" });
  };
  const open = async (id: string) => {
    if (busyRef.current || !canLeave()) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const { template } = await getTextTemplate(token, id);
      if (!alive.current) return;
      const draft = { title: template.title, category: template.category, body: template.body };
      if (!validTemplateDraft(draft)) throw new Error("Формат шаблону не підтримується.");
      clearPending(); setEditor({ id: template.id, revision: template.revision, draft, baseline: JSON.stringify(draft) }); setInserted(false);
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Не вдалося відкрити шаблон."); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const save = async () => {
    if (!editor || busyRef.current) return;
    if (!validTemplateDraft(editor.draft) || !editor.draft.title.trim()) {
      setError("Перевір назву та розмір шаблону."); return;
    }
    const mutation = pendingRef.current ?? { id: editor.id, revision: editor.revision, mutationId: createForecastRequestId(), draft: structuredClone(editor.draft) };
    pendingRef.current = mutation; setPending(mutation); busyRef.current = true; setBusy(true); setError(null);
    try {
      const { template } = await saveTextTemplate(token, mutation);
      if (!alive.current) return;
      const draft = { title: template.title, category: template.category, body: template.body };
      clearPending(); setEditor({ id: template.id, revision: template.revision, draft, baseline: JSON.stringify(draft) });
      setRefresh((value) => value + 1);
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Не вдалося зберегти шаблон."); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const remove = async () => {
    if (!editor || editor.revision === null || busyRef.current || !window.confirm(`Видалити шаблон «${editor.draft.title}»? Тексти консультацій залишаться без змін.`)) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      await deleteTextTemplate(token, editor.id, editor.revision);
      if (!alive.current) return;
      setEditor(null); clearPending(); setCursor(undefined); setRefresh((value) => value + 1);
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Не вдалося видалити шаблон."); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const locked = busy || !hydrated;
  const change = (draft: TemplateDraft) => { if (editor) { setEditor({ ...editor, draft }); setInserted(false); } };

  return <div className="min-w-0 space-y-4">
    {storageError ? <p role="alert" className="text-sm text-destructive">{storageError}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={locked} onClick={() => newTemplate()}><Plus />Новий шаблон</Button>
      <Select value="" disabled={locked} onValueChange={(id) => {
        const section = content.sections.find((item) => item.id === id);
        if (section) newTemplate({ title: section.title.slice(0, 120), category: "general", body: section.body });
      }}><SelectTrigger className="w-full sm:w-56" aria-label="Створити шаблон з розділу"><SelectValue placeholder="З розділу консультації" /></SelectTrigger>
        <SelectContent>{content.sections.map((section, index) => <SelectItem key={section.id} value={section.id}>{section.title || `Розділ ${index + 1}`}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      <Input aria-label="Пошук шаблонів" placeholder="Назва шаблону" maxLength={120} value={query} onChange={(event) => { setQuery(event.target.value); setCursor(undefined); }} />
      <Select value={category} onValueChange={(value) => { setCategory(value as typeof category); setCursor(undefined); }}><SelectTrigger aria-label="Фільтр категорії"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">Усі категорії</SelectItem>{Object.entries(templateCategories).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {loading ? <p role="status" className="text-sm text-muted-foreground">Завантаження…</p> : listError ?
      <div role="alert" className="space-y-2 text-sm text-destructive"><p>{listError}</p><Button variant="outline" onClick={() => { setCursor(undefined); setRefresh((value) => value + 1); }}><RefreshCw />Оновити список</Button></div> : <>
        <div className="max-h-56 divide-y overflow-y-auto border-y">
          {page.templates.map((template) => <button type="button" key={template.id} disabled={locked} onClick={() => void open(template.id)} className={`block w-full rounded-sm px-2 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${editor?.id === template.id ? "bg-muted" : ""}`}>
            <span className="block break-words text-sm font-medium">{template.title}</span>
            <span className="text-xs text-muted-foreground">{templateCategories[template.category]} · {new Date(template.updatedAt).toLocaleDateString("uk-UA")}</span>
          </button>)}
          {!page.templates.length ? <p className="py-3 text-sm text-muted-foreground">Шаблонів не знайдено.</p> : null}
        </div>
        <div className="flex gap-2">
          {cursor ? <Button variant="ghost" onClick={() => setCursor(undefined)}>На початок</Button> : null}
          {page.nextCursor ? <Button variant="outline" onClick={() => setCursor(page.nextCursor ?? undefined)}>Наступні</Button> : null}
        </div>
      </>}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {editor ? <div className="min-w-0 space-y-3 border-t pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label="Назва шаблону" placeholder="Назва шаблону" maxLength={120} value={editor.draft.title} disabled={locked || !!pending} onChange={(event) => change({ ...editor.draft, title: event.target.value })} />
        <Select value={editor.draft.category} disabled={locked || !!pending} onValueChange={(value) => change({ ...editor.draft, category: value as TemplateCategory })}>
          <SelectTrigger aria-label="Категорія шаблону"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(templateCategories).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <ConsultationRichText key={editor.id} label="Текст шаблону" value={editor.draft.body} disabled={locked || !!pending}
        canChange={(body) => validTemplateDraft({ ...editor.draft, body })} onChange={(body) => change({ ...editor.draft, body })} />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={locked || !editor.draft.title.trim() || (!dirty && !pending)} onClick={() => void save()}><Save />{pending ? "Повторити збереження" : "Зберегти шаблон"}</Button>
        <Button variant="outline" disabled={locked} onClick={() => newTemplate(editor.draft)}><CopyPlus />Створити копію</Button>
        {editor.revision !== null ? <Button size="icon" variant="ghost" title="Завантажити актуальну версію" aria-label="Завантажити актуальну версію" disabled={locked} onClick={() => void open(editor.id)}><RefreshCw /></Button> : null}
        {editor.revision !== null ? <Button size="icon" variant="ghost" title="Видалити шаблон" aria-label="Видалити шаблон" disabled={locked || dirty || !!pending} onClick={() => void remove()}><Trash2 /></Button> : null}
        <Button size="icon" variant="ghost" title="Закрити шаблон" aria-label="Закрити шаблон" disabled={locked} onClick={() => {
          if (!canLeave()) return;
          setEditor(null); clearPending(); setError(null); setRefresh((value) => value + 1);
        }}><X /></Button>
        <span role="status" className="text-xs text-muted-foreground">{busy ? "Виконую…" : pending ? "Збереження не підтверджено" : dirty ? "Незбережена чернетка" : "Збережено"}</span>
      </div>
      <label className="block space-y-1 text-sm font-medium"><span>Вставити в розділ</span>
        <Select value={target} onValueChange={(value) => { setTarget(value); setInserted(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="new">Новий розділ</SelectItem>{content.sections.map((section, index) => <SelectItem key={section.id} value={section.id}>{section.title || `Розділ ${index + 1}`}</SelectItem>)}
        </SelectContent></Select>
      </label>
      <Button disabled={disabled || locked || dirty || !!pending || editor.revision === null} onClick={() => { if (onInsert(target, editor.draft)) setInserted(true); }}><FilePlus2 />Вставити шаблон</Button>
      {inserted ? <p role="status" className="text-sm text-primary">Текст додано до консультації.</p> : null}
    </div> : null}
  </div>;
}
