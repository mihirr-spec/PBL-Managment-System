"use client";

import { useState } from "react";
import { Check, ChevronDown, Crown, FileWarning, PencilLine, Search, UserPlus, X } from "lucide-react";

import { DocumentPreview } from "@/components/shared/document-viewer";
import { FileLink } from "@/components/shared/file-link";
import { RichText } from "@/components/shared/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session";
import * as repo from "@/lib/data/repository";
import type { Group, MentorRequest, RequestStatus } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { formatDateTime, timeAgo } from "@/lib/utils";

type Request = MentorRequest & { group: Group | null };

/** What the database said about a decision, in words. */
const OUTCOME: Record<string, { tone: "sage" | "clay" | "gold"; text: string }> = {
  approved: { tone: "sage", text: "Approved - you are now this group's registered mentor." },
  rejected: { tone: "clay", text: "Registration rejected. The group has been told." },
  changes_requested: { tone: "gold", text: "Sent back to the team lead with your corrections." },
  already_assigned: {
    tone: "gold",
    text: "This group was already registered with another supervisor, so the request has been closed.",
  },
  full: { tone: "gold", text: "You already mentor the maximum of 7 groups." },
  closed: { tone: "gold", text: "This request was already closed." },
};

const STATUS: Record<RequestStatus, { tone: "gold" | "sage" | "clay" | "neutral"; label: string }> = {
  pending: { tone: "gold", label: "Pending" },
  changes_requested: { tone: "gold", label: "Awaiting corrections" },
  approved: { tone: "sage", label: "Approved" },
  rejected: { tone: "clay", label: "Rejected" },
  closed: { tone: "neutral", label: "Closed" },
};

