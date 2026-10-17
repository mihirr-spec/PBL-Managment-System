"use client";

import { ChevronDown, Lock } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

const control =
  "w-full rounded-lg border border-sand-200 bg-white/75 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors hover:border-sand-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200 disabled:cursor-not-allowed disabled:bg-ivory-100 disabled:text-stone-500";

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-stone-500 uppercase"
    >
      {children}
      {hint}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(control, "resize-y", className)} {...props} />
  );
}

/** Native select with its own arrow (the browser's is hidden for consistent styling). */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "cursor-pointer appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-500"
        aria-hidden
      />
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  help,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  help?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] text-clay-500">{error}</p>
      ) : help ? (
        <p className="mt-1.5 text-[12px] text-stone-400">{help}</p>
      ) : null}
    </div>
  );
}

/**
 * Read-only presentation of a value. Used for university-controlled academic
 * data, which students can see but never edit.
 */
export function ReadOnlyField({
  label,
  value,
  locked = false,
  className,
}: {
  label: string;
  value: ReactNode;
  locked?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label
        hint={
          locked ? (
            <Lock className="size-3 text-stone-400" aria-label="Read only" />
          ) : null
        }
      >
        {label}
      </Label>
      <p className="text-sm text-stone-800">{value || "-"}</p>
    </div>
  );
}
