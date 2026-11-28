"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Link2, RefreshCw, Search, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewBadge } from "@/components/ui/new-badge";
import { membershipRequest } from "@/lib/membership";

const kinds = { chart: "Карти", forecast: "Прогнози", consultation: "Консультації" };
type Kind = keyof typeof kinds;
type Item = { id: string; title: string; createdAt: string };
const href = (kind: Kind, id: string) => kind === "chart" ? `/workspace?chartId=${encodeURIComponent(id)}`
  : kind === "forecast" ? `/workspace?forecastId=${encodeURIComponent(id)}` : `/consultations?id=${encodeURIComponent(id)}`;

export function ClientMaterials({ clientId }: { clientId: string }) {
  const [kind, setKind] = useState<Kind>("chart");
  const [linked, setLinked] = useState(true);
  return <section className="space-y-4 border-t pt-6" aria-label="Матеріали клієнта">
    <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold">Матеріали клієнта<NewBadge /></h2>
    <div className="flex flex-wrap gap-2" aria-label="Тип матеріалу">
      {(Object.keys(kinds) as Kind[]).map((value) => <Button key={value} type="button" variant={kind === value ? "default" : "outline"} aria-pressed={kind === value} onClick={() => setKind(value)}>{kinds[value]}</Button>)}
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Прив’язка матеріалів">
      <Button type="button" variant={linked ? "secondary" : "ghost"} aria-pressed={linked} onClick={() => setLinked(true)}><Link2 />Прив’язані</Button>
      <Button type="button" variant={!linked ? "secondary" : "ghost"} aria-pressed={!linked} onClick={() => setLinked(false)}><Search />Додати з архіву</Button>
    </div>
    <MaterialList key={`${clientId}:${kind}:${linked}`} clientId={clientId} kind={kind} linked={linked} />
  </section>;
}

function MaterialList({ clientId, kind, linked }: { clientId: string; kind: Kind; linked: boolean }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ items: Item[]; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const path = `/clients/${encodeURIComponent(clientId)}/materials`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    void membershipRequest<{ items: Item[]; hasMore: boolean }>(`${path}?${new URLSearchParams({ kind, linked: String(linked), search: query, page: String(page) })}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setResult(value); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не вдалося завантажити матеріали."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, kind, linked, query, page, revision]);
  async function change(item: Item) {
    if (busy) return;
    if (linked && !window.confirm(`Відв’язати «${item.title}» від клієнта? Сам матеріал залишиться в архіві.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await membershipRequest(`${path}/${kind}/${encodeURIComponent(item.id)}`, { method: linked ? "DELETE" : "PUT", body: "{}" });
      setNotice(linked ? "Прив’язку знято. Оригінал збережено." : "Матеріал прив’язано до клієнта.");
      if (result?.items.length === 1 && page > 1) setPage((value) => value - 1);
      else setRevision((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не вдалося змінити прив’язку."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}>
      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="client-material-search">Пошук за назвою</Label><Input id="client-material-search" maxLength={160} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <Button type="submit" variant="outline" disabled={busy} aria-label="Знайти матеріали" title="Знайти матеріали"><Search /></Button>
      <Button type="button" variant="outline" disabled={busy || loading} aria-label="Оновити матеріали" title="Оновити матеріали" onClick={() => setRevision((value) => value + 1)}><RefreshCw /></Button>
    </form>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {notice ? <p role="status" className="text-sm">{notice}</p> : null}
    {loading ? <p role="status">Завантаження…</p> : null}
    {result ? <>
      <ul className="divide-y border-y">{result.items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 flex-1"><p className="break-words font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("uk-UA")}</p></div>
        <div className="flex shrink-0 gap-2"><Button asChild variant="outline" size="icon"><a href={href(kind, item.id)} target="_blank" rel="noopener noreferrer" title="Відкрити в новій вкладці" aria-label={`Відкрити ${item.title} в новій вкладці`}><ExternalLink /></a></Button>
          <Button type="button" variant="outline" disabled={busy || loading} onClick={() => void change(item)}>{linked ? <Unlink /> : <Link2 />}{linked ? "Відв’язати" : "Прив’язати"}</Button></div>
      </li>)}</ul>
      {!result.items.length ? <p className="py-4 text-sm text-muted-foreground">{query ? "Нічого не знайдено." : linked ? "Прив’язаних матеріалів ще немає." : "Немає матеріалів для додавання."}</p> : null}
      <div className="flex items-center justify-between gap-3"><Button variant="outline" title="Попередня сторінка" aria-label="Попередня сторінка" disabled={busy || page === 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft /></Button><span className="text-sm">Сторінка {page}</span><Button variant="outline" title="Наступна сторінка" aria-label="Наступна сторінка" disabled={busy || !result.hasMore} onClick={() => setPage((value) => value + 1)}><ArrowRight /></Button></div>
    </> : null}
  </div>;
}
