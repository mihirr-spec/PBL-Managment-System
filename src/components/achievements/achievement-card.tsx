"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  PencilLine,
  Send,
  Share2,
  XCircle,
} from "lucide-react";

import { FileLink } from "@/components/shared/file-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { PendingApproval } from "@/components/achievements/linkedin-preview";
import { findTemplate, linkedInPost, MAX_BONUS_MARKS } from "@/lib/achievements";
import * as repo from "@/lib/data/repository";
import type { Achievement, AchievementEvent, AchievementStatus, Student } from "@/lib/types";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";

const STATUS: Record<AchievementStatus, { label: string; tone: "sky" | "gold" | "sage" | "clay" }> = {
  submitted: { label: "Under review", tone: "sky" },
  needs_info: { label: "More details needed", tone: "gold" },
  approved: { label: "Approved", tone: "sage" },
  rejected: { label: "Not approved", tone: "clay" },
};

export function AchievementStatusBadge({ status }: { status: AchievementStatus }) {
  return (
    <Badge tone={STATUS[status].tone} dot>
      {STATUS[status].label}
    </Badge>
  );
}

const ACTION_LABEL: Record<AchievementEvent["action"], string> = {
  submitted: "submitted it",
  resubmitted: "updated and resubmitted it",
  comment: "commented",
  needs_info: "asked for more details",
  approved: "approved it",
  rejected: "did not approve it",
  posted: "posted it on LinkedIn",
};

/** Who is looking: the student who filed it, their supervisor, or the PBL office. */
export type AchievementViewer = "student" | "reviewer" | "admin";

/**
 * One achievement with its answers, documents and the conversation trail.
 * Reviewers can approve (with bonus marks), ask for details or reject; anyone
 * involved can comment. Approved achievements show their LinkedIn post:
 * staff open the preview (`onPreview`) to post it, students get a draft to copy.
 * With `onApproveWithPreview`, approving first shows the post, then approves
 * and posts it in one step.
 */
