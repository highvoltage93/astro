import Link from "next/link";

export function LegalLinks() {
  return <nav aria-label="Правова інформація" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
    <Link className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-primary" href="/terms">Умови використання</Link>
    <Link className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-primary" href="/privacy">Політика конфіденційності</Link>
  </nav>;
}
