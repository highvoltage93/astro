"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, loginUser, registerUser } from "@/lib/api";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";

type AuthMode = "login" | "register";

type AuthFormState = {
  email: string;
  username: string;
  password: string;
};

const initialAuthForm: AuthFormState = {
  email: "",
  username: "",
  password: ""
};

const getSafeNextPath = (): string => {
  const nextPath = new URLSearchParams(window.location.search).get("next");

  return nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState<AuthFormState>(initialAuthForm);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    if (!storedToken) {
      return;
    }

    setStatus("loading");

    void getCurrentUser(storedToken)
      .then(() => {
        router.replace(getSafeNextPath());
      })
      .catch(() => {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        setStatus("idle");
      });
  }, [router]);

  const updateForm = <Field extends keyof AuthFormState>(field: Field, value: AuthFormState[Field]): void => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
    setError(null);
    setStatus("idle");
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const response =
        mode === "register"
          ? await registerUser(form)
          : await loginUser({
              username: form.username,
              password: form.password
            });

      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token);
      setStatus("ready");
      router.replace(getSafeNextPath());
    } catch (requestError) {
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "Unknown auth error");
    }
  };

  return (
    <main className="app-shell-background flex min-h-screen items-center justify-center px-4 py-8 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardDescription className="font-semibold uppercase text-primary">Astroprocessor</CardDescription>
          <CardTitle>Авторизація</CardTitle>
          <p className="text-sm text-muted-foreground">Увійди, щоб відкрити астрологічне ядро та збережені карти.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/30 p-1">
            <Button
              size="sm"
              variant={mode === "login" ? "default" : "ghost"}
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setStatus("idle");
              }}
            >
              Логін
            </Button>
            <Button
              size="sm"
              variant={mode === "register" ? "default" : "ghost"}
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
                setStatus("idle");
              }}
            >
              Реєстрація
            </Button>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" ? (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={form.username} onChange={(event) => updateForm("username", event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => updateForm("password", event.target.value)}
              />
            </div>

            <Button className="w-full" disabled={status === "loading"} type="submit">
              {status === "loading" ? "Зачекай" : mode === "register" ? "Зареєструватися" : "Увійти"}
            </Button>
          </form>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">email</Badge>
            <Badge variant="secondary">username</Badge>
            <Badge variant="secondary">password</Badge>
            <Badge variant="outline">JWT session</Badge>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
