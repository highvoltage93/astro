"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpenText, ChevronLeft, ChevronRight, RefreshCw, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { KnowledgeAuthorActivation } from "@/components/knowledge-author-activation";

type Sort = "rank" | "username" | "score" | "charts" | "forecasts" | "consultations" | "observations" | "publishedObservations";
type Row = { id: string; username: string; rank: number; score: number; charts: number; forecasts: number;
  consultations: number; observations: number; publishedObservations: number };
type Ranking = { astrologers: Row[]; total: number; page: number; pageSize: number };
const columns: { key: Sort; label: string; title: string }[] = [
  { key: "rank", label: "Місце", title: "Місце за загальною кількістю збережених матеріалів" },
  { key: "username", label: "Астролог", title: "Ім'я користувача" },
  { key: "score", label: "Бали", title: "Карти + прогнози + консультації + спостереження. Рейтинг активності, не якості консультацій" },
  { key: "charts", label: "Карти", title: "Збережені карти, без повторних перерахунків" },
  { key: "forecasts", label: "Прогнози", title: "Збережені прогнози" },
  { key: "consultations", label: "Консультації", title: "Усі збережені консультації, включно з чернетками" },
  { key: "observations", label: "Спостереження", title: "Власні спостереження, включно з архівними; чужі активації не враховуються" },
  { key: "publishedObservations", label: "Опубліковані", title: "Доступні публікації спостережень у каталозі" }
];

export default function AstrologersPage() {
  const router = useRouter();
  const [data, setData] = useState<Ranking | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("score");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!token) { router.replace("/login?next=/admin/astrologers"); return; }
    const controller = new AbortController();
    setLoading(true); setData(null); setError(""); setForbidden(false);
    const params = new URLSearchParams({ search: query, sort, direction, page: String(page) });
    void (async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/admin/astrologers?${params}`, {
        cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
      });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (response.status === 401 || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) !== token) {
        setData(null); router.replace("/login?next=/admin/astrologers"); return;
      }
      if (response.status === 403) setForbidden(true);
      if (!response.ok) throw new Error(body.message ?? "Не вдалося завантажити рейтинг.");
      setData(body as Ranking);
    })().catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Не вдалося завантажити рейтинг."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [router, query, sort, direction, page, attempt]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_STORAGE_KEY || event.key === null) { setData(null); router.replace("/login?next=/admin/astrologers"); }
    };
    const focus = () => setAttempt((value) => value + 1);
    window.addEventListener("storage", changed); window.addEventListener("focus", focus);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("focus", focus); };
  }, [router]);
  function order(key: Sort) {
    setPage(1);
    setDirection(sort === key ? direction === "asc" ? "desc" : "asc" : key === "username" || key === "rank" ? "asc" : "desc");
    setSort(key);
  }
  return <main className="app-shell-background min-h-screen px-3 py-5 sm:px-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold"><Trophy className="shrink-0 text-primary" />Топ астрологів<BetaBadge /></h1><p className="mt-1 text-sm text-muted-foreground">Рейтинг активності · доступ лише для адміністратора</p></div>
        <Button variant="outline" disabled={loading} onClick={() => setAttempt((value) => value + 1)}><RefreshCw className={loading ? "animate-spin" : ""} />Оновити</Button>
      </header>
      {error ? <p role="alert" className="break-words text-destructive">{error}</p> : null}
      {forbidden ? <Button asChild variant="outline"><Link href="/">На дешборд</Link></Button> : <>
        <form className="flex max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()); setAttempt((value) => value + 1); }}>
          <Input aria-label="Пошук астролога за username" placeholder="Username астролога" maxLength={160} value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button type="submit" size="icon" title="Знайти астролога" aria-label="Знайти астролога" disabled={loading}><Search /></Button>
        </form>
        {loading ? <p role="status" className="text-sm text-muted-foreground">Завантаження рейтингу…</p> : null}
        {data ? <section className="min-w-0 space-y-3">
          <p className="text-sm text-muted-foreground">Астрологів: {data.total}</p>
          <Table className="min-w-[920px]">
            <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key} aria-sort={sort === column.key ? direction === "asc" ? "ascending" : "descending" : "none"}>
              <button type="button" className="flex min-h-11 items-center gap-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" title={column.title}
                aria-label={`Сортувати: ${column.label}`} disabled={loading} onClick={() => order(column.key)}>
                {column.label}{sort === column.key ? direction === "asc" ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" /> : <ArrowUpDown className="size-3 shrink-0" />}
              </button>
            </TableHead>)}<TableHead>Спостереження автора</TableHead></TableRow></TableHeader>
            <TableBody>{data.astrologers.map((astrologer) => <TableRow key={astrologer.id}>
              <TableCell className="tabular-nums">{astrologer.rank}</TableCell>
              <TableCell className="max-w-48 break-all font-medium">{astrologer.username}</TableCell>
              <TableCell className="font-semibold tabular-nums">{astrologer.score}</TableCell>
              <TableCell className="tabular-nums">{astrologer.charts}</TableCell>
              <TableCell className="tabular-nums">{astrologer.forecasts}</TableCell>
              <TableCell className="tabular-nums">{astrologer.consultations}</TableCell>
              <TableCell className="tabular-nums">{astrologer.observations}</TableCell>
              <TableCell className="tabular-nums">{astrologer.publishedObservations}</TableCell>
              <TableCell><div className="space-y-2"><Button asChild variant="outline" size="sm"><Link href={`/admin/observations?${new URLSearchParams({ authorId: astrologer.id })}`}><BookOpenText />Усі спостереження</Link></Button>{astrologer.publishedObservations ? <div className="space-y-2">
                <Button asChild variant="outline" size="sm"><Link href={`/knowledge/library?${new URLSearchParams({ authorId: astrologer.id, authorName: astrologer.username })}`}><BookOpenText />Переглянути</Link></Button>
                <KnowledgeAuthorActivation authorId={astrologer.id} authorName={astrologer.username} />
              </div> : <span className="block text-muted-foreground">Немає публікацій</span>}</div></TableCell>
            </TableRow>)}</TableBody>
          </Table>
          {!data.astrologers.length ? <p className="py-4 text-muted-foreground">Астрологів не знайдено.</p> : null}
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
            <Button size="icon" variant="outline" title="Попередня сторінка" aria-label="Попередня сторінка" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></Button>
            <span className="tabular-nums">{page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
            <Button size="icon" variant="outline" title="Наступна сторінка" aria-label="Наступна сторінка" disabled={loading || page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}><ChevronRight /></Button>
          </div>
        </section> : null}
      </>}
    </div>
  </main>;
}