export function AchievementCard({
  achievement: a,
  viewer,
  student,
  onChanged,
  onEdit,
  onPreview,
  onApproveWithPreview,
}: {
  achievement: Achievement;
  viewer: AchievementViewer;
  /** For the LinkedIn post - the student's own record, or the embedded one. */
  student?: Pick<Student, "fullName" | "programme" | "branch" | "semester">;
  onChanged: () => void;
  onEdit?: () => void;
  /** Staff: opens the LinkedIn preview for this achievement (also right after approving it). */
  onPreview?: () => void;
  /** Staff: approve from the LinkedIn preview instead of straight away. */
  onApproveWithPreview?: (approval: PendingApproval) => void;
}) {
  const { category, template } = findTemplate(a.category, a.template);
  const open = a.status === "submitted" || a.status === "needs_info";
  const who = student ?? a.student;

  return (
    <article className="px-5 py-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold tracking-wide text-gold-600 uppercase">
            {category?.label ?? a.category}
            {template ? <span className="font-normal text-stone-400 normal-case"> · {template.label}</span> : null}
          </p>
          <h3 className="mt-1 font-display text-[17px] leading-snug text-ink-900">{a.title}</h3>
          <p className="mt-1 text-[12px] text-stone-500">
            {viewer !== "student" && a.student ? (
              <>
                <span className="font-medium text-ink-800">{a.student.fullName}</span> · {a.student.registrationNumber}
                {a.groupNumber ? ` · Group ${a.groupNumber}` : ""} ·{" "}
              </>
            ) : null}
            {a.achievedOn ? `Achieved ${formatDate(a.achievedOn)} · ` : ""}
            <span title={formatDateTime(a.createdAt)}>Filed {timeAgo(a.createdAt)}</span>
            {viewer !== "reviewer" && a.reviewerName ? ` · Reviewer: ${a.reviewerName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AchievementStatusBadge status={a.status} />
          {a.status === "approved" && a.bonusMarks != null ? (
            <span className="rounded-xl bg-sage-100 px-2.5 py-1 text-center text-sage-500">
              <span className="tnum font-display text-[15px]">+{a.bonusMarks}</span>
              <span className="ml-1 text-[10.5px] font-semibold uppercase">/ {MAX_BONUS_MARKS} bonus</span>
            </span>
          ) : null}
        </div>
      </div>

      {a.description ? (
        <p className="mt-3 text-[13.5px] leading-relaxed whitespace-pre-line text-stone-600">{a.description}</p>
      ) : null}

      <Answers achievement={a} />

      {a.documents.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.documents.map((d) => (
            <FileLink key={d.path} bucket="achievements" path={d.path} name={d.name} />
          ))}
        </div>
      ) : null}

      <Trail events={a.events} />

      {viewer === "student" && open && onEdit ? (
        <Button size="sm" variant={a.status === "needs_info" ? "primary" : "secondary"} className="mt-4" onClick={onEdit}>
          <PencilLine className="size-3.5" />
          {a.status === "needs_info" ? "Add the details and resubmit" : "Edit submission"}
        </Button>
      ) : null}

      {viewer !== "student" && open ? <ReviewPanel achievement={a} onChanged={onChanged} onApproveWithPreview={onApproveWithPreview} /> : null}

      <CommentBox achievementId={a.id} onChanged={onChanged} />

      {a.linkedIn ? <PostedOnLinkedIn achievement={a} onPreview={onPreview} /> : null}
      {a.status === "approved" && !a.linkedIn ? (
        onPreview ? (
          <Button size="sm" variant="secondary" className="mt-3 ml-0 sm:ml-3" onClick={onPreview}>
            <Share2 className="size-3.5" />
            Preview LinkedIn post
          </Button>
        ) : who ? (
          <LinkedInDraft achievement={a} student={who} />
        ) : null
      ) : null}
    </article>
  );
}

function Answers({ achievement: a }: { achievement: Achievement }) {
  const { template } = findTemplate(a.category, a.template);
  const rows = (template?.fields ?? Object.keys(a.answers).map((key) => ({ key, label: key })))
    .map((f) => ({ label: f.label, value: (a.answers[f.key] ?? "").trim() }))
    .filter((r) => r.value);
  if (rows.length === 0) return null;
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-[14px] bg-white/55 px-4 py-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <dt className="text-[11px] font-medium tracking-wide text-stone-400 uppercase">{r.label}</dt>
          <dd className="text-[13px] break-words text-ink-800">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Trail({ events }: { events: AchievementEvent[] }) {
  const shown = events.filter((e) => e.action !== "submitted" || e.note);
  if (shown.length === 0) return null;
  return (
    <ol className="mt-4 space-y-2 border-l-2 border-sand-200 pl-4">
      {shown.map((e) => (
        <li key={e.id} className="text-[13px]">
          <p className="text-[12px] text-stone-500">
            <span className="font-medium text-ink-800">{e.actorName}</span> {ACTION_LABEL[e.action]} ·{" "}
            <span title={formatDateTime(e.createdAt)}>{timeAgo(e.createdAt)}</span>
          </p>
          {e.note ? (
            <p
              className={cn(
                "mt-1 rounded-[10px] px-3 py-2 whitespace-pre-line",
                e.action === "needs_info" && "bg-gold-50 text-ink-800",
                e.action === "rejected" && "bg-clay-100/70 text-ink-800",
                e.action === "approved" && "bg-sage-100/70 text-ink-800",
                !["needs_info", "rejected", "approved"].includes(e.action) && "bg-white/60 text-stone-700",
              )}
            >
              {e.note}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

type Mode = "approve" | "needs_info" | "reject" | null;

function ReviewPanel({
  achievement,
  onChanged,
  onApproveWithPreview,
}: {
  achievement: Achievement;
  onChanged: () => void;
  onApproveWithPreview?: (approval: PendingApproval) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [marks, setMarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide() {
    if (!mode) return;
    const m = marks.trim() === "" ? 0 : Number(marks);
    if (mode === "approve" && (Number.isNaN(m) || m < 0 || m > MAX_BONUS_MARKS)) {
      setError(`Bonus marks must be between 0 and ${MAX_BONUS_MARKS}.`);
      return;
    }
    // The preview records the approval itself, once the post has been seen.
    if (mode === "approve" && onApproveWithPreview) {
      setError(null);
      onApproveWithPreview({ note: note.trim(), marks: m });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.reviewAchievement(achievement.id, mode, note.trim(), mode === "approve" ? m : undefined);
      setMode(null);
      setNote("");
      setMarks("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the decision.");
    } finally {
      setBusy(false);
    }
  }

  const choices = [
    { key: "approve", label: "Approve", icon: CheckCircle2 },
    { key: "needs_info", label: "Ask for more details", icon: HelpCircle },
    { key: "reject", label: "Reject", icon: XCircle },
  ] as const;

  return (
    <div className="mt-4 rounded-[14px] bg-white/60 p-4">
      <p className="text-[12px] font-medium tracking-wide text-stone-500 uppercase">Your decision</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((c) => (
          <Button
            key={c.key}
            size="sm"
            variant={mode === c.key ? (c.key === "reject" ? "danger" : "primary") : "secondary"}
            onClick={() => {
              setMode(mode === c.key ? null : c.key);
              setError(null);
            }}
          >
            <c.icon className="size-3.5" />
            {c.label}
          </Button>
        ))}
      </div>

      {mode ? (
        <div className="mt-3 grid gap-3">
          {mode === "approve" ? (
            <Field
              label={`Bonus marks (0–${MAX_BONUS_MARKS})`}
              htmlFor={`marks-${achievement.id}`}
              help="Added to the student's grades. Leave at 0 to approve without marks."
            >
              <Input
                id={`marks-${achievement.id}`}
                type="number"
                min={0}
                max={MAX_BONUS_MARKS}
                step={0.5}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="0"
                className="max-w-[8rem]"
              />
            </Field>
          ) : null}
          <Field
            label={mode === "approve" ? "Feedback (optional)" : mode === "reject" ? "Reason" : "What do you need?"}
            htmlFor={`note-${achievement.id}`}
          >
            <Textarea
              id={`note-${achievement.id}`}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "needs_info"
                  ? "e.g. Attach the official results page and the certificate."
                  : mode === "reject"
                    ? "e.g. Participation certificates don't count as an achievement."
                    : "e.g. Excellent work - nominated for the Student Excellence Award."
              }
            />
          </Field>
          {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
          <div>
            <Button size="sm" loading={busy} variant={mode === "reject" ? "danger" : "primary"} onClick={() => void decide()}>
              <Check className="size-3.5" />
              {mode === "approve" ? (onApproveWithPreview ? "Preview LinkedIn post and approve" : "Confirm approval") : mode === "reject" ? "Confirm rejection" : "Send request"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommentBox({ achievementId, onChanged }: { achievementId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await repo.commentAchievement(achievementId, note.trim());
      setNote("");
      setOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post the comment.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-azure-600 hover:underline"
      >
        <MessageSquare className="size-3.5" />
        Add a comment
      </button>
    );
  }
  return (
    <div className="mt-3 grid gap-2">
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a comment or feedback" aria-label="Comment" />
      {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" loading={busy} disabled={!note.trim()} onClick={() => void send()}>
          <Send className="size-3.5" />
          Post comment
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** "Posted on LinkedIn" with a link to the live post. */
function PostedOnLinkedIn({ achievement: a, onPreview }: { achievement: Achievement; onPreview?: () => void }) {
  if (!a.linkedIn) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-stone-500">
      <span className="inline-flex items-center gap-1 font-medium text-sage-500">
        <CheckCircle2 className="size-3.5" />
        On LinkedIn
      </span>
      <span>
        Posted by {a.linkedIn.postedBy || "staff"} · {formatDate(a.linkedIn.postedAt)}
      </span>
      <a
        href={`https://www.linkedin.com/feed/update/${a.linkedIn.urn}/`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-medium text-azure-600 hover:underline"
      >
        <ExternalLink className="size-3" />
        View post
      </a>
      {onPreview ? (
        <button onClick={onPreview} className="text-stone-500 hover:text-ink-800 hover:underline">
          Preview
        </button>
      ) : null}
    </p>
  );
}

/** The post written from the template; editable, then copied or opened in LinkedIn. */
export function LinkedInDraft({
  achievement,
  student,
}: {
  achievement: Achievement;
  student: Pick<Student, "fullName" | "programme" | "branch" | "semester">;
}) {
  const [text, setText] = useState(() => linkedInPost(achievement, student));
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="mt-3 ml-0 sm:ml-3" onClick={() => setOpen(true)}>
        <Share2 className="size-3.5" />
        LinkedIn post
      </Button>
    );
  }

  return (
    <div className="mt-4 rounded-[14px] bg-azure-50/70 p-4">
      <p className="text-[12px] font-medium tracking-wide text-azure-600 uppercase">LinkedIn post · written from the template</p>
      <Textarea
        rows={9}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="LinkedIn post"
        className="mt-2 font-[inherit] text-[13px] leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void copy()}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy text"}
        </Button>
        <a
          href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/80 px-3 text-[13px] font-medium text-stone-700 ring-1 ring-white ring-inset hover:bg-white hover:text-ink-800"
        >
          <ExternalLink className="size-3.5" />
          Open in LinkedIn
        </a>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </div>
  );
}
