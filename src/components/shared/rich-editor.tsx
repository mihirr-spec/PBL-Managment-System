"use client";

import { useRef, useState, type ClipboardEvent } from "react";
import { Bold, Eye, Highlighter, Link2, List, ListOrdered, PencilLine, Table, type LucideIcon } from "lucide-react";

import { RichText } from "@/components/shared/rich-text";
import { Textarea } from "@/components/ui/field";
import { htmlToMarks } from "@/lib/paste-html";
import { cn } from "@/lib/utils";

/** Formatting buttons above the box; `inline` ones wrap the selection in place. */
const TOOLS: Array<{ label: string; icon: LucideIcon; inline?: boolean; apply: (selected: string) => string }> = [
  { label: "Bold", icon: Bold, inline: true, apply: (s) => `**${s || "bold text"}**` },
  { label: "Green highlight", icon: Highlighter, inline: true, apply: (s) => `==${s || "highlighted text"}==` },
  { label: "Bulleted list", icon: List, apply: (s) => (s || "First point").split("\n").map((l) => `- ${l}`).join("\n") },
  {
    label: "Numbered list",
    icon: ListOrdered,
    apply: (s) => (s || "First step").split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n"),
  },
  { label: "Link", icon: Link2, inline: true, apply: (s) => `[${s || "link text"}](https://)` },
  {
    label: "Table",
    icon: Table,
    apply: () => "| Heading | Heading |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |",
  },
];

/**
 * A text box that keeps formatting. Pasting from Word, Outlook, Gmail or a web
 * page keeps bold text, highlights, lists, links and tables; the buttons add
 * them by hand; Preview shows the result as everyone else will see it
 * (rendered by `RichText`).
 */
export function RichEditor({
  id,
  value,
  onChange,
  rows = 6,
  placeholder,
  maxLength,
  disabled = false,
  hint = "Paste from Word, Outlook or a web page to keep bold text and lists, or use the buttons.",
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  /** Shown under the box; pass "" to hide. */
  hint?: string;
  className?: string;
}) {
  const [preview, setPreview] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  /** Put `insert` in place of the selection and move the caret after it. */
  function replaceSelection(insert: string) {
    const el = box.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(maxLength ? next.slice(0, maxLength) : next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    });
  }

  /** Replace the selection with the tool's formatting, on its own lines for blocks. */
  function format(tool: (typeof TOOLS)[number]) {
    const el = box.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    let insert = tool.apply(value.slice(start, end));
    if (!tool.inline) {
      if (start > 0 && value[start - 1] !== "\n") insert = `\n${insert}`;
      if (end < value.length && value[end] !== "\n") insert = `${insert}\n`;
    }
    replaceSelection(insert);
  }

  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData("text/html");
    const marks = html ? htmlToMarks(html) : "";
    if (!marks) return;
    event.preventDefault();
    replaceSelection(marks);
  }

  return (
    <div className={className}>
      <div
        className={cn(
          "overflow-hidden rounded-[14px] border border-sand-200 bg-white focus-within:border-azure-500",
          disabled && "opacity-70",
        )}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-sand-100 bg-slate-50/70 px-2 py-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              disabled={preview || disabled}
              onClick={() => format(t)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-ink-900 disabled:opacity-40"
            >
              <t.icon className="size-4" />
            </button>
          ))}
          <div className="ml-auto flex rounded-lg bg-white p-0.5 ring-1 ring-sand-200">
            {[
              { on: false, label: "Write", icon: PencilLine },
              { on: true, label: "Preview", icon: Eye },
            ].map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => setPreview(m.on)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium",
                  preview === m.on ? "bg-azure-50 text-azure-600" : "text-slate-500 hover:text-ink-900",
                )}
              >
                <m.icon className="size-3.5" />
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {preview ? (
          <div className="px-4 py-3.5" style={{ minHeight: `${rows * 1.6 + 1.5}rem` }}>
            {value.trim() ? <RichText text={value} /> : <p className="text-[13.5px] text-slate-400">Nothing to preview yet.</p>}
          </div>
        ) : (
          <Textarea
            id={id}
            ref={box}
            rows={rows}
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onPaste={paste}
            placeholder={placeholder}
            className="rounded-none border-0 bg-transparent text-[13.5px] leading-relaxed shadow-none focus:ring-0"
          />
        )}
      </div>
      {hint || maxLength ? (
        <p className="mt-1.5 flex justify-between gap-3 text-[12px] text-slate-500">
          <span>{hint}</span>
          {maxLength ? <span className="tnum shrink-0">{value.length}/{maxLength}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
