"use client";

import { Eye, EyeOff, LoaderCircle, Orbit, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
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
  confirmPassword: string;
};

type AuthFieldErrors = Partial<Record<keyof AuthFormState, string>>;

const initialAuthForm: AuthFormState = {
  email: "",
  username: "",
  password: "",
  confirmPassword: ""
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getSafeNextPath = (): string => {
  const nextPath = new URLSearchParams(window.location.search).get("next");

  return nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
};

const validateAuthForm = (form: AuthFormState, mode: AuthMode): AuthFieldErrors => {
  const errors: AuthFieldErrors = {};
  const username = form.username.trim();
  const email = form.email.trim();

  if (username.length < 3) {
    errors.username = "Введи щонайменше 3 символи.";
  } else if (username.length > 50) {
    errors.username = "Максимальна довжина — 50 символів.";
  }

  if (form.password.length < 4) {
    errors.password = "Пароль має містити щонайменше 4 символи.";
  } else if (form.password.length > 128) {
    errors.password = "Максимальна довжина — 128 символів.";
  }

  if (mode === "register" && form.confirmPassword !== form.password) {
    errors.confirmPassword = "Паролі не збігаються.";
  }

  if (mode === "register" && !emailPattern.test(email)) {
    errors.email = "Введи коректну email-адресу.";
  }

  return errors;
};

const authHighlights = [
  {
    icon: Orbit,
    title: "Натальні карти",
    description: "Точні положення планет, доми, аспекти, управителі та диспозитори в одному просторі."
  },
  {
    icon: Sparkles,
    title: "Прогностичні модулі",
    description: "Транзити, соляр, лунар і синастрія залишаються поруч із базовою картою."
  },
  {
    icon: ShieldCheck,
    title: "Особистий архів",
    description: "Збережені карти й посилання відкриваються у твоїй захищеній робочій зоні."
  }
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState<AuthFormState>(initialAuthForm);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
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
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === "password" ? { confirmPassword: undefined } : {})
    }));
    setError(null);
    setStatus("idle");
  };

  const changeMode = (nextMode: AuthMode): void => {
    setMode(nextMode);
    setFieldErrors({});
    setError(null);
    setStatus("idle");
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const validationErrors = validateAuthForm(form, mode);

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const response =
        mode === "register"
          ? await registerUser({
              email: form.email.trim(),
              username: form.username.trim(),
              password: form.password
            })
          : await loginUser({
              username: form.username.trim(),
              password: form.password
            });

      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token);
      setStatus("ready");
      router.replace(getSafeNextPath());
    } catch {
      setStatus("error");
      setError(
        mode === "login"
          ? "Не вдалося увійти. Перевір ім’я користувача та пароль."
          : "Не вдалося створити профіль. Email або username уже можуть використовуватися."
      );
    }
  };

  return (
    <main className="auth-cosmos relative min-h-screen overflow-hidden text-white">
      <div aria-hidden="true" className="auth-stars auth-stars-far" />
      <div aria-hidden="true" className="auth-stars auth-stars-near" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1240px] items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.72fr)] lg:gap-16 lg:px-8">
        <section className="max-w-2xl py-6 lg:py-12">
          <div className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-violet-100">
            <Orbit className="h-5 w-5" />
            Професійна астрологічна платформа
          </div>

          <h1 className="text-4xl font-semibold leading-tight tracking-normal sm:text-5xl lg:text-6xl">Astroprocessor</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-violet-100/85 sm:text-lg">
            Робочий простір для точного розрахунку, аналізу та прогнозування. Карта, професійні таблиці й
            збережені дослідження залишаються в єдиному контексті.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
            {authHighlights.map(({ icon: Icon, title, description }) => (
              <div className="flex gap-4" key={title}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/10 text-violet-100 backdrop-blur-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-violet-100/70">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Card className="w-full border-white/20 bg-gradient-to-br from-white/95 via-white/95 to-violet-100/95 text-card-foreground shadow-2xl shadow-black/25 backdrop-blur-xl">
          <CardHeader className="space-y-2 pb-4">
            <CardDescription className="font-semibold uppercase text-primary">
              {mode === "login" ? "Welcome back" : "Create account"}
            </CardDescription>
            <CardTitle className="text-2xl">{mode === "login" ? "Вхід до робочої зони" : "Новий профіль"}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {mode === "login"
                ? "Продовжуй роботу з картами, розрахунками та прогнозами."
                : "Створи профіль, щоб зберігати карти й повертатися до них за посиланням."}
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1" role="tablist">
              <Button
                aria-selected={mode === "login"}
                role="tab"
                size="sm"
                variant={mode === "login" ? "default" : "ghost"}
                type="button"
                onClick={() => changeMode("login")}
              >
                Увійти
              </Button>
              <Button
                aria-selected={mode === "register"}
                role="tab"
                size="sm"
                variant={mode === "register" ? "default" : "ghost"}
                type="button"
                onClick={() => changeMode("register")}
              >
                Реєстрація
              </Button>
            </div>

            <form className="space-y-4" onSubmit={submit} noValidate>
              {mode === "register" ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.email)}
                    autoComplete="email"
                    className="bg-white/75"
                    placeholder="name@example.com"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                  />
                  {fieldErrors.email ? (
                    <p className="text-xs text-destructive" id="auth-email-error">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="auth-username">Ім’я користувача</Label>
                <Input
                  id="auth-username"
                  aria-describedby={fieldErrors.username ? "auth-username-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.username)}
                  autoComplete="username"
                  className="bg-white/75"
                  placeholder="username"
                  value={form.username}
                  onChange={(event) => updateForm("username", event.target.value)}
                />
                {fieldErrors.username ? (
                  <p className="text-xs text-destructive" id="auth-username-error">
                    {fieldErrors.username}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">Пароль</Label>
                <div className="relative">
                  <Input
                    id="auth-password"
                    aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.password)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="bg-white/75 pr-11"
                    placeholder="Щонайменше 4 символи"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => updateForm("password", event.target.value)}
                  />
                  <Button
                    aria-label={showPassword ? "Приховати пароль" : "Показати пароль"}
                    className="absolute right-0 top-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    size="icon"
                    title={showPassword ? "Приховати пароль" : "Показати пароль"}
                    type="button"
                    variant="ghost"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                {fieldErrors.password ? (
                  <p className="text-xs text-destructive" id="auth-password-error">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>

              {mode === "register" ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-confirm-password">Підтвердження пароля</Label>
                  <Input
                    id="auth-confirm-password"
                    aria-describedby={fieldErrors.confirmPassword ? "auth-confirm-password-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    autoComplete="new-password"
                    className="bg-white/75"
                    placeholder="Повтори пароль"
                    type={showPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(event) => updateForm("confirmPassword", event.target.value)}
                  />
                  {fieldErrors.confirmPassword ? (
                    <p className="text-xs text-destructive" id="auth-confirm-password-error">
                      {fieldErrors.confirmPassword}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <Button className="mt-2 w-full" disabled={status === "loading"} type="submit">
                {status === "loading" ? <LoaderCircle className="animate-spin" /> : null}
                {status === "loading" ? "Зачекай" : mode === "register" ? "Створити профіль" : "Увійти"}
              </Button>
            </form>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <p className="border-t pt-4 text-center text-xs leading-5 text-muted-foreground">
              Дані профілю використовуються для доступу до особистої робочої зони та збережених карт.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
