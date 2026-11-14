"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { adminKnowledgeRequest, knowledgeConditionText, KnowledgeError, type KnowledgeDraft, type KnowledgeSummary } from "@/lib/knowledge-notes";

type Summary = KnowledgeSummary & { owner: { id: string; username: string }; publication: { published: boolean } | null };
type Detail = Omit<Summary, "publication"> & { body: string; sourceLabel: string | null; conditionsJson: KnowledgeDraft["conditions"];
  publication: { published: boolean; title: string; body: string; revision: number; conditionsJson: KnowledgeDraft["conditions"] } | null };
type Page = { notes: Summary[]; nextCursor: string | null };
const statusLabel = (note: Summary) => note.archived ? "Архівне" : note.publication?.published ? "Опубліковане" : "Приватне";

export function AdminObservations({ authorId }: { authorId?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  function fail(failure: unknown) {
    setPage(null); setNote(null);
    if (failure instanceof KnowledgeError && failure.status === 401) router.replace("/login?next=/admin/observations");
    setError(failure instanceof Error ? failure.message : "Не вдалося завантажити спостереження.");
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setCursor(null); }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setPage(null); setNote(null); setError("");
    const params = new URLSearchParams({ query, status, ...(authorId ? { authorId } : {}), ...(cursor ? { cursor } : {}) });
    void adminKnowledgeRequest<Page>(`/?${params}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setPage(result); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) fail(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, status, authorId, cursor, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    setNote(null); setReading(false);
    if (!selected || !page) return;
    setReading(true);
    void adminKnowledgeRequest<{ note: Detail }>(`/${selected}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setNote(result.note); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) fail(failure); })
      .finally(() => { if (!controller.signal.aborted) setReading(false); });
    return () => controller.abort();
  }, [selected, page]);
  useEffect(() => {
    const focus = () => { setPage(null); setNote(null); setAttempt((value) => value + 1); };
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_STORAGE_KEY || event.key === null) { setPage(null); setNote(null); setSelected(""); setAttempt((value) => value + 1); }
    };
    window.addEventListener("focus", focus); window.addEventListener("storage", changed);
    return () => { window.removeEventListener("focus", focus); window.removeEventListener("storage", changed); };
  }, []);
  return <main className="app-shell-background min-h-screen px-3 py-5 sm:px-6"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Усі спостереження</h1><p className="text-sm text-muted-foreground">Адміністративний перегляд · лише читання</p></div><Button variant="outline" disabled={loading} onClick={() => setAttempt((value) => value + 1)}><RefreshCw />Оновити</Button></header>
    <nav className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/knowledge/library">Публічний каталог</Link></Button>{authorId ? <Button asChild variant="outline"><Link href="/admin/observations">Усі автори</Link></Button> : null}</nav>
    <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setCursor(null); setAttempt((value) => value + 1); }}>
      <Input className="min-w-0 flex-1 basis-56" aria-label="Автор, назва або тег" placeholder="Автор, назва або тег" value={search} maxLength={160} onChange={(event) => setSearch(event.target.value)} />
      <select aria-label="Стан спостереження" className="h-10 max-w-full rounded-md border bg-background px-3" value={status} onChange={(event) => { setStatus(event.target.value); setCursor(null); setSelected(""); }}>
        <option value="all">Усі стани</option><option value="private">Приватні</option><option value="published">Опубліковані</option><option value="archived">Архівні</option>
      </select><Button type="submit" size="icon" aria-label="Знайти" title="Знайти"><Search /></Button>
    </form>
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    {loading || reading ? <p role="status">Завантаження…</p> : null}
    {note ? <section className="space-y-3 border-y py-5">
      <div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-semibold">{note.title}</h2><Button size="icon" variant="ghost" aria-label="Закрити спостереження" title="Закрити" onClick={() => setSelected("")}><X /></Button></div>
      <p className="break-words text-sm text-muted-foreground">{note.owner.username} · {statusLabel(note)} · v{note.revision} · {new Date(note.updatedAt).toLocaleString("uk-UA")}</p>
      {note.sourceLabel ? <p className="break-words text-sm">Карта-джерело: {note.sourceLabel}</p> : null}
      <p className="whitespace-pre-wrap break-words leading-7">{note.body}</p>
      <ul className="space-y-1 text-sm">{note.conditionsJson.items.map((item, index) => <li key={index}>{knowledgeConditionText(item)}</li>)}</ul>
      {note.publication ? <details className="border-t pt-3"><summary className="cursor-pointer">Публічна редакція v{note.publication.revision} · {note.publication.published ? "опублікована" : "знята"}</summary><h3 className="mt-3 break-words font-semibold">{note.publication.title}</h3><p className="whitespace-pre-wrap break-words leading-7">{note.publication.body}</p><ul className="text-sm">{note.publication.conditionsJson.items.map((item, index) => <li key={index}>{knowledgeConditionText(item)}</li>)}</ul></details> : null}
    </section> : null}
    <section className="divide-y">{page?.notes.map((item) => <button key={item.id} type="button" className="flex w-full items-center justify-between gap-3 py-4 text-left hover:bg-accent" onClick={() => setSelected(item.id)}><span className="min-w-0"><span className="block break-words font-semibold">{item.title}</span><span className="block break-words text-sm text-muted-foreground">{item.owner.username} · {statusLabel(item)} · {new Date(item.createdAt).toLocaleDateString("uk-UA")}</span></span><ChevronRight className="size-5 shrink-0" /></button>)}</section>
    {page && !page.notes.length ? <p className="text-muted-foreground">Спостережень не знайдено.</p> : null}
    <div className="flex flex-wrap gap-2">{cursor ? <Button variant="outline" disabled={loading} onClick={() => { setCursor(null); setSelected(""); }}>На початок</Button> : null}{page?.nextCursor ? <Button variant="outline" disabled={loading} onClick={() => { setCursor(page.nextCursor); setSelected(""); }}>Наступні<ChevronRight /></Button> : null}</div>
  </div></main>;
}
