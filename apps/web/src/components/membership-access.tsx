"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { accessEndDate, accessTimeLeft, membershipRequest, type Account } from "@/lib/membership";

const MembershipContext = createContext({ canWork: true });
export const useMembershipAccess = () => useContext(MembershipContext);

export function MembershipAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const controller = new AbortController();
    setAccount(null);
    const refresh = () => {
      setNow(Date.now());
      if (!localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return;
      void membershipRequest<Account>("/account", { signal: controller.signal })
        .then(value => { if (!controller.signal.aborted) setAccount(value); }).catch(() => {});
    };
    refresh();
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [pathname]);
  const access = account?.access;
  const expired = !!access && access.mode === "enforced" && !access.administrator &&
    (!access.canWork || (!!access.endsAt && Date.parse(access.endsAt) <= now));
  const remaining = access?.endsAt ? Date.parse(access.endsAt) - now : null;
  const endingSoon = remaining !== null && remaining > 0 && remaining <= 48 * 3600000;
  return <MembershipContext.Provider value={{ canWork: !expired }}>
    {access && !access.administrator ? <div role="status" className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm ${endingSoon || expired ? "border-amber-400/50 bg-amber-100 text-stone-900" : "bg-secondary"}`}>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{expired ? "Доступ завершився"
          : access.endsAt ? `${access.plan === "TRIAL" ? "Trial" : "Повний доступ"}: ${accessTimeLeft(access.endsAt, now).toLowerCase()}`
          : access.mode === "preview" ? "Бета-доступ" : "Без активної підписки"}</p>
        {access.endsAt ? <p className="break-words">До {accessEndDate(access.endsAt)}.{endingSoon ? " Строк скоро завершується." : ""}</p> : null}
        <p className="text-xs leading-5">{access.mode === "preview" ? "Обмеження ще вимкнені: завершення Trial зараз не блокує роботу. Про запуск підписок повідомимо окремо."
          : "Після завершення нові розрахунки й редагування потребують підписки. Архів залишається доступним для читання."}</p>
      </div>
      <Link href="/plans" className="inline-flex min-h-11 shrink-0 items-center underline underline-offset-4">Умови підписки</Link>
    </div> : null}
    {children}
  </MembershipContext.Provider>;
}
