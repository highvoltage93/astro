"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Plus, RefreshCw, Save, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewBadge } from "@/components/ui/new-badge";
import { membershipRequest, type Account } from "@/lib/membership";

type Client = { id: string; name: string; email: string; phone: string; tags: string[]; notes: string; revision: number; updatedAt: string };
type ClientList = { items: Omit<Client, "notes" | "revision">[]; total: number; page: number };
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Не вдалося завантажити дані.";

export function ClientsPage({ clientId }: { clientId?: string }) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<ClientList | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setAllowed(false); setList(null); setClient(null);
    void (async () => {
      const account = await membershipRequest<Account>("/account", { signal: controller.signal });
      if (account.user.role !== "ADMIN") throw new Error("Розділ поки доступний лише адміністраторам.");
      if (controller.signal.aborted) return;
      setAllowed(true);
      if (clientId === "new") return;
      if (clientId) {
        const result = await membershipRequest<{ client: Client }>(`/clients/${encodeURIComponent(clientId)}`, { signal: controller.signal });
        if (!controller.signal.aborted) setClient(result.client);
      } else {
        const result = await membershipRequest<ClientList>(`/clients/?${new URLSearchParams({ search: query, page: String(page) })}`, { signal: controller.signal });
        if (!controller.signal.aborted) setList(result);
      }
    })().catch((cause: unknown) => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [clientId, query, page, revision]);

  return <main className="app-shell-background min-h-screen p-4 sm:p-6"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
      <h1 className="flex min-w-0 flex-wrap items-center gap-3 text-2xl font-semibold"><Users className="size-6 shrink-0" />{clientId ? clientId === "new" ? "Новий клієнт" : "Картка клієнта" : "Клієнти"}<NewBadge /></h1>
      {!clientId && allowed ? <Button asChild><Link href="/clients/new"><Plus />Додати клієнта</Link></Button> : null}
    </header>
    {loading ? <p role="status" className="flex items-center gap-2"><RefreshCw className="size-4 animate-spin" />Завантаження…</p> : null}
    {error ? <div role="alert" className="space-y-3"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => setRevision((value) => value + 1)}><RefreshCw />Повторити</Button><Button asChild variant="ghost"><Link href={clientId ? "/clients" : "/"}><ArrowLeft />Назад</Link></Button></div> : null}
    {!loading && !error && allowed && clientId && (clientId === "new" || client) ? <ClientForm key={`${clientId}:${revision}`} client={client} /> : null}
    {!clientId && allowed ? <>
      <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}>
        <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="client-search">Ім’я, email, телефон або точний тег</Label><Input id="client-search" maxLength={160} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <Button type="submit" variant="outline" aria-label="Знайти клієнтів" title="Знайти клієнтів"><Search /></Button>
      </form>
      {list ? <>
        <p className="text-sm text-muted-foreground">Клієнтів: {list.total}</p>
        <ul className="divide-y border-y">{list.items.map((item) => <li key={item.id}>
          <Link href={`/clients/${encodeURIComponent(item.id)}`} className="flex min-w-0 items-center justify-between gap-4 py-4 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="min-w-0 space-y-1"><p className="break-words font-semibold">{item.name}</p><p className="break-words text-sm text-muted-foreground">{[item.email, item.phone].filter(Boolean).join(" · ") || "Контакти не вказані"}</p>
              {item.tags.length ? <p className="break-words text-sm text-primary">{item.tags.join(" · ")}</p> : null}</div><ArrowRight className="size-5 shrink-0" />
          </Link>
        </li>)}</ul>
        {!list.items.length ? <p className="py-8 text-center text-muted-foreground">{query ? "За цим запитом клієнтів не знайдено." : "Клієнтів ще немає."}</p> : null}
        <div className="flex items-center justify-between gap-3"><Button variant="outline" aria-label="Попередня сторінка" title="Попередня сторінка" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}><ArrowLeft /></Button><span className="text-sm">{page} / {Math.max(1, Math.ceil(list.total / 25))}</span><Button variant="outline" aria-label="Наступна сторінка" title="Наступна сторінка" disabled={page * 25 >= list.total || loading} onClick={() => setPage((value) => value + 1)}><ArrowRight /></Button></div>
      </> : null}
    </> : null}
  </div></main>;
}

function ClientForm({ client }: { client: Client | null }) {
  const router = useRouter();
  const initial = { name: client?.name ?? "", email: client?.email ?? "", phone: client?.phone ?? "", tags: client?.tags.join(", ") ?? "", notes: client?.notes ?? "" };
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [revision, setRevision] = useState(client?.revision ?? 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const tags = [...new Set(form.tags.split(",").map((tag) => tag.trim()).filter(Boolean))];
    if (tags.length > 20 || tags.some((tag) => tag.length > 40)) { setError("Дозволено до 20 тегів, до 40 символів кожен."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await membershipRequest<{ client?: Client }>(client ? `/clients/${encodeURIComponent(client.id)}` : "/clients/", {
        method: client ? "PUT" : "POST", body: JSON.stringify({ ...form, email: form.email.trim(), tags, ...(client ? { revision } : {}) })
      });
      setSaved(form); setRevision((value) => value + 1); setNotice("Зміни збережено.");
      if (!client && result.client) router.replace(`/clients/${encodeURIComponent(result.client.id)}`);
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <>
    <Link href="/clients" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary" onClick={(event) => { if (busy || (dirty && !window.confirm("Вийти без збереження змін?"))) event.preventDefault(); }}><ArrowLeft className="size-4" />До клієнтів</Link>
    <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="client-name">Ім’я клієнта</Label><Input id="client-name" required maxLength={160} disabled={busy} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="client-email">Email</Label><Input id="client-email" type="email" maxLength={160} disabled={busy} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="client-phone">Телефон</Label><Input id="client-phone" type="tel" maxLength={60} disabled={busy} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="client-tags">Теги через кому</Label><Input id="client-tags" maxLength={840} disabled={busy} value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="client-notes">Приватні нотатки</Label><textarea id="client-notes" rows={9} maxLength={20000} disabled={busy} className="w-full rounded-md border border-input bg-background p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
      {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
      {notice ? <p role="status" className="text-sm sm:col-span-2">{notice}</p> : null}
      <div className="flex flex-wrap gap-3 sm:col-span-2"><Button type="submit" disabled={busy || (!dirty && !!client)}>{busy ? <RefreshCw className="animate-spin" /> : <Save />}{client ? "Зберегти" : "Створити клієнта"}</Button>
        {client ? <Button type="button" variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm("Відкинути незбережені зміни та оновити картку?")) window.location.reload(); }}><RefreshCw />Оновити</Button> : null}
      </div>
    </form>
  </>;
}
