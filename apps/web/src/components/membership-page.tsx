"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleUserRound, Crown, LoaderCircle, RefreshCw, Sparkles, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Account, MembershipError, membershipDate, membershipRequest, planNames } from "@/lib/membership";
import styles from "@/app/plans/membership.module.css";

export function MembershipPage({ profile = false }: { profile?: boolean }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(""); setAccount(null);
    void membershipRequest<Account>("/account", { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted) setAccount(value);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      if (cause instanceof MembershipError && cause.status === 401) router.replace(`/login?next=${profile ? "/profile" : "/plans"}`);
      else setError(cause instanceof Error ? cause.message : "Не вдалося завантажити профіль.");
    });
    return () => controller.abort();
  }, [profile, revision, router]);

  return <main className={`${styles.surface} px-4 py-6 sm:px-8 sm:py-10`}>
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft className="size-4" />Дешборд</Link>
        <Link href={profile ? "/plans" : "/profile"} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          {profile ? <Crown className="size-4" /> : <CircleUserRound className="size-4" />}{profile ? "Усі плани" : "Мій профіль"}<ArrowRight className="size-4" />
        </Link>
      </header>
      {error ? <div role="alert" className="space-y-3"><p>{error}</p><Button variant="outline" onClick={() => setRevision((value) => value + 1)}><RefreshCw />Повторити</Button></div> : !account ?
        <p role="status" className="flex items-center gap-2"><LoaderCircle className="size-5 animate-spin" />Завантаження…</p> : <>
        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">ZORIA / {profile ? "Акаунт" : "Плани"}</p>
          <h1 className="break-words text-3xl font-semibold">{profile ? account.user.username : "Ваш простір для астрології"}</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">{profile ? account.user.email : "Від першої натальної карти до щоденної практики та консультацій. Оберіть можливості, які відповідають вашій роботі."}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-4 text-sm">
            <span>Поточний план: <strong>{planNames[account.access.plan]}</strong></span>
            {account.access.endsAt ? <span>До {membershipDate(account.access.endsAt)}</span> : null}
            {account.access.administrator ? <span className="font-medium">Адміністратор</span> : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">Бета-період: тарифні обмеження ще не ввімкнені. Ваші поточні можливості й матеріали зберігаються; окремі дозволи адміністратора залишаються чинними.</p>
        </section>
        {profile ? <>
          <section className="border-b border-border pb-6">
            <h2 className="mb-5 text-xl font-semibold">Профіль</h2>
            <dl className="grid gap-5 sm:grid-cols-2">
              {[ ["Email", account.user.email], ["Роль", account.user.role === "ADMIN" ? "Адміністратор" : account.user.role === "CONSULTANT" ? "Консультант" : "Користувач"],
                ["Дата реєстрації", membershipDate(account.user.createdAt)], ["Останній вхід", account.user.lastLoginAt ? membershipDate(account.user.lastLoginAt) : "Ще немає даних"] ].map(([label, value]) =>
                <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
            </dl>
          </section>
          <section><h2 className="mb-5 text-xl font-semibold">Ваші матеріали</h2><dl className="grid grid-cols-3 gap-3">
            {[["Карти", account.user._count.birthProfiles], ["Прогнози", account.user._count.savedForecasts], ["Консультації", account.user._count.consultations]].map(([label, value]) =>
              <div key={label} className="border-l border-border pl-3"><dt className="break-words text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}
          </dl></section>
          <Button asChild><Link href="/plans"><Crown />Порівняти плани</Link></Button>
        </> : <>
          <section aria-label="Порівняння планів" className="grid items-stretch gap-4 lg:grid-cols-3">
            {[
              { key: "FREE", name: "Free", price: 0, icon: Sprout, tagline: "Для знайомства з платформою", style: "", items: ["Натальна карта та базові таблиці", "Власні спостереження", "Перегляд збережених матеріалів", "Базові можливості архіву"] },
              { key: "TRIAL", name: "Trial", price: 5, icon: Sparkles, tagline: account.trialEnabled ? `${account.trialDays} днів для знайомства з Pro` : "Пробний період тимчасово вимкнено", style: styles.trial,
                items: ["Можливості Pro на пробний строк", "Прогностика та календарі", "Робота з консультаціями", "Без автоматичного списання"] },
              { key: "PRO", name: "Pro", price: 10, icon: Crown, tagline: "Для регулярної професійної роботи", style: styles.pro,
                items: ["Розширений архів карт і прогнозів", "Прогностичні методи та календарі", "Консультації й експорт", "Спостереження інших астрологів", "Профілі налаштувань"] }
            ].map(({ key, name, price, icon: Icon, tagline, style, items }) => <article key={key} className={`${styles.plan} ${style} flex min-w-0 flex-col p-6`}>
              <div className="mb-5 flex min-h-7 items-center justify-between gap-2"><Icon className="size-6 text-muted-foreground" />
                {account.access.plan === key ? <span className="rounded-full border border-border px-2 py-1 text-xs font-medium">Ваш план</span> : null}</div>
              <h2 className="text-2xl font-semibold">{name}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{tagline}</p>
              <div className="my-6 flex flex-wrap items-baseline gap-2"><span className={styles.price}>${price}</span><span className="text-sm text-muted-foreground">USD / місяць</span></div>
              <p className="mb-5 text-xs text-muted-foreground">Демонстраційна ціна. Оплата недоступна.</p>
              <ul className="flex-1 space-y-4 border-t border-border pt-5">{items.map((item) => <li key={item} className="flex items-start gap-2 text-sm leading-6"><Check className="mt-1 size-4 shrink-0" /><span>{item}</span></li>)}</ul>
              <p className="mt-7 border-t border-border pt-4 text-sm font-medium">{account.access.plan === key ? "Поточний план" : "Підключення оплати незабаром"}</p>
            </article>)}
          </section>
          <section className="border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
            <h2 className="mb-2 text-base font-semibold text-foreground">До запуску підписок</h2>
            <p>Це попереднє порівняння планів. Ціни $0 / $5 / $10 є заглушками, не офертою. Trial не потребує оплати. Остаточні ліміти та умови повідомимо перед запуском; зараз купівля й автоматичне продовження відсутні.</p>
          </section>
        </>}
      </>}
    </div>
  </main>;
}
