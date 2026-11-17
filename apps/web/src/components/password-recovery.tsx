"use client";

import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Mail, KeyRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LegalLinks } from "@/components/legal-links";
import { AuthRequestError, requestPasswordReset, resetPassword } from "@/lib/api";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { registrationPasswordError, REGISTRATION_PASSWORD_HINT } from "@/lib/password-policy";

export function PasswordRecovery({ mode }: { mode: "request" | "reset" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(mode === "request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (mode !== "reset" || initialized.current) return;
    initialized.current = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    setToken(/^[A-Za-z0-9_-]{43}$/.test(value) ? value : "");
    window.history.replaceState(window.history.state, "", window.location.pathname);
    setReady(true);
  }, [mode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (mode === "reset") {
      const problem = registrationPasswordError(password);
      if (problem) { setError(problem); return; }
      if (confirmation !== password) { setError("Паролі не збігаються."); return; }
    }
    setBusy(true);
    try {
      const result = mode === "request" ? await requestPasswordReset(email.trim()) : await resetPassword(token, password);
      if (mode === "reset") {
        try { window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY); } catch { /* Server already revoked previous tokens. */ }
        setPassword(""); setConfirmation(""); setToken("");
      }
      setSuccess(result.message);
    } catch (cause) {
      setError(cause instanceof AuthRequestError ? cause.message : "Не вдалося з’єднатися із сервером. Спробуйте пізніше.");
    } finally { setBusy(false); }
  };

  return (
    <main className="auth-cosmos flex min-h-screen items-center justify-center px-3 py-8 text-foreground sm:px-6">
      <div className="relative z-10 w-full max-w-md space-y-5">
        <p className="zoria-brand text-center text-xl">ZORIA ASTROPROCESSOR</p>
        <Card className="w-full border-border/80 bg-card shadow-xl backdrop-blur-xl">
          <CardHeader className="space-y-3">
            {mode === "request" ? <Mail className="h-6 w-6 text-primary" /> : <KeyRound className="h-6 w-6 text-primary" />}
            <CardTitle className="text-xl">{mode === "request" ? "Відновлення доступу" : "Новий пароль"}</CardTitle>
            <CardDescription>{mode === "request" ? "Вкажіть email вашого профілю." : "Після зміни пароля потрібно буде увійти знову на всіх пристроях."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {success ? <p role="status" className="text-sm leading-6">{success}</p> : !ready ? (
              <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Завантаження" />
            ) : mode === "reset" && !token ? (
              <p role="alert" className="text-sm text-destructive">Посилання відсутнє або недійсне. Відкрийте його з листа або запитайте новий.</p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {mode === "request" ? (
                  <div className="space-y-2">
                    <Label htmlFor="recovery-email">Email</Label>
                    <Input id="recovery-email" type="email" autoComplete="email" required maxLength={160}
                      value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="recovery-password">Новий пароль</Label>
                      <div className="relative">
                        <Input id="recovery-password" type={showPassword ? "text" : "password"} autoComplete="new-password"
                          className="pr-12" required maxLength={128} aria-describedby="recovery-hint" value={password}
                          onChange={(event) => setPassword(event.target.value)} disabled={busy} />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0"
                          title={showPassword ? "Приховати пароль" : "Показати пароль"} aria-label={showPassword ? "Приховати пароль" : "Показати пароль"}
                          onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</Button>
                      </div>
                      <p id="recovery-hint" className="text-xs leading-5 text-muted-foreground">{REGISTRATION_PASSWORD_HINT}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recovery-confirmation">Повторіть пароль</Label>
                      <Input id="recovery-confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" required maxLength={128}
                        value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
                    </div>
                  </>
                )}
                {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                <Button className="w-full" type="submit" disabled={busy}>
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : mode === "request" ? <Mail /> : <KeyRound />}
                  {mode === "request" ? "Надіслати посилання" : "Змінити пароль"}
                </Button>
              </form>
            )}
            {mode === "reset" && !success ? <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Запитати нове посилання</Link> : null}
            <Link href="/login" className="flex min-h-11 items-center gap-2 text-sm text-primary"><ArrowLeft className="h-4 w-4" />До входу</Link>
            <LegalLinks />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
