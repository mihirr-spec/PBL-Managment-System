"use client";

import { useCallback, useState } from "react";
import { Download } from "lucide-react";

import { DocumentViewer } from "@/components/shared/document-viewer";
import { FileTypeIcon, fileTypeLabel } from "@/components/shared/file-type-icon";
import { getDownloadUrl, type FileBucket } from "@/lib/data/repository";
import { cn } from "@/lib/utils";

/**
 * A private storage file; clicking opens it in the in-portal viewer.
 * - "chip" (default): a bordered attachment box with the file-type icon, the
 *   full name and a second line (type, plus `meta` such as when it was sent).
 * - "pill": a compact one-line link.
 * - "icon": just the file-type icon, for rows that already print the name.
 */
export function FileLink({
  bucket,
  path,
  name,
  meta,
  variant = "chip",
  className,
}: {
  bucket: FileBucket;
  path: string;
  name: string;
  /** Extra detail on the chip's second line, after the file type. */
  meta?: string;
  variant?: "chip" | "pill" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const viewer = open ? <DocumentViewer bucket={bucket} path={path} name={name} onClose={close} /> : null;

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={`Open ${name}`}
          aria-label={`Open ${name}`}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-azure-50 focus-visible:ring-2 focus-visible:ring-azure-500 focus-visible:outline-none",
            className,
          )}
        >
          <FileTypeIcon name={name} />
        </button>
        {viewer}
      </>
    );
  }

  if (variant === "pill") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={`Open ${name}`}
          className={cn(
            "inline-flex max-w-full items-center gap-2 rounded-lg border border-white/80 bg-white/75 px-2.5 py-1 text-[12.5px] text-ink-800 transition-colors hover:border-azure-100 hover:bg-azure-50",
            className,
          )}
        >
          <FileTypeIcon name={name} className="size-5" />
          <span className="truncate font-medium">{name}</span>
        </button>
        {viewer}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Open ${name}`}
        className={cn(
          "flex w-full max-w-sm items-center gap-3 rounded-lg border border-sand-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-azure-100 hover:bg-azure-50/60 focus-visible:ring-2 focus-visible:ring-azure-500 focus-visible:outline-none",
          className,
        )}
      >
        <FileTypeIcon name={name} />
        <span className="min-w-0">
          <span className="block text-[13px] font-medium break-words text-ink-900">{name}</span>
          <span className="block text-[11.5px] text-stone-500">
            {fileTypeLabel(name)}
            {meta ? ` · ${meta}` : ""}
          </span>
        </span>
      </button>
      {viewer}
    </>
  );
}

/** A wrapping row of attachment chips. */
export function FileChips({
  bucket,
  files,
  meta,
  className,
}: {
  bucket: FileBucket;
  files: Array<{ path: string; name: string }>;
  meta?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {files.map((f) => (
        <FileLink key={f.path} bucket={bucket} path={f.path} name={f.name} meta={meta} />
      ))}
    </div>
  );
}

/**
 * A full-width file row: click the name to open it in the viewer, or the
 * download button on the right to save it.
 */
export function FileRow({
  bucket,
  path,
  name,
  meta,
  className,
}: {
  bucket: FileBucket;
  path: string;
  name: string;
  meta?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  async function download() {
    setSaving(true);
    try {
      window.location.assign(await getDownloadUrl(bucket, path, name));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-sand-200 bg-white px-4 py-3", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Open ${name}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <FileTypeIcon name={name} className="size-9" />
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold break-words text-ink-900 hover:text-azure-600">{name}</span>
          <span className="block text-[12px] text-stone-500">
            {fileTypeLabel(name)}
            {meta ? ` · ${meta}` : ""}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => void download()}
        disabled={saving}
        aria-label={`Download ${name}`}
        title="Download"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-azure-50 text-azure-600 transition-colors hover:bg-azure-100 disabled:opacity-60"
      >
        <Download className="size-4" />
      </button>
      {open ? <DocumentViewer bucket={bucket} path={path} name={name} onClose={close} /> : null}
    </div>
  );
}
