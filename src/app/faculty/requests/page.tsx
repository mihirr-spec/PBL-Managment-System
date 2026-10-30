"use client";

import { useState } from "react";
import { Check, Crown, FileWarning, PencilLine, UserPlus, X } from "lucide-react";

import { DocumentPreview } from "@/components/shared/document-viewer";
import { FileLink } from "@/components/shared/file-link";
import { RichText } from "@/components/shared/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session";
import * as repo from "@/lib/data/repository";
import type { Group, MentorRequest, RequestStatus } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { timeAgo } from "@/lib/utils";

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

  if (error) {
    return (
      <Card>
        <EmptyState icon={<UserPlus className="size-5" />} title="Could not load your requests" description={error} scene="requests" />
      </Card>
    );
  }
  if (!user || !data) return <PageSkeleton />;

  const pending = data.filter((r) => r.status === "pending");
  const others = data.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mentor Requests"
        title="Groups registering"
        emphasis="with you."
        description="Each team lead uploads the PBL form you signed. Check it, then approve, ask for corrections, or reject. Before approving, the system checks the group isn't already registered with another supervisor."
        scene="requests"
      />

      {pending.length === 0 ? (
        <Card>
          <EmptyState icon={<UserPlus className="size-5" />} title="No forms waiting for review" scene="requests" />
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((r) => (
            <RequestCard key={r.id} request={r} onDecided={reload} />
          ))}
        </div>
      )}

      {others.length > 0 ? (
        <Card>
          <CardHeader title="Earlier requests" description="Requests sent back for corrections return to the top once the group resubmits." />
          <ul className="divide-y divide-sand-200/70">
            {others.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-medium text-ink-900">
                      {r.group ? `Group ${r.group.number} · ${r.group.projectTitle}` : "Group"}
                    </p>
                    <p className="text-[12px] text-stone-500">
                      {r.decidedAt ? `Reviewed ${timeAgo(r.decidedAt)}` : `Sent ${timeAgo(r.createdAt)}`}
                    </p>
                  </div>
                  <Badge tone={STATUS[r.status].tone} dot>{STATUS[r.status].label}</Badge>
                </div>
                {r.reviewNote ? (
                  <p className="mt-1.5 text-[12.5px] whitespace-pre-line text-stone-600">Your note: {r.reviewNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
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
              <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">Project idea</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-stone-600">{group.projectIdea}</p>
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

/** Shows the signed form inline, drawn in place; the link opens it full screen. */
function FormPreview({ request }: { request: Request }) {
  const { formPath, formName } = request;

  if (!formPath || !formName) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[14px] bg-ivory-200/70 p-6 text-center text-[13px] text-stone-500">
        <FileWarning className="size-5" />
        No signed form was attached to this request.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <DocumentPreview
        bucket="submissions"
        path={formPath}
        name={formName}
        className="h-[28rem] rounded-[14px] ring-1 ring-sand-200"
      />
      <FileLink bucket="submissions" path={formPath} name={formName} />
    </div>
  );
}
