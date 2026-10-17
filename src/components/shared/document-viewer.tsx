"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, FileWarning, Loader2, X } from "lucide-react";

import { getFileUrl, type FileBucket } from "@/lib/data/repository";
import { cn } from "@/lib/utils";

type Bucket = FileBucket;

/** Files beyond this many pages are cut short so a huge PDF can't stall the tab. */
const MAX_PAGES = 60;

const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;
const TEXT = /\.(txt|csv|md|json)$/i;
const PDF = /\.pdf$/i;

type Loaded =
  | { kind: "pdf"; data: ArrayBuffer; url: string }
  | { kind: "image"; url: string }
  | { kind: "text"; text: string; url: string }
  | { kind: "other"; url: string };

/** Fetches a private storage file through a short-lived signed link. */
function useDocument(bucket: Bucket, path: string, name: string) {
  const [state, setState] = useState<{ doc: Loaded | null; error: string | null }>({ doc: null, error: null });

  useEffect(() => {
    let live = true;
    let objectUrl: string | null = null;
    (async () => {
      const signed = await getFileUrl(bucket, path);
      if (!PDF.test(name) && !IMAGE.test(name) && !TEXT.test(name)) {
        return { kind: "other", url: signed } as Loaded;
      }
      const response = await fetch(signed);
      if (!response.ok) throw new Error(`Could not fetch the file (${response.status}).`);
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      if (PDF.test(name)) return { kind: "pdf", data: await blob.arrayBuffer(), url: objectUrl } as Loaded;
      if (IMAGE.test(name)) return { kind: "image", url: objectUrl } as Loaded;
      return { kind: "text", text: await blob.text(), url: objectUrl } as Loaded;
    })().then(
      (doc) => live && setState({ doc, error: null }),
      (e: unknown) => live && setState({ doc: null, error: e instanceof Error ? e.message : "Could not open the file." }),
    );
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bucket, path, name]);

  return state;
}

/** Draws every page of a PDF onto canvases sized to the container. */
function PdfPages({ data, onError }: { data: ArrayBuffer; onError: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<{ shown: number; total: number } | null>(null);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      // pdf.js takes ownership of the buffer it is given, so pass a copy.
      const loading = pdfjs.getDocument({ data: data.slice(0) });
      task = loading;
      const pdf = await loading.promise;
      const total = pdf.numPages;
      const shown = Math.min(total, MAX_PAGES);
      // Measure the scrolling wrapper: this element is empty until pages land.
      const available = container.parentElement?.clientWidth ?? 640;
      const width = Math.max(240, Math.min(available - 32, 900));
      const ratio = window.devicePixelRatio || 1;

      for (let n = 1; n <= shown && !cancelled; n++) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.className = "mx-auto mb-4 block rounded-md bg-white shadow-[0_10px_30px_-18px_rgba(13,31,63,0.6)]";
        canvas.setAttribute("aria-label", `Page ${n} of ${total}`);
        container.appendChild(canvas);
        const context = canvas.getContext("2d");
        if (!context) continue;
        await page.render({
          canvasContext: context,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        }).promise;
      }
      if (!cancelled) setPages({ shown, total });
    })().catch(() => {
      if (!cancelled) onError();
    });

    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [data, onError]);

  return (
    <div>
      {pages ? null : <Status icon={<Loader2 className="size-5 animate-spin" />} text="Opening document…" />}
      {/* pdf.js draws into this; React leaves its children alone */}
      <div ref={host} className="py-4" />
      {pages && pages.shown < pages.total ? (
        <p className="pb-4 text-center text-[12.5px] text-stone-500">
          Showing the first {pages.shown} of {pages.total} pages — download the file to read the rest.
        </p>
      ) : null}
    </div>
  );
}

function Status({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-[13.5px] text-stone-600">
      <span className="text-stone-400">{icon}</span>
      <p className="max-w-sm">{text}</p>
      {children}
    </div>
  );
}

function DownloadLink({ url, name, className }: { url: string; name: string; className?: string }) {
  return (
    <a
      href={url}
      download={name}
      target="_blank"
      rel="noopener"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-[13px] font-medium text-ink-800 transition-colors hover:border-azure-100 hover:text-azure-600",
        className,
      )}
    >
      <Download className="size-3.5" />
      Download
    </a>
  );
}

/**
 * The document itself, drawn in place: PDFs page by page, images and text
 * files directly, anything else with a download button. Fills its container
 * and scrolls inside it.
 */
export function DocumentPreview({
  bucket,
  path,
  name,
  className,
}: {
  bucket: Bucket;
  path: string;
  name: string;
  className?: string;
}) {
  const { doc, error } = useDocument(bucket, path, name);
  const [broken, setBroken] = useState(false);
  const markBroken = useCallback(() => setBroken(true), []);

  let body: React.ReactNode;
  if (error) {
    body = <Status icon={<FileWarning className="size-6" />} text={error} />;
  } else if (!doc) {
    body = <Status icon={<Loader2 className="size-5 animate-spin" />} text="Opening document…" />;
  } else if (broken) {
    body = (
      <Status
        icon={<FileWarning className="size-6" />}
        text="This file couldn't be displayed — it may be damaged or not a real PDF. Try downloading it instead."
      >
        <DownloadLink url={doc.url} name={name} />
      </Status>
    );
  } else if (doc.kind === "pdf") {
    body = <PdfPages data={doc.data} onError={markBroken} />;
  } else if (doc.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- private file shown from a local object URL
    body = <img src={doc.url} alt={name} className="mx-auto my-4 max-w-[calc(100%-2rem)] rounded-md bg-white shadow-sm" />;
  } else if (doc.kind === "text") {
    body = (
      <pre className="m-4 rounded-md bg-white p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-800 shadow-sm">
        {doc.text}
      </pre>
    );
  } else {
    const ext = name.split(".").pop()?.toUpperCase() ?? "This";
    body = (
      <Status icon={<FileText className="size-6" />} text={`${ext} files can't be previewed in the browser. Download it to open it.`}>
        <DownloadLink url={doc.url} name={name} />
      </Status>
    );
  }

  return <div className={cn("overflow-auto bg-ivory-200/70", className)}>{body}</div>;
}

/** Full-screen pop-up holding a document preview, with download and close. */
export function DocumentViewer({
  bucket,
  path,
  name,
  onClose,
}: {
  bucket: Bucket;
  path: string;
  name: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let live = true;
    getFileUrl(bucket, path).then((u) => live && setDownloadUrl(u), () => {});
    return () => {
      live = false;
    };
  }, [bucket, path]);

  // Portalled to <body>: a frosted (backdrop-filter) ancestor would otherwise
  // become the containing block and trap the fixed overlay inside a card.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/55 p-2 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_40px_100px_-30px_rgba(13,31,63,0.7)]"
      >
        <div className="flex items-center gap-3 border-b border-sand-200 px-4 py-3">
          <FileText className="size-4 shrink-0 text-azure-600" />
          <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-900" title={name}>
            {name}
          </p>
          {downloadUrl ? <DownloadLink url={downloadUrl} name={name} /> : null}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ivory-200 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <DocumentPreview bucket={bucket} path={path} name={name} className="flex-1" />
      </div>
    </div>,
    document.body,
  );
}
