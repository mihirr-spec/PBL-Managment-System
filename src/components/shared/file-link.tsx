"use client";

import { useCallback, useState } from "react";
import { FileText, Paperclip } from "lucide-react";

import { DocumentViewer } from "@/components/shared/document-viewer";
import type { FileBucket } from "@/lib/data/repository";
import { cn } from "@/lib/utils";

/**
 * A private storage file; clicking opens it in the in-portal viewer. The
 * "icon" variant is just a document icon (the name shows on hover), for rows
 * that already print the file name.
 */
export function FileLink({
  bucket,
  path,
  name,
  variant = "pill",
  className,
}: {
  bucket: FileBucket;
  path: string;
  name: string;
  variant?: "pill" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={`Open ${name}`}
          aria-label={`Open ${name}`}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-clay-100 text-clay-500 ring-1 ring-clay-500/15 transition-colors hover:bg-clay-500 hover:text-white focus-visible:ring-2 focus-visible:ring-azure-500 focus-visible:outline-none",
            className,
          )}
        >
          <FileText className="size-4" />
        </button>
        {open ? <DocumentViewer bucket={bucket} path={path} name={name} onClose={close} /> : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex max-w-full items-center gap-2 rounded-lg border border-white/80 bg-white/75 px-3 py-1.5 text-[12.5px] text-ink-800 transition-colors hover:border-azure-100 hover:bg-azure-50",
          className,
        )}
      >
        <Paperclip className="size-3.5 shrink-0 text-azure-600" />
        <span className="truncate font-medium">{name}</span>
      </button>
      {open ? <DocumentViewer bucket={bucket} path={path} name={name} onClose={close} /> : null}
    </>
  );
}
