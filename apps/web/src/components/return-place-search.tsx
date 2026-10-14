"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchPlaces } from "@/lib/api";
import type { PlaceSearchResult } from "@/lib/chart-types";

export function ReturnPlaceSearch({ name, onSelect, onPendingChange }: {
  name: string;
  onSelect: (place: PlaceSearchResult) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [query, setQuery] = useState(name);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const container = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(name);
    setOpen(false);
    onPendingChange(false);
  }, [name, onPendingChange]);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setLoading(false); return; }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    const timeout = window.setTimeout(() => {
      void searchPlaces(query, controller.signal).then(({ results: places }) => {
        if (controller.signal.aborted) return;
        setResults(places);
        setLoading(false);
      }).catch(() => {
        if (controller.signal.aborted) return;
        setError("Не вдалося знайти місто. Спробуй ще раз.");
        setLoading(false);
      });
    }, 350);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query, open]);

  const close = () => { request.current?.abort(); setOpen(false); };
  return (
    <div ref={container} className="relative min-w-0" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
    }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); container.current?.querySelector("input")?.focus(); }
    }}>
      <Input aria-label="Місто соляра" autoComplete="off" placeholder="Місто соляра" value={query}
        onFocus={() => { if (query !== name) { setError(null); setOpen(true); } }}
        onChange={(event) => {
          request.current?.abort();
          setQuery(event.target.value); setOpen(true); setResults([]); setError(null);
          onPendingChange(event.target.value !== name);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && open) {
            event.preventDefault(); container.current?.querySelector("button")?.focus();
          }
          if (event.key === "Enter") { event.preventDefault(); setError(null); setOpen(true); }
        }} />
      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const options = Array.from(event.currentTarget.querySelectorAll("button"));
            const index = options.indexOf(document.activeElement as HTMLButtonElement);
            const next = index + (event.key === "ArrowDown" ? 1 : -1);
            if (next < 0) container.current?.querySelector("input")?.focus();
            else options[Math.min(next, options.length - 1)]?.focus();
          }}>
          {loading ? <p role="status" className="p-3 text-sm text-muted-foreground">Шукаю міста...</p> : error ? (
            <p role="alert" className="p-3 text-sm text-destructive">{error}</p>
          ) : results.length ? results.map((place) => (
            <button key={`${place.provider}-${place.providerId}`} type="button"
              className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => { close(); setQuery(place.displayName); onPendingChange(false); onSelect(place); }}>
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{place.displayName}</span>
            </button>
          )) : <p role="status" className="p-3 text-sm text-muted-foreground">Місто не знайдено.</p>}
        </div>
      ) : null}
    </div>
  );
}
