"use client";

import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Bold, Eye, Highlighter, Link2, List, ListOrdered, Megaphone, PencilLine, Send, Table, type LucideIcon } from "lucide-react";

import { FileLink } from "@/components/shared/file-link";
import { RichText } from "@/components/shared/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { postAnnouncement } from "@/lib/data/repository";
import { htmlToMarks } from "@/lib/paste-html";
import type { Announcement, User } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/** Announcements, newest first, each laid out like a clean email. */
export function AnnouncementFeed({ items }: { items: Announcement[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Megaphone className="size-5" />}
          title="No announcements yet"
          description="Notices and files from your supervisor and the administrator appear here."
        />
      </Card>
    );
  }
  return (
    <ul className="space-y-4">
      {items.map((a) => (
        <li
          key={a.id}
          className="overflow-hidden rounded-[20px] border border-sand-200 bg-white shadow-[0_18px_44px_-34px_rgba(21,80,200,0.45)]"
        >
          <div className="flex items-center gap-3 border-b border-sand-100 bg-slate-50/60 px-5 py-3 sm:px-7">
            <Avatar name={a.postedByName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-ink-900">{a.postedByName}</p>
              <p className="text-[12px] text-slate-500">
                To {a.scope === "all" ? "all students" : "the supervisor's groups"}
              </p>
            </div>
            <p className="shrink-0 text-[12px] text-slate-500" title={formatDateTime(a.createdAt)}>
              {timeAgo(a.createdAt)}
            </p>
          </div>
          <div className="px-5 py-5 sm:px-7 sm:py-6">
            <h3 className="font-display text-[1.3rem] leading-snug tracking-tight text-ink-900">{a.title}</h3>
            {a.body ? <RichText text={a.body} className="mt-3" /> : null}
            {a.attachmentPath && a.attachmentName ? (
              <FileLink bucket="announcements" path={a.attachmentPath} name={a.attachmentName} className="mt-5" />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Formatting buttons above the message box; `inline` ones wrap the selection in place. */
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

/** Posting form for supervisors (to their groups) and the administrator (to every student). */
export function AnnouncementComposer({ user, onPosted }: { user: User; onPosted: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /** Put `insert` in place of the selection and move the caret after it. */
  function replaceSelection(insert: string) {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    setBody(body.slice(0, start) + insert + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    });
  }

  /** Replace the selection with the tool's formatting, on its own lines for blocks. */
  function format(tool: (typeof TOOLS)[number]) {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    let insert = tool.apply(body.slice(start, end));
    if (!tool.inline) {
      if (start > 0 && body[start - 1] !== "\n") insert = `\n${insert}`;
      if (end < body.length && body[end] !== "\n") insert = `${insert}\n`;
    }
    replaceSelection(insert);
  }

  /** Pasting from Outlook, Gmail or Word keeps bold, green text, lists, links and tables. */
  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData("text/html");
    const marks = html ? htmlToMarks(html) : "";
    if (!marks) return;
    event.preventDefault();
    replaceSelection(marks);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("Give the announcement a title.");
    setBusy(true);
    setError(null);
    try {
      await postAnnouncement({ user, title: title.trim(), body: body.trim(), file: file ?? undefined });
      setTitle("");
      setBody("");
      setPreview(false);
      setFile(null);
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  }

  const audience = user.role === "admin" ? "every student" : "all students in your groups";

  return (
    <Card>
      <CardHeader title="Post an announcement" description={`Goes to ${audience}, who are notified straight away.`} />
      <form onSubmit={submit}>
        <CardBody className="space-y-4">
          <Field label="Title" htmlFor="ann-title">
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="e.g. PBL-III Mid-Term Evaluation"
            />
          </Field>
          <div>
            <label htmlFor="ann-body" className="mb-1.5 block text-[13px] font-medium text-ink-800">Message</label>
            <div className="overflow-hidden rounded-[14px] border border-sand-200 bg-white focus-within:border-azure-500">
              <div className="flex flex-wrap items-center gap-1 border-b border-sand-100 bg-slate-50/70 px-2 py-1.5">
                {TOOLS.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    title={t.label}
                    aria-label={t.label}
                    disabled={preview}
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
                <div className="min-h-[12rem] px-4 py-3.5">
                  {body.trim() ? (
                    <RichText text={body} />
                  ) : (
                    <p className="text-[13.5px] text-slate-400">Nothing to preview yet.</p>
                  )}
                </div>
              ) : (
                <Textarea
                  id="ann-body"
                  ref={bodyRef}
                  rows={9}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onPaste={paste}
                  placeholder={"Dear Students,\n\nThe **Mid-Term Evaluation** will be held as follows:\n- **Date:** Thursday, 8 October\n- **Venue:** Room 014, AB1"}
                  className="rounded-none border-0 bg-transparent font-mono text-[13px] leading-relaxed shadow-none focus:ring-0"
                />
              )}
            </div>
            <p className="mt-1.5 text-[12px] text-slate-500">
              Paste straight from Outlook or Word to keep its formatting, or use the buttons. Dates and times turn green on their own. Check Preview to see what students will get.
            </p>
          </div>
          <Field label="Attach a file (optional)" htmlFor="ann-file">
            <FileDrop
              id="ann-file"
              files={file ? [file] : []}
              onChange={(files) => setFile(files[0] ?? null)}
              specs="PDF, slides, documents or images · up to 25 MB"
              disabled={busy}
            />
          </Field>
          {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              <Send className="size-3.5" />
              Post announcement
            </Button>
          </div>
        </CardBody>
      </form>
    </Card>
  );
}
