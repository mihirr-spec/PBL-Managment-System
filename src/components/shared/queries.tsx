"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, ArrowRightLeft, Building2, Check, CheckCircle2, Clock, CornerDownRight, X } from "lucide-react";

import { FileLink } from "@/components/shared/file-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import {
  adminApproveSupervisorChange,
  adminDeclineSupervisorChange,
  approveSupervisorChange,
  declineSupervisorChange,
  replyTicket,
} from "@/lib/data/repository";
import type { Ticket } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/utils";

/** Status wording depends on the kind of query. */
export function statusOf(q: Ticket): { tone: "gold" | "sage" | "clay" | "neutral"; label: string } {
  if (q.category === "supervisor_change") {
    switch (q.status) {
      case "open":
        return { tone: "gold", label: "Waiting for supervisors" };
      case "forwarded":
        return { tone: "gold", label: "With the PBL office" };
      case "resolved":
        return { tone: "sage", label: "Supervisor changed" };
      default:
        return { tone: "clay", label: "Declined" };
    }
  }
  return q.status === "open" ? { tone: "gold", label: "Open" } : { tone: "sage", label: "Resolved" };
}

/**
 * Query threads. The group's supervisor (`canReply`) answers and resolves; on
 * a change-of-supervisor request, the viewer approves for their own side.
 */
export function QueryList({
  queries,
  canReply = false,
  viewerFacultyId,
  onChanged,
  action,
}: {
  queries: Ticket[];
  canReply?: boolean;
  /** The signed-in teacher, to tell the requested supervisor from the current one. */
  viewerFacultyId?: string;
  onChanged?: () => void;
  /** Extra controls under a query (the PBL office's decision form). */
  action?: (query: Ticket) => ReactNode;
}) {
  return (
    <ul className="divide-y divide-sand-200/70">
      {queries.map((q) => (
        <QueryRow key={q.id} query={q} canReply={canReply} viewerFacultyId={viewerFacultyId} onChanged={onChanged} action={action} />
      ))}
    </ul>
  );
}

function QueryRow({
  query: q,
  canReply,
  viewerFacultyId,
  onChanged,
  action,
}: {
  query: Ticket;
  canReply: boolean;
  viewerFacultyId?: string;
  onChanged?: () => void;
  action?: (query: Ticket) => ReactNode;
}) {
  const status = statusOf(q);
  const isChange = q.category === "supervisor_change";

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-ink-900">
            {isChange ? null : q.subject}
            {isChange ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-azure-50 px-2.5 py-0.5 text-[12.5px] font-semibold text-azure-600">
                <ArrowRightLeft className="size-3.5" />
                Change of supervisor
              </span>
            ) : null}
          </p>
          <p className="text-[12px] text-stone-500" title={formatDateTime(q.createdAt)}>
            {q.studentName ?? "Student"}
            {q.groupNumber != null ? ` · Group ${q.groupNumber}` : ""} · {timeAgo(q.createdAt)}
          </p>
        </div>
        <Badge tone={status.tone} dot>{status.label}</Badge>
      </div>
      {q.body ? (
        <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-stone-600">{q.body}</p>
      ) : null}

      {q.attachments.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {q.attachments.map((a) => (
            <li key={a.filePath}>
              <FileLink bucket="submissions" path={a.filePath} name={a.fileName} />
            </li>
          ))}
        </ul>
      ) : null}
      {isChange ? <ChangeProgress query={q} /> : null}
      {q.reply ? (
        <Reply icon={<CornerDownRight className="size-4" />} who="Supervisor" when={q.repliedAt} text={q.reply} />
      ) : null}
      {q.adminReply ? (
        <Reply
          icon={<Building2 className="size-4" />}
          who={isChange ? "Outcome" : "Administrator"}
          when={q.adminRepliedAt}
          text={q.adminReply}
        />
      ) : null}

      {canReply && q.status === "open" ? (
        isChange ? (
          <ChangeDecision
            query={q}
            side={viewerFacultyId && q.targetFacultyId === viewerFacultyId ? "target" : "current"}
            onChanged={onChanged}
          />
        ) : (
          <ReplyForm query={q} onChanged={onChanged} />
        )
      ) : null}
      {action ? action(q) : null}
    </li>
  );
}

function Reply({ icon, who, when, text }: { icon: ReactNode; who: string; when?: string; text: string }) {
  return (
    <div className="mt-3 flex gap-2 rounded-[12px] bg-azure-50/70 px-3 py-2.5 text-[13px] text-ink-800">
      <span className="mt-0.5 shrink-0 text-azure-600">{icon}</span>
      <div>
        <p className="whitespace-pre-line">{text}</p>
        <p className="mt-1 text-[11.5px] text-stone-500">
          {who}
          {when ? ` · ${timeAgo(when)}` : ""}
        </p>
      </div>
    </div>
  );
}

