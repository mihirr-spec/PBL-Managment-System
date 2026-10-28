"use client";

import { useState, type FormEvent } from "react";
import { Megaphone, Send } from "lucide-react";

import { FileLink } from "@/components/shared/file-link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { postAnnouncement } from "@/lib/data/repository";
import type { Announcement, User } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/utils";

/** Announcements, newest first, with any attached file. */
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
    <ul className="space-y-3">
      {items.map((a) => (
        <li
          key={a.id}
          className="rounded-[18px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_-32px_rgba(61,78,92,0.5)] backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <Avatar name={a.postedByName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[17px] tracking-tight text-ink-900">{a.title}</p>
              <p className="text-[12px] text-stone-500" title={formatDateTime(a.createdAt)}>
                {a.postedByName} · {a.scope === "all" ? "All students" : "Your supervisor's groups"} ·{" "}
                {timeAgo(a.createdAt)}
              </p>
            </div>
          </div>
          {a.body ? (
            <p className="mt-3 text-[13.5px] leading-relaxed whitespace-pre-line text-stone-600">{a.body}</p>
          ) : null}
          {a.attachmentPath && a.attachmentName ? (
            <FileLink bucket="announcements" path={a.attachmentPath} name={a.attachmentName} className="mt-3" />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Posting form for teachers (to their groups) and admins (to every student). */
export function AnnouncementComposer({ user, onPosted }: { user: User; onPosted: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("Give the announcement a title.");
    setBusy(true);
    setError(null);
    try {
      await postAnnouncement({ user, title: title.trim(), body: body.trim(), file: file ?? undefined });
      setTitle("");
      setBody("");
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
            <Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          </Field>
          <Field label="Message" htmlFor="ann-body">
            <Textarea id="ann-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
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
