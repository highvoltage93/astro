"use client";

import {
  Activity,
  CalendarDays,
  Eye,
  EyeOff,
  Layers3,
  LoaderCircle,
  Network,
  Orbit,
  Save,
  ShieldCheck,
  Sparkles
} from "lucide-react";
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

const registrationCapabilities = [
  {
    icon: Orbit,
    title: "Точне натальне ядро",
    description: "Swiss Ephemeris, секунди народження, системи Коха й Плацидуса, планети, кути, доми та аспекти."
  },
  {
    icon: Layers3,
    title: "Професійний аналіз",
    description: "Управителі, диспозитори, сила планет, синтетичний знак, аспектні фігури та зв’язки домів."
  },
  {
    icon: Activity,
    title: "Методи прогнозування",
    description: "Транзити, соляр, лунар, вторинні прогресії та дирекції солярної дуги в одному розрахунку."
  },
  {
    icon: CalendarDays,
    title: "Календар точних подій",
    description: "Точні дати, повторні проходи, активні орбіси, фільтри й підтвердження кількома методами."
  },
  {
    icon: Network,
    title: "Синастрія та накладення",
    description: "Сумісна bi-wheel карта, аспекти між партнерами та професійна робота зі зв’язками домів."
  },
  {
    icon: Save,
    title: "Особиста робоча зона",
    description: "Збережені карти, швидке повернення до розрахунків і посилання для спільного доступу."
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
    <main className="auth-cosmos relative min-h-screen overflow-x-hidden text-foreground">
      <div aria-hidden="true" className="auth-stars auth-stars-far" />
      <div aria-hidden="true" className="auth-stars auth-stars-near" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1240px] items-center gap-7 px-3 py-5 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.72fr)] lg:gap-16 lg:px-8">
        <section className="order-2 max-w-2xl py-2 sm:py-6 lg:order-1 lg:py-12">
          <div className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-primary sm:mb-8">
            <Orbit className="h-5 w-5" />
            Професійна астрологічна платформа
          </div>

          <h1 className="text-3xl font-semibold leading-tight tracking-normal sm:text-5xl lg:text-6xl">Astroprocessor</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:mt-5 sm:text-lg sm:leading-7">
            {mode === "register"
              ? "Створи власний простір для професійної роботи з натальними картами, прогностикою та матеріалами консультацій."
              : "Робочий простір для точного розрахунку, аналізу та прогнозування. Карта, професійні таблиці й збережені дослідження залишаються в єдиному контексті."}
          </p>

          {mode === "register" ? (
            <div className="mt-6 overflow-hidden rounded-lg border bg-white/65 shadow-xl shadow-primary/5 backdrop-blur-md sm:mt-8">
              <div className="border-b bg-gradient-to-r from-primary/10 via-white/70 to-accent/80 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-primary">Усе в одному процесорі</p>
                    <h2 className="mt-1 text-lg font-semibold text-foreground">Від розрахунку карти до готового прогнозу</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Особистий простір
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2">
                {registrationCapabilities.map(({ icon: Icon, title, description }, index) => (
                  <div
                    className={[
                      "flex gap-3 border-border p-4 sm:p-5",
                      index < registrationCapabilities.length - 1 ? "border-b" : "",
                      index >= registrationCapabilities.length - 2 ? "sm:border-b-0" : "",
                      index % 2 === 0 ? "sm:border-r" : ""
                    ].join(" ")}
                    key={title}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 border-t bg-secondary/45">
                <div className="min-w-0 px-2 py-3 text-center sm:px-3">
                  <strong className="block text-base text-foreground">5</strong>
                  <span className="block text-[9px] uppercase leading-4 text-muted-foreground sm:text-[10px]">методів прогнозу</span>
                </div>
                <div className="min-w-0 border-x px-2 py-3 text-center sm:px-3">
                  <strong className="block text-base text-foreground">12</strong>
                  <span className="block text-[9px] uppercase leading-4 text-muted-foreground sm:text-[10px]">домів карти</span>
                </div>
                <div className="min-w-0 px-2 py-3 text-center sm:px-3">
                  <strong className="block text-base text-foreground">1</strong>
                  <span className="block text-[9px] uppercase leading-4 text-muted-foreground sm:text-[10px]">робочий простір</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
              {authHighlights.map(({ icon: Icon, title, description }) => (
                <div className="flex gap-4" key={title}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary backdrop-blur-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Card className="order-1 w-full border-border/80 bg-gradient-to-br from-white/95 via-white/95 to-accent/70 text-card-foreground shadow-2xl shadow-primary/10 backdrop-blur-xl lg:order-2">
          <CardHeader className="space-y-2 p-4 pb-4 sm:p-5 sm:pb-4">
            <CardDescription className="font-semibold uppercase text-primary">
              {mode === "login" ? "Welcome back" : "Create account"}
            </CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{mode === "login" ? "Вхід до робочої зони" : "Новий профіль"}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {mode === "login"
                ? "Продовжуй роботу з картами, розрахунками та прогнозами."
                : "Створи профіль, щоб зберігати карти й повертатися до них за посиланням."}
            </p>
          </CardHeader>

          <CardContent className="space-y-5 px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1" role="tablist">
              <Button
                aria-selected={mode === "login"}
                className="min-h-10"
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
                className="min-h-10"
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
