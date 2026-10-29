import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * A small, safe formatter for announcements. Staff write plain text with a few
 * marks and it reads like a well laid out email:
 *
 *   **bold**              ==green highlight==          [link text](https://...)
 *   - bullet / * bullet   1. numbered                  ## heading
 *   | a | b |  table rows (first row is the header; a |---| row is optional)
 *
 * Dates and times are picked out in green on their own. A short line ending in
 * ":" is a heading, and plain lines right under it become bullets.
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

const BULLET = /^\s*[-*•·▪]\s+/;
const COLON_HEADING = /^[^|]{2,80}:\s*$/;
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
      if (COLON_HEADING.test(para[0]) && !para[0].includes("**")) {
        // "Guidelines for the evaluation:" heads the lines under it.
        blocks.push({ kind: "h", text: para[0].trim() });
        if (para.length > 1) blocks.push({ kind: "ul", items: para.slice(1) });
      } else {
        blocks.push({ kind: "p", lines: para });
      }
    }
  }
  // A heading on its own, then a run of plain lines: those lines are its bullets.
  return blocks.flatMap((b, i) => {
    const prev = blocks[i - 1];
    if (b.kind === "p" && b.lines.length > 1 && prev?.kind === "h" && COLON_HEADING.test(prev.text)) {
      return [{ kind: "ul" as const, items: b.lines }];
    }
    return [b];
  });
}

const INLINE =
  /\*\*(.+?)\*\*|==(.+?)==|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const DAY = "(?:(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\\s+)?";
const TIME = "\\d{1,2}(?::\\d{2})?\\s?(?:AM|PM|am|pm|a\\.m\\.|p\\.m\\.)";
/** Dates like 2/11/2026, Friday, 30 October 2026, 3 Nov, October 8, 2026, and times like 10:00 AM to 11:00 AM. */
const WHEN = new RegExp(
  [
    `\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b`,
    `\\b${DAY}\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\b(?:,?\\s+\\d{4})?`,
    `\\b${DAY}${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b(?:,?\\s+\\d{4})?`,
    `\\b${TIME}(?:\\s?(?:to|-|–)\\s?${TIME})?`,
  ].join("|"),
  "g",
);

const highlightClass = "font-semibold text-emerald-600 [&_strong]:text-emerald-600";

/** Plain text with its dates and times in green. */
function withDates(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(WHEN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<span key={`${keyPrefix}d${m.index}`} className={highlightClass}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const linkClass = "font-medium text-azure-600 underline decoration-azure-100 underline-offset-2 hover:decoration-azure-500";

/** Bold, green highlights, links, bare URLs and dates inside one line. */
function inline(text: string, keyPrefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const key = `${keyPrefix}${m.index}`;
    if (m.index > last) out.push(...withDates(text.slice(last, m.index), `${key}t`));
    if (m[1] != null) {
      out.push(<strong key={key} className="font-semibold text-ink-900">{inline(m[1], `${key}b`)}</strong>);
    } else if (m[2] != null) {
      out.push(<span key={key} className={highlightClass}>{inline(m[2], `${key}g`)}</span>);
    } else {
      const href = m[4] ?? m[5];
      out.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {m[3] ?? m[5]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...withDates(text.slice(last), `${keyPrefix}e`));
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
