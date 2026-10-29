import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * A small, safe formatter for announcements. Staff write plain text with a few
 * marks and it reads like a well laid out email:
 *
 *   **bold**              [link text](https://...)     bare https:// links
 *   - bullet / * bullet   1. numbered                  ## heading
 *   | a | b |  table rows (first row is the header; a |---| row is optional)
 *
 * Everything is rendered as React elements, never as HTML, so nothing a user
 * types can inject markup.
 */

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,3}\s+/;
const TABLE_ROW = /^\s*\|/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const cells = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (HEADING.test(line)) {
      blocks.push({ kind: "h", text: line.replace(HEADING, "") });
      i++;
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const marker = BULLET.test(line) ? BULLET : NUMBERED;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, ""));
      blocks.push({ kind: marker === BULLET ? "ul" : "ol", items });
    } else if (TABLE_ROW.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        if (!TABLE_RULE.test(lines[i])) rows.push(cells(lines[i]));
        i++;
      }
      blocks.push({ kind: "table", head: rows[0] ?? [], rows: rows.slice(1) });
    } else {
      const para: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        ![HEADING, BULLET, NUMBERED, TABLE_ROW].some((r) => r.test(lines[i]))
      ) {
        para.push(lines[i++]);
      }
      blocks.push({ kind: "p", lines: para });
    }
  }
  return blocks;
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

const linkClass = "font-medium text-azure-600 underline decoration-azure-100 underline-offset-2 hover:decoration-azure-500";

/** Bold, links and bare URLs inside one line. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${m.index}`;
    if (m[1] != null) {
      out.push(<strong key={key} className="font-semibold text-ink-900">{inline(m[1])}</strong>);
    } else {
      const href = m[3] ?? m[4];
      out.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {m[2] ?? m[4]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Formatted announcement text, laid out like a clean email. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-3.5 text-[14.5px] leading-[1.7] text-slate-700", className)}>
      {parse(text).map((b, i) => {
        if (b.kind === "h") {
          return <p key={i} className="pt-1 text-[15px] font-semibold text-ink-900">{inline(b.text)}</p>;
        }
        if (b.kind === "p") {
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 ? <br /> : null}
                  {inline(l)}
                </Fragment>
              ))}
            </p>
          );
        }
        if (b.kind === "ul" || b.kind === "ol") {
          const List = b.kind;
          return (
            <List
              key={i}
              className={cn(
                "space-y-1.5 pl-6",
                b.kind === "ul" ? "list-disc marker:text-azure-500" : "list-decimal marker:font-semibold marker:text-azure-600",
              )}
            >
              {b.items.map((item, j) => <li key={j} className="pl-1">{inline(item)}</li>)}
            </List>
          );
        }
        return (
          <div key={i} className="overflow-x-auto">
            <table className="min-w-[16rem] overflow-hidden rounded-xl text-left text-[13.5px] ring-1 ring-sand-200">
              {b.head.length ? (
                <thead className="bg-azure-50 text-ink-900">
                  <tr>
                    {b.head.map((c, j) => <th key={j} className="border-b border-sand-200 px-3.5 py-2 font-semibold">{inline(c)}</th>)}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j} className="border-t border-sand-100 first:border-t-0 even:bg-slate-50/70">
                    {r.map((c, k) => <td key={k} className="px-3.5 py-2 align-top tabular-nums">{inline(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
