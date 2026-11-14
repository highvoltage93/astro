"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { knowledgeLibraryRequest } from "@/lib/knowledge-notes";

export function KnowledgeAuthorActivation({ authorId, authorName, onActivated }: {
  authorId: string; authorName: string; onActivated?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function activate() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await knowledgeLibraryRequest<{ activated: number }>("/author-activation", {
        method: "POST", body: JSON.stringify({ authorId })
      });
      setMessage(result.activated ? `Додано спостережень: ${result.activated}.${result.activated === 500 ? " Натисніть ще раз для наступних." : ""}`
        : "Нових опублікованих спостережень немає.");
      setConfirming(false); onActivated?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не вдалося отримати спостереження.");
    } finally { setBusy(false); }
  }
  return <div className="space-y-2 whitespace-normal">
    {confirming ? <>
      <p className="max-w-sm text-sm">Активувати поточні опубліковані спостереження {authorName} для підказок? Нові публікації та оновлення не підключатимуться автоматично.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void activate()}><Check />{busy ? "Додавання…" : "Підтвердити"}</Button>
        <Button size="icon" variant="ghost" disabled={busy} aria-label="Скасувати отримання" title="Скасувати" onClick={() => { setConfirming(false); setError(""); }}><X /></Button>
      </div>
    </> : <Button size="sm" variant="outline" onClick={() => { setConfirming(true); setMessage(""); }}><Plus />Отримати спостереження</Button>}
    {message ? <p role="status" className="max-w-sm text-sm text-primary">{message}</p> : null}
    {error ? <p role="alert" className="max-w-sm text-sm text-destructive">{error}</p> : null}
  </div>;
}
