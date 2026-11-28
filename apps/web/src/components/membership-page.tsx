"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleUserRound, Crown, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Account, MembershipError, accessEndDate, accessTimeLeft, membershipDate, membershipRequest, planNames } from "@/lib/membership";
import styles from "@/app/plans/membership.module.css";

export function MembershipPage({ profile = false }: { profile?: boolean }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [welcome, setWelcome] = useState(false);
  const [nextPath, setNextPath] = useState("/");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setWelcome(!profile && params.get("welcome") === "1");
    const next = params.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      const url = new URL(next, window.location.origin);
      if (url.origin === window.location.origin) setNextPath(`${url.pathname}${url.search}${url.hash}`);
    }
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, [profile]);
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
          <h1 className="break-words text-3xl font-semibold">{profile ? account.user.username : welcome ? "Вітаємо в ZORIA" : "Ваш простір для астрології"}</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">{profile ? account.user.email : account.trialEnabled ? `${account.trialDays} днів безкоштовного повного доступу, потім $3 на місяць. Від першої натальної карти до готової консультації: весь функціонал ZORIA в одній підписці.` : "Весь функціонал ZORIA за $3 на місяць. Від першої натальної карти до готової консультації, без поділу інструментів на дорожчі пакети."}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-4 text-sm">
            <span>Поточний план: <strong>{planNames[account.access.plan]}</strong></span>
            {account.access.endsAt ? <span>До {accessEndDate(account.access.endsAt)} · {accessTimeLeft(account.access.endsAt, now)}</span> : null}
            {account.access.administrator ? <span className="font-medium">Адміністратор</span> : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{account.access.mode === "preview"
            ? "Бета-період: тарифні обмеження ще не ввімкнені. Перед запуском чинні користувачі отримають перехідний доступ."
            : account.access.canWork ? "Доступ активний. Після його завершення ваші матеріали залишаться доступними для перегляду."
            : "Доступ завершився. Архів збережено та доступний для перегляду. Для нових розрахунків і редагування потрібно продовжити підписку."}</p>
        </section>
        {welcome ? <section className="space-y-4 border-b border-border pb-6" aria-label="Початок роботи та умови доступу">
          <h2 className="text-xl font-semibold">{account.access.plan === "TRIAL" ? "Ваш пробний період уже почався" : "Ваш акаунт готовий"}</h2>
          <p className="max-w-3xl leading-7">{account.access.plan === "TRIAL" && account.access.endsAt
            ? `Повний доступ безкоштовний до ${accessEndDate(account.access.endsAt)}. Можна будувати карти, розраховувати прогнози, працювати з календарями, консультаціями та спостереженнями.`
            : account.access.mode === "preview" ? "Зараз діє бета-доступ без тарифних обмежень."
            : account.access.canWork ? "Повний доступ активний; його строк показано вище." : "Активного пробного періоду немає. Для доступу до розрахунків зверніться до адміністратора."}</p>
          <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
            <li>Після пробного періоду повний доступ коштує $3 на місяць. Усі інструменти входять у підписку, без доплати за окремі модулі.</li>
            <li>Картка для Trial не потрібна. Автоматичних списань немає.</li>
            <li>Після завершення доступу ваші карти, прогнози й тексти не видаляються.</li>
            <li>{account.access.mode === "preview" ? "Поки тарифні обмеження вимкнені, можна продовжувати роботу й після Trial." : "Без активної підписки залишаться вхід до акаунта та читання власного архіву."}</li>
            <li>Онлайн-оплата ще готується. З питаннями доступу допоможе адміністратор через зворотний зв’язок.</li>
          </ul>
          <Button onClick={() => router.replace(nextPath)}><ArrowRight />Перейти до роботи</Button>
        </section> : null}
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
          <Button asChild><Link href="/plans"><Crown />Підписка</Link></Button>
        </> : <>
          <section aria-label="Trial та місячна підписка" className="grid items-stretch gap-4 md:grid-cols-2">
            {[
              { key: "TRIAL", name: "Trial", price: 0, icon: Sparkles, tagline: account.trialEnabled ? `${account.trialDays} днів повного доступу після реєстрації` : "Пробний період для нових акаунтів тимчасово вимкнено", style: styles.trial,
                items: ["Весь функціонал Pro без обмежень за модулями", "Карти, прогнози, календарі та консультації", "Власні спостереження та підключення опублікованих спостережень інших астрологів", "Один пробний період після реєстрації", "Без платіжної картки та автоматичних списань", "Ваші матеріали зберігаються після Trial"] },
              { key: "PRO", name: "Pro", price: 3, icon: Crown, tagline: "Одна підписка. Усі інструменти для вашої астрологічної практики.", style: styles.pro,
                items: ["Натальні карти, аспекти, зв’язки домів і синастрія", "Соляр, лунар, повільні прогресії та транзити", "Календарі прогнозів, пошук подій і релокація", "Астроподії: рух Місяця, ретроградність, затемнення та зміна знаків", "Редактор консультацій і експорт матеріалів", "Особиста база спостережень і підказки за збігами в картах", "Підключення опублікованих спостережень інших астрологів", "Збережені профілі налаштувань для роботи з картами", "Усі доступні користувачам модулі без окремої доплати"] }
            ].map(({ key, name, price, icon: Icon, tagline, style, items }) => <article key={key} className={`${styles.plan} ${style} flex min-w-0 flex-col p-6`}>
              <div className="mb-5 flex min-h-7 items-center justify-between gap-2"><Icon className="size-6 text-muted-foreground" />
                {account.access.plan === key ? <span className="rounded-full border border-border px-2 py-1 text-xs font-medium">Ваш план</span> : null}</div>
              <h2 className="text-2xl font-semibold">{name}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{tagline}</p>
              <div className="my-6 flex flex-wrap items-baseline gap-2"><span className={styles.price}>${price}</span><span className="text-sm text-muted-foreground">{key === "TRIAL" ? "за пробний період" : "USD / місяць"}</span></div>
              <p className="mb-5 text-xs text-muted-foreground">{key === "TRIAL" ? "Безкоштовно. Повторна активація не передбачена." : "Повний доступ на місяць. Онлайн-оплата ще не підключена."}</p>
              <ul className="flex-1 space-y-4 border-t border-border pt-5">{items.map((item) => <li key={item} className="flex items-start gap-2 text-sm leading-6"><Check className="mt-1 size-4 shrink-0" /><span>{item}</span></li>)}</ul>
              <p className="mt-7 border-t border-border pt-4 text-sm font-medium">{account.access.plan === key ? "Поточний план" : key === "TRIAL" ? "Надається при реєстрації" : "Підключення оплати незабаром"}</p>
            </article>)}
          </section>
          <section className="border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
            <h2 className="mb-2 text-base font-semibold text-foreground">Прості умови, ваші матеріали під рукою</h2>
            <p>Trial і Pro відкривають однаковий повний функціонал: відрізняється лише строк доступу. Після пробного періоду підписка коштує $3 на місяць. Після завершення активного доступу ваші карти, прогнози та консультації не видаляються: архів залишається доступним для перегляду.</p>
            <p className="mt-3">Онлайн-оплата ще не підключена. На старті передбачена разова оплата місяця без автоматичного списання. Поки що з питань активації та продовження доступу звертайтеся до адміністратора через зворотний зв’язок.</p>
          </section>
        </>}
      </>}
    </div>
  </main>;
}
