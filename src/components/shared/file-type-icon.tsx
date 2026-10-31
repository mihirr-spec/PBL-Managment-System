import { cn } from "@/lib/utils";

type Kind = "pdf" | "word" | "powerpoint" | "excel" | "image" | "zip" | "other";

const EXT: Record<string, Kind> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  rtf: "word",
  ppt: "powerpoint",
  pptx: "powerpoint",
  xls: "excel",
  xlsx: "excel",
  csv: "excel",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  zip: "zip",
  rar: "zip",
  "7z": "zip",
};

const LABEL: Record<Kind, string> = {
  pdf: "PDF document",
  word: "Word document",
  powerpoint: "PowerPoint",
  excel: "Excel sheet",
  image: "Image",
  zip: "ZIP archive",
  other: "File",
};

/** The kind of file, from its name's extension. */
export function fileKind(name: string): Kind {
  return EXT[name.split(".").pop()?.toLowerCase() ?? ""] ?? "other";
}

/** "PDF document", "Word document", ... for a file name. */
export function fileTypeLabel(name: string): string {
  const kind = fileKind(name);
  if (kind !== "other") return LABEL[kind];
  const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "";
  return ext ? `${ext} file` : "File";
}

/** Office-style letter tiles; PDF, images and archives get a page with a coloured band. */
const TILE: Partial<Record<Kind, { letter: string; color: string }>> = {
  word: { letter: "W", color: "#185ABD" },
  powerpoint: { letter: "P", color: "#C43E1C" },
  excel: { letter: "X", color: "#107C41" },
};
const BAND: Partial<Record<Kind, { text: string; color: string }>> = {
  pdf: { text: "PDF", color: "#D93025" },
  image: { text: "IMG", color: "#0E7C86" },
  zip: { text: "ZIP", color: "#B7791F" },
  other: { text: "FILE", color: "#6B7280" },
};

/** A small file icon that shows the file type at a glance, like a mail client's attachments. */
export function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const kind = fileKind(name);
  const tile = TILE[kind];
  const band = BAND[kind];

  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      {/* The page, with a folded corner */}
      <path d="M8 2.5h11.5L26 9v20a1.5 1.5 0 0 1-1.5 1.5h-16A1.5 1.5 0 0 1 7 29V4a1.5 1.5 0 0 1 1-1.5z" fill="#fff" stroke="#C9D1DC" />
      <path d="M19.5 2.5V8a1 1 0 0 0 1 1H26" fill="#EEF2F7" stroke="#C9D1DC" />
      {tile ? (
        <>
          <path d="M12 14h10M12 17.5h10M12 21h10M12 24.5h7" stroke="#C9D1DC" strokeWidth="1.2" />
          <rect x="2.5" y="12" width="13" height="13" rx="2" fill={tile.color} />
          <text x="9" y="21.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">
            {tile.letter}
          </text>
        </>
      ) : band ? (
        <>
          <path d="M11 13h11M11 16.5h11" stroke="#C9D1DC" strokeWidth="1.2" />
          <rect x="4.5" y="19.5" width="19" height="8" rx="1.5" fill={band.color} />
          <text x="14" y="25.6" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">
            {band.text}
          </text>
        </>
      ) : null}
    </svg>
  );
}
