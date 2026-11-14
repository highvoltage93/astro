"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronRight, LockKeyhole, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KnowledgeAuthorActivation } from "@/components/knowledge-author-activation";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { KnowledgeError, knowledgeConditionText, knowledgeLibraryRequest,
  type SharedKnowledgeAccess, type SharedKnowledgeNote, type SharedKnowledgeSummary } from "@/lib/knowledge-notes";

type LibraryPage = { notes: SharedKnowledgeSummary[]; nextCursor: string | null; access: SharedKnowledgeAccess };

export function KnowledgeLibrary({ activeOnly, noteId, authorId, authorName }: { activeOnly: boolean; noteId?: string; authorId?: string; authorName?: string }) {
  const router = useRouter();
  const locationParams = new URLSearchParams({ ...(activeOnly ? { view: "active" } : {}), ...(noteId ? { note: noteId } : {}),
    ...(authorId ? { authorId } : {}), ...(authorName ? { authorName } : {}) });
  const loginPath = `/login?next=${encodeURIComponent(`/knowledge/library${locationParams.size ? `?${locationParams}` : ""}`)}`;
  const [access, setAccess] = useState<SharedKnowledgeAccess | null>(null);
  const [page, setPage] = useState<LibraryPage | null>(null);
  const [note, setNote] = useState<SharedKnowledgeNote | null>(null);
  const [selectedId, setSelectedId] = useState(noteId ?? "");
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [filters, setFilters] = useState<{ query: string; author: string; authorId?: string }>({ query: "", author: "", authorId });
  const [cursor, setCursor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [notice, setNotice] = useState("");
  const reload = () => setAttempt((value) => value + 1);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = query.trim();
      const nextAuthor = filters.authorId ? "" : author.trim().replace(/^@/, "");
      if (nextQuery !== filters.query || nextAuthor !== filters.author) {
        setCursor(null);
        setFilters((current) => ({ ...current, query: nextQuery, author: nextAuthor }));
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, author, filters]);
  const revoke = () => { setAccess((current) => ({ enabled: false, expiresAt: current?.expiresAt ?? null })); setPage(null); setNote(null); };
  function failed(failure: unknown, detail = false) {
    if (failure instanceof KnowledgeError && failure.status === 401) {
      revoke(); router.replace(loginPath);
    }
    if (failure instanceof KnowledgeError && failure.status === 403) revoke();
    (detail ? setDetailError : setError)(failure instanceof Error ? failure.message : "Не вдалося завантажити каталог.");
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setPage(null);
    void (async () => {
      const permission = await knowledgeLibraryRequest<SharedKnowledgeAccess>("/access", { signal: controller.signal });
      if (controller.signal.aborted) return;
      setAccess(permission);
      if (!permission.enabled) { setNote(null); return; }
      const params = new URLSearchParams({ query: filters.query, author: filters.author,
        ...(filters.authorId ? { authorId: filters.authorId } : {}), view: activeOnly ? "active" : "catalog", ...(cursor ? { cursor } : {}) });
      const result = await knowledgeLibraryRequest<LibraryPage>(`?${params}`, { signal: controller.signal });
      if (!controller.signal.aborted) { setPage(result); setAccess(result.access); }
    })().catch((failure: unknown) => { if (!controller.signal.aborted) failed(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeOnly, filters, cursor, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    setNote(null); setDetailError("");
    if (!selectedId || !access?.enabled) { setReading(false); return; }
    setReading(true);
    void knowledgeLibraryRequest<{ note: SharedKnowledgeNote }>(`/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setNote(result.note); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) failed(failure, true); })
      .finally(() => { if (!controller.signal.aborted) setReading(false); });
    return () => controller.abort();
  }, [selectedId, access?.enabled, attempt]);
  useEffect(() => {
    if (selectedId && access?.enabled) document.getElementById("shared-knowledge-detail")?.scrollIntoView({ block: "start" });
  }, [selectedId, access?.enabled]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_STORAGE_KEY || event.key === null) { revoke(); router.replace(loginPath); }
    };
    window.addEventListener("focus", reload); window.addEventListener("storage", changed);
    return () => { window.removeEventListener("focus", reload); window.removeEventListener("storage", changed); };
  }, [router, loginPath]);
  useEffect(() => {
    if (!access?.enabled || !access.expiresAt) return;
    const remaining = Date.parse(access.expiresAt) - Date.now();
    const timer = window.setTimeout(() => {
      if (Date.parse(access.expiresAt!) <= Date.now()) revoke(); else reload();
    }, Math.min(Math.max(remaining, 0), 2147480000));
    return () => window.clearTimeout(timer);
  }, [access?.enabled, access?.expiresAt]);
  async function activate(enabled: boolean) {
    if (!note || busy) return;
    setBusy(true); setDetailError(""); setNotice("");
    try {
      await knowledgeLibraryRequest(`/${note.id}/activation`, { method: enabled ? "PUT" : "DELETE",
        ...(enabled ? { body: JSON.stringify({ revision: note.revision }) } : {}) });
      setNotice(enabled ? "Спостереження активовано для підказок." : "Спостереження вимкнено."); reload();
    } catch (failure) { failed(failure, true); }
    finally { setBusy(false); }
  }
  return <main className="app-shell-background min-h-screen px-3 py-5 sm:px-6">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Спостереження астрологів</h1><Button variant="outline" disabled={loading || busy} onClick={reload}><RefreshCw />Оновити</Button></header>
      <nav aria-label="Розділи спостережень" className="flex flex-wrap gap-2 border-b pb-3">
        <Button asChild variant="ghost"><Link href="/knowledge">Мої</Link></Button>
        <Button asChild variant={activeOnly ? "ghost" : "secondary"}><Link href="/knowledge/library" aria-current={!activeOnly ? "page" : undefined}>Каталог астрологів</Link></Button>
        <Button asChild variant={activeOnly ? "secondary" : "ghost"}><Link href="/knowledge/library?view=active" aria-current={activeOnly ? "page" : undefined}>Активовані</Link></Button>
      </nav>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="text-primary">{notice}</p> : null}
      {loading ? <p role="status" className="text-muted-foreground">Завантаження…</p> : null}
      {access && !access.enabled ? <section className="space-y-3 border-y py-6"><LockKeyhole className="text-primary" /><h2 className="text-lg font-semibold">Доступ до каталогу не активний</h2><p className="text-muted-foreground">Безкоштовний доступ: власні спостереження. Доступ до спостережень інших астрологів під час бети надає адміністратор до визначеної дати.</p><Button asChild variant="outline"><Link href="/knowledge">Мої спостереження</Link></Button></section> : null}
      {access?.enabled ? <>
        <p className="text-sm text-muted-foreground">Доступ до {access.expiresAt ? new Date(access.expiresAt).toLocaleString("uk-UA") : "—"}</p>
        <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={(event) => { event.preventDefault(); setCursor(null); setFilters((current) => ({ ...current, query: query.trim(), author: current.authorId ? "" : author.trim().replace(/^@/, "") })); }}>
          <Input aria-label="Автор, назва або тег" placeholder="Автор, назва або тег" value={query} maxLength={160} onChange={(event) => setQuery(event.target.value)} />
          <div className="flex min-w-0 gap-2"><Input aria-label="Username автора" placeholder="Username автора" disabled={!!filters.authorId}
            value={filters.authorId ? authorName || "Обраний автор" : author} maxLength={50} onChange={(event) => setAuthor(event.target.value)} />
            {filters.authorId ? <Button type="button" size="icon" variant="outline" title="Усі автори" aria-label="Прибрати фільтр автора" onClick={() => { setCursor(null); setAuthor(""); setFilters((current) => ({ query: current.query, author: "" })); }}><X /></Button> : null}
          </div>
          <Button type="submit" disabled={loading || busy} aria-label="Пошук"><Search />Знайти</Button>
        </form>
        {filters.authorId && !activeOnly ? <KnowledgeAuthorActivation key={filters.authorId} authorId={filters.authorId} authorName={authorName || "обраного автора"} onActivated={reload} /> : null}
        {selectedId ? <section id="shared-knowledge-detail" className="scroll-mt-4 space-y-3 border-y py-5">
          <div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-semibold">{note?.title ?? "Публікація"}</h2><Button size="icon" variant="ghost" title="Закрити" aria-label="Закрити публікацію" onClick={() => setSelectedId("")}><X /></Button></div>
          {reading ? <p role="status">Завантаження тексту…</p> : null}
          {detailError ? <p role="alert" className="text-destructive">{detailError}</p> : null}
          {note ? <>
            <p className="text-sm text-primary">Автор: {note.authorUsername} · v{note.revision}</p>
            <p className="whitespace-pre-wrap break-words leading-7">{note.body}</p>
            <ul className="space-y-1 text-sm text-muted-foreground">{note.conditions.items.map((item, index) => <li key={index}>{knowledgeConditionText(item)}</li>)}</ul>
            {note.updateAvailable ? <p className="text-sm text-primary">Нова редакція. Підказки призупинено до прийняття оновлення.</p> : null}
            <div className="flex flex-wrap gap-2">
              {!note.activated || note.updateAvailable ? <Button disabled={busy || reading} onClick={() => void activate(true)}><Check />{note.updateAvailable ? "Прийняти оновлення" : "Активувати"}</Button> : <span className="self-center text-sm text-primary">Активовано</span>}
              {note.activated ? <Button variant="outline" disabled={busy} onClick={() => void activate(false)}><X />Вимкнути</Button> : null}
            </div>
          </> : null}
        </section> : null}
        <section className="divide-y">{page?.notes.map((item) => <button type="button" key={item.id} disabled={busy} className="flex w-full items-start justify-between gap-3 py-4 text-left hover:bg-accent" onClick={() => { setSelectedId(item.id); setNotice(""); }}>
          <span className="min-w-0"><span className="block break-words font-semibold">{item.title}</span><span className="mt-1 block break-words text-sm text-muted-foreground">{item.authorUsername} · v{item.revision} · {item.tags.join(" · ")}</span><span className="mt-1 block text-sm text-primary">{item.updateAvailable ? "Очікує прийняття оновлення" : item.activated ? "Активовано" : ""}</span></span><ChevronRight className="size-5 shrink-0" />
        </button>)}</section>
        {!loading && page && !page.notes.length ? <p className="text-muted-foreground">{activeOnly
          ? "Активованих спостережень за цим запитом немає."
          : "Опублікованих спостережень за цим запитом немає. Автор має опублікувати їх зі своїх нотаток; приватні й архівні записи недоступні."}</p> : null}
        <div className="flex flex-wrap gap-2">{cursor ? <Button variant="outline" disabled={loading} onClick={() => setCursor(null)}>На початок</Button> : null}{page?.nextCursor ? <Button variant="outline" disabled={loading} onClick={() => setCursor(page?.nextCursor ?? null)}><ChevronRight />Наступні</Button> : null}</div>
      </> : null}
    </div>
  </main>;
}
