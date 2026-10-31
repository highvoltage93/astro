import Link from "next/link";
import { LegalLinks } from "./legal-links";

export type LegalSection = { title: string; paragraphs: string[] };

export function LegalDocument({ title, sections }: { title: string; sections: LegalSection[] }) {
  return <main className="zoria-shell-background min-h-screen px-4 py-6 sm:px-6 sm:py-10">
    <article className="mx-auto max-w-3xl min-w-0 space-y-8 rounded-lg border bg-background/95 p-4 sm:p-8">
      <header className="space-y-4">
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">ZORIA ASTROPROCESSOR</Link>
        <h1 className="break-words text-2xl font-semibold sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">Проєкт для бета-версії · Редакція від 31 жовтня 2026 року</p>
        <p className="border-l-2 border-primary pl-4 text-sm leading-6">Документ ще не фіналізований: реквізити власника сервісу та публічний контакт для звернень не зазначені. Це попередній опис правил і роботи з даними, а не підтвердження юридичної готовності сервісу. Статус бета-версії не обмежує ваших законних прав.</p>
      </header>
      <nav aria-label="Зміст документа"><ol className="list-decimal space-y-2 pl-5 text-sm">{sections.map((section, index) => <li key={section.title}><a className="inline-block py-1 text-primary underline underline-offset-4" href={`#section-${index + 1}`}>{section.title}</a></li>)}</ol></nav>
      {sections.map((section, index) => <section key={section.title} id={`section-${index + 1}`} className="scroll-mt-6 space-y-3">
        <h2 className="text-lg font-semibold">{index + 1}. {section.title}</h2>
        {section.paragraphs.map((paragraph) => <p key={paragraph} className="break-words text-base leading-7 text-muted-foreground">{paragraph}</p>)}
      </section>)}
      <footer className="border-t pt-4"><LegalLinks /><Link href="/login" className="mt-3 inline-flex min-h-11 items-center text-primary underline underline-offset-4">До входу та реєстрації</Link></footer>
    </article>
  </main>;
}
