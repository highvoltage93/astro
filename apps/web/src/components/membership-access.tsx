"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { membershipDate, membershipRequest, type Account } from "@/lib/membership";

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
  return <MembershipContext.Provider value={{ canWork: !expired }}>
    {access && !access.administrator ? <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary px-4 py-3 text-sm">
      <span>{access.mode === "preview" ? "Бета-доступ: обмеження підписки ще вимкнені."
        : expired ? "Доступ завершився. Архів доступний для перегляду; нова робота потребує підписки."
        : `${access.plan === "TRIAL" ? "Пробний" : "Повний"} доступ${access.endsAt ? ` до ${membershipDate(access.endsAt)}` : ""}.`}</span>
      <Link href="/plans" className="inline-flex min-h-11 items-center underline underline-offset-4">Підписка</Link>
    </div> : null}
    {children}
  </MembershipContext.Provider>;
}
