"use client";

import { useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareWarning, Send, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { feedbackRequest } from "@/lib/feedback";
import { createForecastRequestId } from "@/lib/forecast-archive";

export function FeedbackButton() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const requestId = useRef<string | null>(null);
  const sourcePath = useRef("/");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");

  function open() {
    if (!requestId.current) {
      sourcePath.current = ["/", "/workspace", "/consultations", "/admin", "/login"].includes(pathname) ? pathname : "/";
    }
    setReceipt(""); setError(""); dialog.current?.showModal();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (title.trim().length < 3 || description.trim().length < 10) {
      setError("Вкажіть тему від 3 символів та опис від 10 символів."); return;
    }
    pending.current = true; setSending(true); setError("");
    try {
      requestId.current ??= createForecastRequestId();
      const result = await feedbackRequest<{ id: string }>("/feedback", { method: "POST", body: JSON.stringify({
        requestId: requestId.current, title, description, pagePath: sourcePath.current
      }) });
      setReceipt(result.id); setTitle(""); setDescription(""); requestId.current = null;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Не вдалося надіслати звернення."); }
    finally { pending.current = false; setSending(false); }
  }

  return <>
    <Button variant="ghost" className="w-full justify-center whitespace-normal text-xs min-[1440px]:justify-start" title="Повідомити про проблему" aria-label="Повідомити про проблему" onClick={open}>
      <MessageSquareWarning /><span className="lg:hidden min-[1440px]:inline">Повідомити про проблему</span>
    </Button>
    <dialog ref={dialog} aria-labelledby="feedback-title" onCancel={(e) => { if (pending.current) e.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-xl border bg-popover p-5 text-foreground shadow-xl backdrop:bg-black/60">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 id="feedback-title" className="text-lg font-semibold">Повідомити про проблему</h2><Button variant="ghost" size="icon" title="Закрити" aria-label="Закрити" disabled={sending} onClick={() => dialog.current?.close()}><X /></Button></div>
      {receipt ? <div role="status" className="space-y-3"><p>Дякуємо! Звернення передано адміністратору.</p><p className="break-all text-xs text-muted-foreground">Номер: {receipt}</p><Button onClick={() => dialog.current?.close()}>Готово</Button></div> : <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="feedback-subject">Тема</Label><Input id="feedback-subject" autoFocus required minLength={3} maxLength={160} disabled={sending} value={title} onChange={(e) => { setTitle(e.target.value); requestId.current = null; }} /></div>
        <div className="space-y-2"><Label htmlFor="feedback-description">Що сталося?</Label><textarea id="feedback-description" required minLength={10} maxLength={5000} disabled={sending} value={description} onChange={(e) => { setDescription(e.target.value); requestId.current = null; }} className="min-h-40 w-full resize-y rounded-lg border bg-secondary p-3 text-base sm:text-sm" aria-describedby="feedback-privacy" placeholder="Що ви робили, який результат очікували та що отримали?" /></div>
        <p id="feedback-privacy" className="text-xs leading-5 text-muted-foreground">Адміністратор отримає ваше ім’я користувача, email і назву сторінки. Не додавайте паролі чи приватні дані клієнтів.</p>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={sending}><Send />{sending ? "Надсилання…" : "Надіслати"}</Button>
      </form>}
    </dialog>
  </>;
}
