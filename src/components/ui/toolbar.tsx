"use client";

import { ChevronDown, Filter, Search, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Pill tabs above a list: the chosen one is filled azure, the rest sit on white. */
export function PillTabs<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: ReadonlyArray<{ key: K; label: string; count?: number; icon?: LucideIcon }>;
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-medium ring-1 transition-colors",
              active
                ? "bg-azure-600 text-white shadow-[0_12px_26px_-14px_rgba(21,80,200,0.9)] ring-azure-600"
                : "bg-white/75 text-ink-800 ring-white hover:bg-white",
            )}
          >
            {t.icon ? <t.icon className={cn("size-[18px]", active ? "text-white" : "text-ink-700")} strokeWidth={1.8} /> : null}
            {t.label}
            {t.count != null ? ` (${t.count})` : ""}
          </button>
        );
      })}
    </div>
  );
}

/** Search box for a list. */
export function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-500" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl bg-white/90 pr-3 pl-10 text-[14px] text-ink-900 ring-1 ring-azure-100 placeholder:text-slate-400 focus:ring-2 focus:ring-azure-500 focus:outline-none"
      />
    </label>
  );
}

/** "Filter" menu for a list, as a native select dressed as a button. */
export function FilterMenu<V extends string>({
  value,
  onChange,
  options,
  label = "Filter",
}: {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<{ value: V; label: string }>;
  label?: string;
}) {
  const chosen = options.find((o) => o.value === value);
  const filtered = options[0] && value !== options[0].value;
  return (
    <label className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white/90 pr-9 pl-3.5 text-[14px] font-medium text-azure-600 ring-1 ring-azure-100 focus-within:ring-2 focus-within:ring-azure-500">
      <Filter className="size-[18px]" aria-hidden />
      <span className="max-w-[11rem] truncate">{filtered ? chosen?.label : label}</span>
      <ChevronDown className="pointer-events-none absolute right-3 size-4" aria-hidden />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
