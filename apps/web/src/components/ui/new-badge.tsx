import { cn } from "@/lib/utils";

export function NewBadge({ className }: { className?: string }) {
  return <span title="Нова можливість" className={cn("inline-flex h-5 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-amber-200 bg-amber-300 px-2 text-[10px] font-bold leading-none tracking-normal text-stone-950 shadow-sm", className)}>New</span>;
}
