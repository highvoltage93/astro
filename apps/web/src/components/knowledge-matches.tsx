"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpenText, ChevronDown, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import type { ChartResult } from "@/lib/chart-types";
import { knowledgeChartFacts, knowledgeConditionText, knowledgeRequest, KnowledgeError,
  type KnowledgeMatch, type KnowledgeMatchesPage, type KnowledgeNote } from "@/lib/knowledge-notes";

function MatchedNoteBody({ match }: { match: KnowledgeMatch }) {
  const [note, setNote] = useState<KnowledgeNote | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setNote(null); setError("");
    void knowledgeRequest<{ note: KnowledgeNote }>(`/${match.id}`, { signal: controller.signal })
      .then(({ note: result }) => {
        if (controller.signal.aborted) return;
        if (result.revision !== match.revision || result.archived) setError("Спостереження змінилося. Оновіть список збігів.");
        else setNote(result);
      })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Не вдалося відкрити спостереження."); });
    return () => controller.abort();
  }, [match.id, match.revision, attempt]);
  return <div className="space-y-3 pb-4">
    {error ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}><RefreshCw />Повторити</Button></div>
      : note ? <><p className="whitespace-pre-wrap break-words leading-7">{note.body}</p>
        {note.sourceLabel ? <p className="break-words text-sm text-muted-foreground">Карта-джерело: {note.sourceProfileId
          ? <a className="text-primary underline" href={`/workspace?chartId=${encodeURIComponent(note.sourceProfileId)}`} target="_blank" rel="noopener noreferrer">{note.sourceLabel}</a>
          : `${note.sourceLabel} (видалена)`}</p> : null}</>
      : <p role="status" className="text-sm text-muted-foreground">Завантаження тексту…</p>}
    <Button asChild size="sm" variant="outline"><a href={`/knowledge?note=${match.id}`} target="_blank" rel="noopener noreferrer"><ExternalLink />Відкрити в базі знань</a></Button>
  </div>;
}

function MatchedNote({ match }: { match: KnowledgeMatch }) {
  const [expanded, setExpanded] = useState(false);
  return <details className="border-b" onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer py-4 marker:text-primary">
      <span className="break-words font-medium">{match.title}</span>
      <span className="mt-2 block space-y-1 text-sm text-muted-foreground">{match.conditions.items.map((item, index) => <span key={index} className="block break-words">{knowledgeConditionText(item)}</span>)}</span>
    </summary>
    {expanded ? <MatchedNoteBody key={match.revision} match={match} /> : null}
  </details>;
}

function MatchesDrawer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, [tabindex="0"]') ?? [])
        .filter((element) => element.getClientRects().length > 0);
      const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-50">
    <button className="absolute inset-0 bg-background/70 backdrop-blur-sm" tabIndex={-1} aria-label="Закрити спостереження" onClick={onClose} />
    <aside ref={panel} role="dialog" aria-modal="true" aria-labelledby="knowledge-matches-title" className="absolute right-0 top-0 flex h-dvh w-full max-w-[680px] flex-col border-l bg-background shadow-xl">
      <header className="flex items-center justify-between gap-3 border-b p-4"><h2 id="knowledge-matches-title" className="text-lg font-semibold">Збіги з моїми спостереженнями</h2><Button ref={closeButton} size="icon" variant="ghost" title="Закрити" aria-label="Закрити спостереження" onClick={onClose}><X /></Button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </aside>
  </div>;
}

function ChartMatches({ facts, token }: { facts: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<KnowledgeMatch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const refresh = () => { setMatches([]); setNextCursor(null); setCursor(null); setAttempt((value) => value + 1); };
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_STORAGE_KEY || event.key === null) { setUnavailable(true); setMatches([]); setOpen(false); }
    };
    window.addEventListener("storage", changed);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    if (unavailable || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) !== token) { setUnavailable(true); return; }
    const controller = new AbortController();
    setBusy(true); setError("");
    const timer = window.setTimeout(() => {
      void knowledgeRequest<KnowledgeMatchesPage>("/matches", {
        method: "POST", signal: controller.signal, body: JSON.stringify({ chart: JSON.parse(facts), ...(cursor ? { cursor } : {}) })
      }).then((page) => {
        if (controller.signal.aborted) return;
        setMatches((previous) => cursor ? [...previous.filter((item) => !page.matches.some((next) => next.id === item.id)), ...page.matches] : page.matches);
        setNextCursor(page.nextCursor);
      }).catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        if (failure instanceof KnowledgeError && failure.status === 401) { setUnavailable(true); setMatches([]); setOpen(false); }
        else setError(failure instanceof Error ? failure.message : "Не вдалося завантажити збіги.");
      }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [facts, token, cursor, attempt, unavailable]);
  if (unavailable) return null;
  return <>
    <Button variant="secondary" title="Мої спостереження для цієї карти" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
      {busy ? <Loader2 className="animate-spin" /> : <BookOpenText />}Спостереження
      <span className="min-w-5 tabular-nums">{busy && !matches.length ? "…" : error ? "!" : `${matches.length}${nextCursor ? "+" : ""}`}</span>
    </Button>
    {open ? <MatchesDrawer onClose={() => setOpen(false)}>
      <div className="flex items-center justify-between gap-2 border-b pb-3"><p className="text-sm text-muted-foreground">Натальна карта · {matches.length}{nextCursor ? "+" : ""} збігів</p><Button size="icon" variant="ghost" disabled={busy} title="Оновити збіги" aria-label="Оновити збіги" onClick={refresh}><RefreshCw /></Button></div>
      {error ? <div role="alert" className="space-y-2 py-3"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setAttempt((value) => value + 1)}><RefreshCw />Повторити</Button></div> : null}
      {matches.map((match) => <MatchedNote key={match.id} match={match} />)}
      {busy ? <p role="status" className="py-4 text-sm text-muted-foreground">Шукаю збіги…</p> : null}
      {!busy && !error && !matches.length ? <p className="py-4 text-muted-foreground">{nextCursor ? "У переглянутій частині бази збігів немає." : "Збігів із вашими активними спостереженнями немає."}</p> : null}
      {nextCursor ? <Button className="mt-4" variant="outline" disabled={busy || !!error} onClick={() => setCursor(nextCursor)}><ChevronDown />Шукати далі</Button> : null}
    </MatchesDrawer> : null}
  </>;
}

export function KnowledgeMatches({ chart, token }: { chart: ChartResult; token: string }) {
  if (chart.chartType !== "natal" || chart.engine.status !== "swiss-ephemeris") return null;
  const facts = JSON.stringify(knowledgeChartFacts(chart));
  return <ChartMatches key={`${token}:${facts}`} facts={facts} token={token} />;
}
