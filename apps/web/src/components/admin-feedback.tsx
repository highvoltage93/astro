"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Save, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { FeedbackError, feedbackRequest, feedbackStatuses, type FeedbackStatus, type FeedbackList, type FeedbackReport } from "@/lib/feedback";

export function AdminFeedback({ onSaved }: { onSaved: () => void }) {
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<FeedbackList | null>(null);
  const [selected, setSelected] = useState<FeedbackReport | null>(null);
  const [status, setStatus] = useState<FeedbackStatus>("NEW");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const date = (value: string) => new Date(value).toLocaleString("uk-UA");
  function fail(failure: unknown) {
    setError(failure instanceof Error ? failure.message : "Не вдалося завантажити звернення.");
    if (failure instanceof FeedbackError && [401, 403].includes(failure.status)) { setList(null); setSelected(null); }
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void feedbackRequest<FeedbackList>(`/admin/feedback?page=${page}${filter === "ALL" ? "" : `&status=${filter}`}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setList(value); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) fail(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, filter, revision]);
  async function save() {
    if (!selected || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await feedbackRequest(`/admin/feedback/${encodeURIComponent(selected.id)}`, { method: "PATCH", body: JSON.stringify({ status, updatedAt: selected.updatedAt }) });
      setSelected(null); setNotice("Статус збережено."); setRevision((value) => value + 1); onSaved();
    } catch (failure) { fail(failure); }
    finally { setSaving(false); }
  }
  return <Card>
    <CardHeader><CardTitle>Звернення про проблеми{list ? ` (${list.total})` : ""}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><div className="w-full sm:w-56"><Select value={filter} disabled={saving} onValueChange={(value) => { setFilter(value); setPage(1); setSelected(null); }}><SelectTrigger aria-label="Фільтр статусу звернень"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Усі статуси</SelectItem>{Object.entries(feedbackStatuses).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div><Button variant="outline" disabled={loading || saving} onClick={() => { setSelected(null); setRevision((value) => value + 1); }}><RefreshCw />Оновити звернення</Button></div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-primary">{notice}</p> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Завантаження…</p> : null}
      {selected ? <section className="space-y-3 border-y py-4" aria-label="Деталі звернення">
        <div className="flex items-start justify-between gap-3"><h3 className="break-words text-lg font-semibold">{selected.title}</h3><Button variant="ghost" size="icon" disabled={saving} title="Закрити деталі" aria-label="Закрити деталі" onClick={() => setSelected(null)}><X /></Button></div>
        <dl className="grid gap-2 break-words text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Автор на момент звернення</dt><dd>{selected.authorUsername} · {selected.authorEmail}</dd></div>
          <div><dt className="text-muted-foreground">Поточний акаунт</dt><dd>{selected.user.username} · {selected.user.email}</dd></div>
          <div><dt className="text-muted-foreground">Дата</dt><dd>{date(selected.createdAt)}</dd></div>
          <div><dt className="text-muted-foreground">Сторінка</dt><dd>{selected.pagePath}</dd></div>
          <div><dt className="text-muted-foreground">ID користувача</dt><dd className="break-all">{selected.userId}</dd></div>
          <div><dt className="text-muted-foreground">ID звернення</dt><dd className="break-all">{selected.id}</dd></div>
        </dl>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{selected.description}</p>
        <div className="flex flex-wrap gap-2"><div className="w-full sm:w-56"><Select value={status} disabled={saving} onValueChange={(value: FeedbackStatus) => setStatus(value)}><SelectTrigger aria-label="Статус звернення"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(feedbackStatuses).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div><Button disabled={saving || status === selected.status} onClick={() => void save()}><Save />{saving ? "Збереження…" : "Зберегти статус"}</Button></div>
      </section> : null}
      {list ? <>
        <Table><TableHeader><TableRow><TableHead>Дата</TableHead><TableHead>Автор</TableHead><TableHead>Email</TableHead><TableHead>Тема</TableHead><TableHead>Сторінка</TableHead><TableHead>Статус</TableHead><TableHead><span className="sr-only">Дії</span></TableHead></TableRow></TableHeader><TableBody>{list.reports.map((report) => <TableRow key={report.id}>
          <TableCell className="whitespace-nowrap">{date(report.createdAt)}</TableCell><TableCell>{report.authorUsername}</TableCell><TableCell>{report.authorEmail}</TableCell><TableCell className="min-w-48 max-w-80 break-words [overflow-wrap:anywhere]">{report.title}</TableCell><TableCell>{report.pagePath}</TableCell><TableCell className="whitespace-nowrap">{feedbackStatuses[report.status]}</TableCell><TableCell><Button variant="ghost" size="icon" title="Відкрити звернення" aria-label={`Відкрити звернення ${report.title}`} disabled={loading || saving} onClick={() => { setSelected(report); setStatus(report.status); setNotice(""); }}><Eye /></Button></TableCell>
        </TableRow>)}</TableBody></Table>
        {!list.reports.length ? <p className="text-sm text-muted-foreground">Звернень за цим фільтром немає.</p> : null}
        <div className="flex items-center justify-end gap-3 text-sm"><Button size="icon" variant="secondary" title="Попередня сторінка" aria-label="Попередня сторінка" disabled={page <= 1 || loading || saving} onClick={() => { setSelected(null); setPage(page - 1); }}><ChevronLeft /></Button><span>{list.page} / {Math.max(1, Math.ceil(list.total / list.pageSize))}</span><Button size="icon" variant="secondary" title="Наступна сторінка" aria-label="Наступна сторінка" disabled={page * list.pageSize >= list.total || loading || saving} onClick={() => { setSelected(null); setPage(page + 1); }}><ChevronRight /></Button></div>
      </> : null}
    </CardContent>
  </Card>;
}
