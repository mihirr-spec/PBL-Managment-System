"use client";

import { useState, type DragEvent } from "react";
import { FileText, Paperclip, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Does the file fit an `accept` list such as ".pdf,image/png,image/*"? */
function accepts(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(",").some((rule) => {
    const r = rule.trim().toLowerCase();
    if (r.startsWith(".")) return name.endsWith(r);
    if (r.endsWith("/*")) return file.type.startsWith(r.slice(0, -1));
    return file.type === r;
  });
}

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Dashed drop zone for attaching files: click to choose, or drag files onto
 * it. Selected files are listed underneath, each with a remove button.
 */
export function FileDrop({
  id,
  files,
  onChange,
  accept,
  multiple = false,
  specs,
  disabled = false,
}: {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  /** What is allowed, e.g. "PDF, PNG or JPG · up to 25 MB". */
  specs: string;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  function add(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    const ok = picked.filter((f) => accepts(f, accept));
    setRejected(ok.length < picked.length ? `${picked.length - ok.length} file(s) skipped: that type isn't accepted here.` : null);
    if (ok.length === 0) return;
    onChange(multiple ? [...files, ...ok] : ok.slice(0, 1));
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) add(event.dataTransfer.files);
  }

  return (
    <div>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          add(e.target.files);
          // Clear it so choosing the same file again still counts as a change.
          e.target.value = "";
        }}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-4 py-5 text-center transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-gold-200",
          dragging
            ? "border-azure-500 bg-azure-50"
            : "border-sage-500/45 bg-sage-100/40 hover:border-sage-500/70 hover:bg-sage-100/70",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <Paperclip className="size-6 text-ink-800" strokeWidth={1.6} aria-hidden />
        <span className="text-[14px] font-medium text-ink-900">
          {dragging ? "Drop to attach" : `Choose ${multiple ? "files" : "a file"} or drag ${multiple ? "them" : "it"} here`}
        </span>
        <span className="text-[12px] text-stone-500">{specs}</span>
      </label>

      {rejected ? <p className="mt-1.5 text-[12px] text-clay-500">{rejected}</p> : null}

      {files.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-1.5 text-[13px] text-ink-800 ring-1 ring-sand-200"
            >
              <FileText className="size-4 shrink-0 text-azure-600" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="tnum shrink-0 text-[12px] text-stone-400">{size(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 rounded p-0.5 text-stone-400 hover:text-clay-500"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
