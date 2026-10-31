"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Camera outline with a small plus, drawn to match the lucide icon set. */
function CameraPlus({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M13.5 5H9.5L7.5 7.5H4.5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-6" />
      <circle cx="12" cy="13.5" r="3.5" />
      <path d="M19 2v6M16 5h6" />
    </svg>
  );
}

/**
 * A profile photo you can change by clicking it. On hover, after a short
 * pause, the photo darkens with a camera icon and "Edit" appears below it.
 * Checks the file (image, under 2 MB) before handing it to `onPick`.
 */
export function AvatarEditor({
  name,
  src,
  size = "2xl",
  onPick,
  onRemove,
  className,
}: {
  name: string;
  src?: string;
  size?: "lg" | "xl" | "2xl";
  onPick: (file: File) => Promise<void>;
  /** Shown as a small "Remove photo" link when given. */
  onRemove?: () => Promise<void>;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  function picked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > 2_000_000) return setError("Image must be under 2 MB.");
    void run(() => onPick(file), "That photo could not be uploaded. Try a PNG, JPG or WebP under 2 MB.");
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Change profile photo"
        title="Change profile photo"
        className="group relative flex flex-col items-center rounded-full focus-visible:outline-none"
      >
        <span className="relative rounded-full ring-4 ring-white/90 shadow-[0_16px_36px_-18px_rgba(13,31,63,0.6)] group-focus-visible:ring-azure-100">
          <Avatar name={name} src={src} size={size} />
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white transition-opacity duration-200",
              busy ? "opacity-100" : "opacity-0 delay-150 group-hover:opacity-100 group-focus-visible:opacity-100",
            )}
          >
            {busy ? (
              <span className="size-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <CameraPlus className={size === "2xl" ? "size-9" : "size-6"} />
            )}
          </span>
        </span>
        <span
          className={cn(
            "mt-1.5 text-[12.5px] font-semibold text-black transition-opacity duration-200",
            busy ? "opacity-0" : "opacity-0 delay-150 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          Edit
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" onChange={picked} className="hidden" />

      {error ? (
        <p role="alert" className="mt-1 max-w-56 text-center text-[12px] text-clay-500">
          {error}
        </p>
      ) : null}
      {onRemove && src && !busy ? (
        <button
          type="button"
          onClick={() => void run(onRemove, "Could not remove the photo.")}
          className="mt-0.5 text-[11.5px] text-stone-400 hover:text-clay-500"
        >
          Remove photo
        </button>
      ) : null}
    </div>
  );
}