/** General query: reply, and optionally mark it resolved. */
function ReplyForm({ query, onChanged }: { query: Ticket; onChanged?: () => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(resolve: boolean) {
    if (!reply.trim() && !resolve) return;
    setBusy(true);
    setError(null);
    try {
      await replyTicket(query.id, reply.trim() || query.reply || "Resolved.", resolve);
      setReply("");
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the reply.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void send(false);
      }}
      className="mt-3 space-y-2"
    >
      <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" aria-label="Reply" />
      {error ? <p role="alert" className="text-[12.5px] text-clay-500">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={busy} disabled={!reply.trim()}>
          Send reply
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void send(true)}>
          <CheckCircle2 className="size-3.5" />
          {reply.trim() ? "Reply & resolve" : "Mark resolved"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Change of supervisor: where the group wants to go, and which of the two
 * supervisors has approved so far.
 */
export function ChangeProgress({ query: q }: { query: Ticket }) {
  return (
    <div className="mt-3 space-y-1.5 rounded-[12px] bg-white/70 px-3 py-2.5 text-[12.5px] text-ink-800 ring-1 ring-sand-200/70">
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="text-stone-500">Wants to move to</span>
        <ArrowRight className="size-3.5 text-azure-600" aria-hidden />
        <span className="font-semibold">{q.targetName ?? "another supervisor"}</span>
      </p>
      <ApprovalLine label="Current supervisor" at={q.currentApprovedAt} note={q.currentNote} />
      <ApprovalLine label="Requested supervisor" at={q.targetApprovedAt} note={q.targetNote} />
    </div>
  );
}

/** One supervisor's side of a change: approved (when, with their note) or not yet. */
function ApprovalLine({ label, at, note }: { label: string; at?: string; note?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5">
      {at ? <Check className="size-3.5 text-sage-500" /> : <Clock className="size-3.5 text-stone-400" />}
      <span className="font-medium">{label}:</span>
      <span className={at ? "text-sage-500" : "text-stone-500"}>{at ? `approved ${timeAgo(at)}` : "not yet"}</span>
      {note ? <span className="text-stone-600">- {note}</span> : null}
    </p>
  );
}

/**
 * Change of supervisor: the current (`side="current"`) or requested
 * (`side="target"`) supervisor approves or declines for their own side.
 */
export function ChangeDecision({
  query,
  side,
  onChanged,
}: {
  query: Ticket;
  side: "current" | "target";
  onChanged?: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = side === "current" ? query.currentApprovedAt : query.targetApprovedAt;
  const other = side === "current" ? query.targetApprovedAt : query.currentApprovedAt;

  async function decide(approve: boolean) {
    if (!approve && !note.trim()) {
      setError("Say why you are declining, so the group understands.");
      return;
    }
    setBusy(approve ? "approve" : "decline");
    setError(null);
    try {
      if (approve) await approveSupervisorChange(query.id, note.trim());
      else await declineSupervisorChange(query.id, note.trim());
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your decision.");
    } finally {
      setBusy(null);
    }
  }

  if (mine) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-stone-600">
        <Clock className="size-3.5" />
        You approved. Waiting for the {side === "current" ? "requested" : "current"} supervisor.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-[14px] border border-azure-100 bg-white/70 p-3">
      <p className="text-[12.5px] text-stone-600">
        {side === "current"
          ? `You are the current supervisor. The group wants to move to ${query.targetName ?? "another supervisor"}.`
          : "The group wants to move to you."}{" "}
        {other
          ? "The other supervisor has approved, so your approval completes it."
          : "The other supervisor is asked too; the move happens once you both approve."}{" "}
        If the new supervisor is already at their limit, the PBL office makes the final call.
      </p>
      <Textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note for the group (required to decline)"
        aria-label="Note"
      />
      {error ? <p role="alert" className="text-[12.5px] text-clay-500">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={busy === "approve"} disabled={busy !== null} onClick={() => void decide(true)}>
          <Check className="size-3.5" />
          Approve
        </Button>
        <Button size="sm" variant="danger" loading={busy === "decline"} disabled={busy !== null} onClick={() => void decide(false)}>
          <X className="size-3.5" />
          Decline
        </Button>
      </div>
    </div>
  );
}

/**
 * The PBL office's call on a request both supervisors approved while the new
 * supervisor was already at their group limit.
 */
export function AdminChangeDecision({ query, onChanged }: { query: Ticket; onChanged?: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    if (!approve && !note.trim()) {
      setError("Write why the request is declined - the group will see it.");
      return;
    }
    setBusy(approve ? "approve" : "decline");
    setError(null);
    try {
      if (approve) await adminApproveSupervisorChange(query.id);
      else await adminDeclineSupervisorChange(query.id, note.trim());
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your decision.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-[14px] border border-azure-100 bg-white/70 p-3">
      <p className="text-[12.5px] text-stone-600">
        Both supervisors approved, but {query.targetName ?? "the new supervisor"} already has their full number of
        groups. Approve to let them take one more, or decline with a reason.
      </p>
      <Textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason (required to decline)"
        aria-label="Reason"
      />
      {error ? <p role="alert" className="text-[12.5px] text-clay-500">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={busy === "approve"} disabled={busy !== null} onClick={() => void decide(true)}>
          <Check className="size-3.5" />
          Approve the move
        </Button>
        <Button size="sm" variant="danger" loading={busy === "decline"} disabled={busy !== null} onClick={() => void decide(false)}>
          <X className="size-3.5" />
          Decline
        </Button>
      </div>
    </div>
  );
}
