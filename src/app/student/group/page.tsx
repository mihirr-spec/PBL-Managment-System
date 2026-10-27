"use client";

import { useState, type FormEvent } from "react";
import { Crown, Hourglass, RotateCcw, Send, UserPlus, X } from "lucide-react";

import { MentorCard } from "@/components/profile/mentor-card";
import { MentorPicker } from "@/components/student/mentor-picker";
import { FileLink } from "@/components/shared/file-link";
import { GetStarted } from "@/components/student/get-started";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import type { Faculty, Group, MentorRequest, RequestStatus, SentInvitation } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { timeAgo } from "@/lib/utils";

const REQUEST_STATUS: Record<RequestStatus, { tone: "gold" | "sage" | "clay" | "neutral"; label: string }> = {
  pending: { tone: "gold", label: "Under review" },
  changes_requested: { tone: "clay", label: "Changes requested" },
  approved: { tone: "sage", label: "Approved" },
  rejected: { tone: "clay", label: "Rejected" },
  closed: { tone: "neutral", label: "Closed" },
};

export default function GroupPage() {
  const { loading, student, group, mentor, supervisorChange, invitations, refresh } = usePortal();
  const isLeader = student != null && group?.leaderStudentId === student.id;

  // A team lead stays on the start form until the mentor request is sent:
  // the team itself is created by the first teammate request.
  const choosing = group != null && isLeader && !group.mentorId;
  const requests = useLoad(() => repo.listRequestsForGroup(group!.id), choosing ? `start:${group!.id}` : null);
  const [startedHere, setStartedHere] = useState(false);

  if (loading || !student) return <PageSkeleton />;

  const checking = choosing && requests.data == null && !requests.error;
  const starting =
    !group || (choosing && (requests.data?.length === 0 || (checking && startedHere)));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Group"
        title={group && !starting ? `Group ${group.number}:` : "Start your"}
        emphasis={group && !starting ? group.name : "PBL group."}
        description={
          group && !starting
            ? group.projectTitle
            : "Send your teammates a request, choose the mentor who signed your application, and send it."
        }
        scene="group"
      />
      {starting ? (
        <GetStarted
          student={student}
          group={group}
          invitations={invitations}
          onGroupCreated={() => {
            setStartedHere(true);
            void refresh();
          }}
          onDone={async () => {
            await refresh();
            if (choosing) await requests.reload();
          }}
        />
      ) : checking || !group ? (
        <PageSkeleton />
      ) : (
        <GroupView group={group} isLeader={isLeader} mentorCard={<MentorCard mentor={mentor} lastChange={supervisorChange} />} onChanged={refresh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- group view */

function GroupView({
  group,
  isLeader,
  mentorCard,
  onChanged,
}: {
  group: Group;
  isLeader: boolean;
  mentorCard: React.ReactNode;
  onChanged: () => void;
}) {
  const requests = useLoad(() => repo.listRequestsForGroup(group.id), group.id);
  const [target, setTarget] = useState<Faculty | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Members" description={group.projectIdea ? undefined : "Add a project idea so your teacher knows what you plan."} />
          <ul className="divide-y divide-sand-200/70">
            {group.members.map((m) => (
              <li key={m.studentId} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={m.fullName} src={m.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[14px] font-medium text-ink-900">
                    {m.fullName}
                    {m.studentId === group.leaderStudentId ? <Crown className="size-3.5 text-gold-500" aria-label="Team leader" /> : null}
                  </p>
                  <p className="tnum text-[12px] text-stone-500">{m.registrationNumber} · {m.email}</p>
                </div>
                <span className="hidden text-[12px] text-stone-500 sm:block">{m.teamRole}</span>
              </li>
            ))}
          </ul>
          <InvitationsPanel isLeader={isLeader} memberCount={group.members.length} />
          {group.projectIdea ? (
            <CardBody className="border-t border-sand-200/60">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">Project idea</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600">{group.projectIdea}</p>
            </CardBody>
          ) : null}
        </Card>
        {mentorCard}
      </div>

      {group.mentorId ? null : (
        <>
          <Card>
            <CardHeader
              title="Mentor registration"
              description="Agree with your teacher first, then the team lead uploads the signed PBL form here. The teacher reviews it and approves, rejects, or asks for corrections."
            />
            {requests.data && requests.data.length > 0 ? (
              <ul className="divide-y divide-sand-200/70">
                {requests.data.map((r) => (
                  <RequestRow
                    key={r.id}
                    request={r}
                    groupId={group.id}
                    isLeader={isLeader}
                    onResubmitted={() => void requests.reload()}
                  />
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-[13px] text-stone-500">
                  {isLeader
                    ? "No form sent yet. Choose your mentor below and upload the signed form."
                    : "Your team lead has not sent the signed PBL form yet."}
                </p>
              </CardBody>
            )}
          </Card>

          {isLeader ? (
            <Card className="relative z-10 overflow-visible">
              <CardHeader title="Choose your mentor" description="Type the name of the teacher who agreed to mentor you (the department is optional), then send them the signed form." />
              <CardBody>
                <MentorPicker idPrefix="gv" value={target} onChange={setTarget} />
              </CardBody>
            </Card>
          ) : null}

          {target ? (
            <RequestForm
              faculty={target}
              groupId={group.id}
              onCancel={() => setTarget(null)}
              onSent={() => {
                setTarget(null);
                void requests.reload();
                onChanged();
              }}
            />
          ) : null}

        </>
      )}
    </div>
  );
}

/** One request in the group's list; the team lead can fix and resubmit. */
function RequestRow({
  request: r,
  groupId,
  isLeader,
  onResubmitted,
}: {
  request: MentorRequest;
  groupId: string;
  isLeader: boolean;
  onResubmitted: () => void;
}) {
  const [fixing, setFixing] = useState(false);
  const status = REQUEST_STATUS[r.status];

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-medium text-ink-900">{r.facultyName}</p>
          <p className="text-[12px] text-stone-500">
            {r.resubmittedAt ? `Resubmitted ${timeAgo(r.resubmittedAt)}` : `Sent ${timeAgo(r.createdAt)}`}
          </p>
          {r.formPath && r.formName ? (
            <FileLink bucket="submissions" path={r.formPath} name={r.formName} className="mt-1.5" />
          ) : null}
        </div>
        <Badge tone={status.tone} dot>{status.label}</Badge>
      </div>

      {r.reviewNote ? (
        <p className="mt-3 rounded-[12px] bg-azure-50/70 px-3 py-2 text-[13px] whitespace-pre-line text-ink-800">
          <span className="font-semibold">{r.facultyName}:</span> {r.reviewNote}
        </p>
      ) : null}

      {r.status === "changes_requested" && isLeader ? (
        fixing ? (
          <FormUpload
            idPrefix={`fix-${r.id}`}
            submitLabel="Resubmit form"
            messageLabel="Note for the teacher (optional)"
            messageHelp="What did you change?"
            onCancel={() => setFixing(false)}
            onSubmit={async (message, form) => {
              await repo.resubmitMentorRequest({ requestId: r.id, groupId, message, form });
              setFixing(false);
              onResubmitted();
            }}
          />
        ) : (
          <Button size="sm" className="mt-3" onClick={() => setFixing(true)}>
            <RotateCcw className="size-3.5" />
            Upload corrected form
          </Button>
        )
      ) : null}
    </li>
  );
}

function RequestForm({
  faculty,
  groupId,
  onCancel,
  onSent,
}: {
  faculty: Faculty;
  groupId: string;
  onCancel: () => void;
  onSent: () => void;
}) {
  return (
    <Card className="ring-2 ring-azure-100">
      <CardHeader
        title={`Register with ${faculty.fullName}`}
        description={faculty.expertise || faculty.department}
        action={
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-stone-400 hover:text-ink-800" aria-label="Cancel">
            <X className="size-4" />
          </button>
        }
      />
      <CardBody>
        {faculty.onPortal ? null : (
          <p className="text-[12.5px] text-stone-500">
            {faculty.fullName} is not on the portal yet - they will see this once their account is set up.
          </p>
        )}
        <FormUpload
          idPrefix="req"
          submitLabel="Send for approval"
          messageLabel="Message to the teacher (optional)"
          messageHelp="A line or two - e.g. when you discussed the project."
          onSubmit={async (message, form) => {
            await repo.requestMentor({ groupId, facultyId: faculty.id, message, form });
            onSent();
          }}
        />
      </CardBody>
    </Card>
  );
}

/** Signed-form upload plus a short message, used to send and to resubmit. */
function FormUpload({
  idPrefix,
  submitLabel,
  messageLabel,
  messageHelp,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  submitLabel: string;
  messageLabel: string;
  messageHelp: string;
  onSubmit: (message: string, form: File) => Promise<void>;
  onCancel?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Attach the signed PBL form.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(message.trim(), file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the form.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <Field label="Signed PBL form" htmlFor={`${idPrefix}-form`}>
        <FileDrop
          id={`${idPrefix}-form`}
          files={file ? [file] : []}
          onChange={(files) => setFile(files[0] ?? null)}
          accept=".pdf,image/png,image/jpeg"
          specs="PDF, or a clear scan or photo (PNG, JPG) · up to 25 MB"
          disabled={busy}
        />
      </Field>
      <Field label={messageLabel} htmlFor={`${idPrefix}-msg`} help={messageHelp}>
        <Textarea id={`${idPrefix}-msg`} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>
          <Send className="size-3.5" />
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
        ) : null}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------ invitations */

/** Classmates invited but not yet joined; the team lead can invite more. */
function InvitationsPanel({ isLeader, memberCount }: { isLeader: boolean; memberCount: number }) {
  const sent = useLoad(repo.listSentInvitations, `invites:${memberCount}`);
  const [reg, setReg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = (sent.data ?? []).filter((i) => i.status === "pending");
  const declined = (sent.data ?? []).filter((i) => i.status === "declined");
  const room = 3 - memberCount - pending.length;

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!reg.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await repo.inviteMember(reg.trim());
      setReg("");
      await sent.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the invitation.");
    }
    setBusy(false);
  }

  async function cancel(invitation: SentInvitation) {
    try {
      await repo.cancelInvitation(invitation.id);
      await sent.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw the invitation.");
    }
  }

  if (!isLeader && pending.length === 0) return null;

  return (
    <CardBody className="space-y-3 border-t border-sand-200/60">
      {pending.length > 0 || declined.length > 0 ? (
        <ul className="space-y-2">
          {[...pending, ...declined].map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 text-[13px]">
              <Hourglass className={i.status === "pending" ? "size-3.5 text-gold-500" : "size-3.5 text-stone-300"} />
              <span className="text-ink-900">{i.fullName}</span>
              <span className="tnum text-[12px] text-stone-400">{i.registrationNumber}</span>
              <Badge tone={i.status === "pending" ? "gold" : "clay"}>
                {i.status === "pending" ? (i.hasAccount ? "Invited" : "Invited · not signed up yet") : "Declined"}
              </Badge>
              {isLeader && i.status === "pending" ? (
                <button type="button" onClick={() => void cancel(i)} className="text-[12px] text-stone-400 hover:text-clay-500">
                  Withdraw
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {isLeader && room > 0 ? (
        <form onSubmit={invite} className="flex flex-wrap gap-2">
          <Input
            value={reg}
            onChange={(e) => setReg(e.target.value)}
            inputMode="numeric"
            placeholder="Teammate's registration number"
            aria-label="Teammate's registration number"
            className="max-w-xs"
          />
          <Button type="submit" size="sm" variant="secondary" loading={busy}>
            <UserPlus className="size-3.5" />
            Invite
          </Button>
        </form>
      ) : null}
      {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
    </CardBody>
  );
}
