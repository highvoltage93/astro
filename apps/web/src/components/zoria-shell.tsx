"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, Orbit, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/api";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { FeedbackButton } from "./feedback-button";

const navigation = [
  { href: "/", label: "Дешборд", icon: LayoutDashboard },
  { href: "/workspace", label: "Робоча зона", icon: Orbit },
  { href: "/consultations", label: "Консультації", icon: FileText }
];

export function ZoriaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    setIsAdmin(false);
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (token && pathname !== "/login") {
      void getCurrentUser(token).then(({ user }) => { if (active) setIsAdmin(user.role === "ADMIN"); }).catch(() => { if (active) setIsAdmin(false); });
    }
    return () => { active = false; };
  }, [pathname]);
  const items = isAdmin ? [...navigation, { href: "/admin", label: "Адміністрування", icon: ShieldCheck }] : navigation;
  if (pathname === "/login" || pathname === "/consultations/print") return <>{children}</>;

  return (
    <div className="zoria-shell-background min-h-screen lg:grid lg:grid-cols-[76px_minmax(0,1fr)] min-[1440px]:grid-cols-[220px_minmax(0,1fr)]">
      <a href="#zoria-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:p-3 focus:text-primary-foreground">
        До вмісту
      </a>
      <aside className="zoria-sidebar border-b lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <Link href="/" aria-label="ZORIA ASTROPROCESSOR: дешборд" className="flex items-center gap-3 px-4 py-4 lg:justify-center lg:px-3 lg:py-8 min-[1440px]:justify-start min-[1440px]:px-6">
          <Orbit aria-hidden="true" className="size-7 shrink-0 text-primary" />
          <span className="min-w-0 lg:hidden min-[1440px]:block"><span className="zoria-brand block text-[28px] leading-none text-primary">ZORIA</span><span className="mt-1 block text-[10px] text-muted-foreground">ASTROPROCESSOR</span></span>
        </Link>
        <nav aria-label="Головна навігація" className={cn("grid gap-1 px-2 pb-2 lg:grid-cols-1 lg:gap-2 lg:px-3", isAdmin ? "grid-cols-2" : "grid-cols-3")}>
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={href} href={href} title={label} aria-label={label} aria-current={active ? "page" : undefined}
              className={cn("flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-transparent px-2 py-3 text-xs transition-colors hover:bg-secondary lg:px-3 lg:text-sm min-[1440px]:justify-start", active ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground")}>
              <Icon aria-hidden="true" className="size-4 shrink-0" /><span className="break-words lg:hidden min-[1440px]:block">{label}</span>
            </Link>;
          })}
        </nav>
        <div className="border-t px-3 py-2"><FeedbackButton /></div>
      </aside>
      <div id="zoria-content" tabIndex={-1} className="min-w-0 outline-none">{children}</div>
    </div>
  );
}
