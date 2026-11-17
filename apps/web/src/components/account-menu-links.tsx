import Link from "next/link";
import { CircleUserRound, Crown } from "lucide-react";

export function AccountMenuLinks() {
  return <>{[{ href: "/profile", label: "Мій профіль", icon: CircleUserRound }, { href: "/plans", label: "Плани та переваги", icon: Crown }].map(({ href, label, icon: Icon }) =>
    <Link key={href} href={href} role="menuitem" className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="size-4" />{label}</Link>)}</>;
}
