"use client";

import { useCallback, useState } from "react";
import { Paperclip } from "lucide-react";

import { DocumentViewer } from "@/components/shared/document-viewer";
import type { FileBucket } from "@/lib/data/repository";
import { cn } from "@/lib/utils";

/** A private storage file; clicking opens it in the in-portal viewer. */
export function FileLink({
  bucket,
  path,
  name,
  className,
}: {
  bucket: FileBucket;
  path: string;
  name: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

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