export default function RequestsPage() {
  const { user } = useSession();
  const { data, error, reload } = useLoad(() => repo.listRequestsForFaculty(user!.profileId), user ? user.id : null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("all");

  if (error) {
    return (
      <Card>
        <EmptyState icon={<UserPlus className="size-5" />} title="Could not load your requests" description={error} scene="requests" />
      </Card>
    );
  }
  if (!user || !data) return <PageSkeleton />;

  const pending = data.filter((r) => r.status === "pending");
  const approved = data.filter((r) => r.status === "approved").length;
  const changes = data.filter((r) => r.status === "changes_requested").length;
  const history = data
    .filter((r) => r.status !== "pending")
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        r.group?.name,
        r.group?.projectTitle,
        ...(r.group?.members ?? []).map((m) => m.fullName),
        r.facultyName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mentor Requests"
        title="Groups registering"
        emphasis="with you."
        description="Each team lead uploads the PBL form you signed. Check it, then approve, ask for corrections, or reject. Before approving, the system checks the group isn't already registered with another supervisor."
        scene="requests"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Pending requests" value={pending.length} caption="Groups awaiting your review" />
        <StatTile label="Approved" value={approved} caption="Groups registered" tone="sage" />
        <StatTile label="Corrections requested" value={changes} caption="Groups sent back for changes" tone="gold" />
      </div>

      <Card>
        <CardHeader
          title="Pending registrations"
          description="New group registrations submitted by team leads will appear here."
        />
        {pending.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="size-5" />}
            title="No pending requests"
            description="New submissions will appear here."
            scene="requests"
          />
        ) : (
          <div className="space-y-4 p-4 sm:p-5">
            {pending.map((r) => (
              <RequestCard key={r.id} request={r} onDecided={reload} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Request history"
          description="Previously reviewed group registrations."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-stone-400" aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search groups..."
                  aria-label="Search groups"
                  className="w-44 pl-8"
                />
              </div>
              <Field label="" htmlFor="req-status">
                <div className="relative">
                  <select
                    id="req-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RequestStatus | "all")}
                    className="cursor-pointer appearance-none rounded-lg border border-sand-200 bg-white/75 py-1.5 pr-8 pl-3 text-[13px] text-stone-800"
                  >
                    <option value="all">All statuses</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="changes_requested">Corrections requested</option>
                    <option value="closed">Closed</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-stone-500" aria-hidden />
                </div>
              </Field>
            </div>
          }
        />
        {history.length === 0 ? (
          <CardBody>
            <p className="text-[13px] text-stone-500">No reviewed requests match.</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left">
              <thead>
                <tr className="border-b border-sand-200/60 bg-white/40 text-[10.5px] tracking-[0.12em] text-ink-400 uppercase">
                  <th className="px-5 py-2.5 font-semibold">Group</th>
                  <th className="px-5 py-2.5 font-semibold">Submitted on</th>
                  <th className="px-5 py-2.5 font-semibold">Reviewed on</th>
                  <th className="px-5 py-2.5 font-semibold">Submitted by</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200/70">
                {history.map((r) => (
                  <HistoryRow key={r.id} request={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** One of the three counts above the lists. */
function StatTile({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: number;
  caption: string;
  tone?: "neutral" | "sage" | "gold";
}) {
  return (
    <div className="rounded-[18px] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_1px_2px_rgba(61,78,92,0.05),0_18px_44px_-30px_rgba(61,78,92,0.4)] backdrop-blur-xl">
      <p className="text-[10.5px] font-semibold tracking-[0.14em] text-ink-400 uppercase">{label}</p>
      <p
        className={
          tone === "sage"
            ? "tnum mt-1 font-display text-[1.9rem] leading-tight text-sage-500"
            : tone === "gold"
              ? "tnum mt-1 font-display text-[1.9rem] leading-tight text-gold-600"
              : "tnum mt-1 font-display text-[1.9rem] leading-tight text-ink-900"
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-stone-500">{caption}</p>
    </div>
  );
}

/** A reviewed request as a table row. */
function HistoryRow({ request: r }: { request: Request }) {
  const leader = r.group?.members.find((m) => m.studentId === r.group?.leaderStudentId);
  const groupNo = r.group ? `Group ${r.group.number}` : "Group";
  return (
    <tr className="transition-colors hover:bg-white/70">
      <td className="px-5 py-3">
        <p className="text-[13.5px] font-medium text-ink-900">{groupNo} {r.group?.projectTitle ? `· ${r.group.projectTitle}` : ""}</p>
        <p className="text-[11.5px] text-stone-500">PBL Registration Form</p>
      </td>
      <td className="px-5 py-3 text-[12.5px] text-stone-600" title={formatDateTime(r.createdAt)}>
        {timeAgo(r.createdAt)}
      </td>
      <td className="px-5 py-3 text-[12.5px] text-stone-600" title={r.decidedAt ? formatDateTime(r.decidedAt) : undefined}>
        {r.decidedAt ? timeAgo(r.decidedAt) : "-"}
      </td>
      <td className="px-5 py-3">
        {leader ? (
          <span className="flex items-center gap-2">
            <Avatar name={leader.fullName} src={leader.avatarUrl} size="sm" />
            <span>
              <span className="block text-[12.5px] font-medium text-ink-900">{leader.fullName}</span>
              <span className="block text-[11px] text-stone-500">Team Lead</span>
            </span>
          </span>
        ) : (
          <span className="text-[12.5px] text-stone-400">-</span>
        )}
      </td>
      <td className="px-5 py-3">
        <Badge tone={STATUS[r.status].tone} dot>
          {STATUS[r.status].label}
        </Badge>
      </td>
      <td className="pr-4">
        <ButtonLinkViewDetails request={r} />
      </td>
    </tr>
  );
}

/** The row's "View details" action, opening the group itself. */
function ButtonLinkViewDetails({ request: r }: { request: Request }) {
  if (!r.group) return <span className="text-[12.5px] text-stone-400">-</span>;
  return (
    <a
      href={`/faculty/groups/${r.group.id}`}
      className="text-[12.5px] font-medium text-azure-600 hover:underline"
    >
      View details
    </a>
  );
}

function RequestCard({ request, onDecided }: { request: Request; onDecided: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<repo.MentorDecision | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const group = request.group;

  async function decide(decision: repo.MentorDecision) {
    if (decision === "changes" && !note.trim()) {
      setError("Write what needs to be corrected so the team lead can fix it.");
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      const result = await repo.reviewMentorRequest(request.id, decision, note.trim());
      setOutcome(result);
      // Let the outcome message register before the card leaves the list.
      setTimeout(onDecided, result === "full" ? 0 : 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the decision.");
    } finally {
      setBusy(null);
    }
  }

  const result = outcome ? OUTCOME[outcome] : null;

  return (
    <Card>
      <CardHeader
        title={group ? `Group ${group.number} · ${group.projectTitle}` : "Group"}
        description={
          group
            ? `${group.name}${group.domain ? ` · ${group.domain}` : ""} · ${
                request.resubmittedAt ? `resubmitted ${timeAgo(request.resubmittedAt)}` : `sent ${timeAgo(request.createdAt)}`
              }`
            : undefined
        }
      />
      <CardBody className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <FormPreview request={request} />

        <div className="space-y-4">
          {request.resubmittedAt && request.reviewNote ? (
            <p className="rounded-[12px] bg-gold-50 px-3 py-2 text-[12.5px] text-gold-600">
              <span className="font-semibold">Corrected form.</span> You had asked: {request.reviewNote}
            </p>
          ) : null}
          {request.message ? (
            <div className="rounded-[12px] border-l-4 border-azure-500 bg-azure-50/60 px-4 py-2.5">
              <RichText text={request.message} className="text-[13.5px] text-ink-800" />
            </div>
          ) : null}
          {group?.projectIdea ? (
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">Project description</p>
              <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line text-stone-600">{group.projectIdea}</p>
            </div>
          ) : null}
          {group ? (
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">Members</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {group.members.map((m) => (
                  <li key={m.studentId} className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[12.5px] text-ink-900 ring-1 ring-white">
                    {m.studentId === group.leaderStudentId ? <Crown className="size-3 text-gold-500" aria-label="Team lead" /> : null}
                    {m.fullName}
                    <span className="tnum text-stone-400">{m.registrationNumber}</span>
                  </li>
                ))}
                {(group.invited ?? []).map((m) => (
                  <li key={m.registrationNumber} className="flex items-center gap-1.5 rounded-full bg-white/50 px-3 py-1 text-[12.5px] text-stone-600 ring-1 ring-white" title="Invited - joins once they accept">
                    {m.fullName}
                    <span className="tnum text-stone-400">{m.registrationNumber}</span>
                    <span className="text-[11px] text-gold-600">invited</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result ? (
            <p className={`rounded-[12px] px-3 py-2 text-[13px] ${result.tone === "sage" ? "bg-sage-100 text-sage-500" : result.tone === "clay" ? "bg-clay-100 text-clay-500" : "bg-gold-50 text-gold-600"}`}>
              {result.text}
            </p>
          ) : (
            <>
              <Field
                label="Corrections or remarks"
                htmlFor={`note-${request.id}`}
                help="Required when asking for changes. The team lead sees this note."
              >
                <Textarea
                  id={`note-${request.id}`}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Sign page 2 and add the co-guide's name"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={busy === "approve"} disabled={busy !== null} onClick={() => void decide("approve")}>
                  <Check className="size-3.5" />
                  Approve
                </Button>
                <Button size="sm" variant="secondary" loading={busy === "changes"} disabled={busy !== null} onClick={() => void decide("changes")}>
                  <PencilLine className="size-3.5" />
                  Ask for changes
                </Button>
                <Button size="sm" variant="danger" loading={busy === "reject"} disabled={busy !== null} onClick={() => void decide("reject")}>
                  <X className="size-3.5" />
                  Reject
                </Button>
              </div>
            </>
          )}
          {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
        </div>
      </CardBody>
    </Card>
  );
}

/** Shows the signed form inline, plus any other attached files; the link opens one full screen. */
function FormPreview({ request }: { request: Request }) {
  const files = request.files.length > 0 ? request.files : request.formPath ? [{ path: request.formPath, name: request.formName ?? "" }] : [];

  if (files.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[14px] bg-ivory-200/70 p-6 text-center text-[13px] text-stone-500">
        <FileWarning className="size-5" />
        No signed form was attached to this request.
      </div>
    );
  }

  const primary = files[0];
  const rest = files.slice(1);

  return (
    <div className="space-y-2">
      <DocumentPreview
        bucket="submissions"
        path={primary.path}
        name={primary.name}
        className="h-[28rem] rounded-[14px] ring-1 ring-sand-200"
      />
      <div className="space-y-1.5">
        {files.map((f) => (
          <div key={f.path} className="flex items-center justify-between gap-3">
            <span className="truncate text-[12.5px] font-medium text-ink-900">{f.name}</span>
            <FileLink bucket="submissions" path={f.path} name={f.name} />
          </div>
        ))}
      </div>
      {rest.length > 0 ? (
        <p className="text-[11.5px] text-stone-400">{files.length} files attached to this request.</p>
      ) : null}
    </div>
  );
}
