import { cn } from "@/lib/utils";

export function BetaBadge({ className }: { className?: string }) {
  return <span title="Бета-версія" className={cn(
    "inline-flex h-[18px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-primary/35 bg-gradient-to-br from-primary/20 to-primary/5 px-1.5 align-middle text-[10px] font-semibold leading-none tracking-normal text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]",
    className
  )}>Beta</span>;
}
