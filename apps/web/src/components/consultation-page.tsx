"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConsultationEditor } from "@/components/consultation-editor";
import { ConsultationsList } from "@/components/consultations";
import { getCurrentUser } from "@/lib/api";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { getConsultation, type Consultation } from "@/lib/consultations";

export function ConsultationPage({ id }: { id?: string }) {
  const router = useRouter();
  const [session, setSession] = useState<{ token: string; userId: string } | null>(null);
  const [record, setRecord] = useState<Consultation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!token) { router.replace("/login"); return; }
    setLoading(true); setError(null);
    void (async () => {
      const { user } = await getCurrentUser(token);
      const response = id ? await getConsultation(token, id) : null;
      if (!active) return;
      setSession({ token, userId: user.id }); setRecord(response?.consultation ?? null);
    })().catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : "Не вдалося відкрити документ."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry, router]);
  return <main className="app-shell-background min-h-screen px-3 py-5 sm:px-6">
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Консультація</h1>
        <Button asChild variant="secondary"><Link href="/"><ArrowLeft />Дешборд</Link></Button>
      </header>
      {loading ? <p role="status">Відкриваю документ…</p> : null}
      {error ? <div role="alert" className="space-y-3"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}><RefreshCw />Повторити</Button></div> : null}
      {!loading && !error && session ? <div className="min-w-0 border-t bg-background/90 p-3 sm:p-6">
        {record ? <ConsultationEditor key={record.id} record={record} token={session.token} userId={session.userId} /> : <ConsultationsList token={session.token} />}
      </div> : null}
    </div>
  </main>;
}
