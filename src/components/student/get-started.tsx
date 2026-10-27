"use client";

import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Crown, Send, UserPlus } from "lucide-react";

import { InvitationCard } from "@/components/student/invitation-card";
import { MentorPicker } from "@/components/student/mentor-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import * as repo from "@/lib/data/repository";
import type { Faculty, Group, GroupInvitation, SentInvitation, Student } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

/** A team is the lead plus one or two teammates. */
const MAX_TEAMMATES = 2;

/**
 * Shown to a student who is not in a group yet, and to a team lead who has
 * not sent the mentor request yet. Requests from classmates come first
 * (joining a team ends here). Otherwise one form: the team (project title,
 * then a request to each teammate, sent with its own button - the first one
 * creates the team), the mentor, and the application they signed. Teammates
 * join once they accept; the mentor approves the request.
 */
export function GetStarted({
  student,
  group,
  invitations,
  onGroupCreated,
  onDone,
}: {
  student: Student;
  /** The team, once the first request has created it. */
  group: Group | null;
  invitations: GroupInvitation[];
  onGroupCreated: () => void;
  onDone: () => Promise<void> | void;
}) {
  const [createdId, setCreatedId] = useState<string | null>(null);
  const groupId = group?.id ?? createdId;
  const sent = useLoad(repo.listSentInvitations, groupId ? `sent:${groupId}` : null);

  const [teacher, setTeacher] = useState<Faculty | null>(null);
  const [form, setForm] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [mate, setMate] = useState({ fullName: "", registrationNumber: "" });
  const [sending, setSending] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joined = (group?.members ?? []).filter((m) => m.studentId !== student.id);
  const pending = (sent.data ?? []).filter((i) => i.status === "pending");
  const declined = (sent.data ?? []).filter((i) => i.status === "declined");
  const room = MAX_TEAMMATES - joined.length - pending.length;

  /** Sends one classmate a request; the first one creates the team. */
  async function sendRequest() {
    setTeamError(null);
    const teammate = { fullName: mate.fullName.trim(), registrationNumber: mate.registrationNumber.trim() };
    if (!title.trim() && !group) return setTeamError("Give your project title first.");
    if (!teammate.fullName || !teammate.registrationNumber) {
      return setTeamError("Give your teammate's name and registration number.");
    }
    setSending(true);
    try {
      if (groupId) {
        await repo.inviteMember(teammate.registrationNumber, teammate.fullName);
        await sent.reload();
      } else {
        setCreatedId(
          await repo.createGroup({
            name: `${student.fullName.split(" ")[0]}'s team`,
            projectTitle: title.trim(),
            projectIdea: "",
            domain: "",
            teammates: [teammate],
          }),
        );
        onGroupCreated();
      }
      setMate({ fullName: "", registrationNumber: "" });
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : "Could not send the request.");
    }
    setSending(false);
  }

  async function withdraw(invitation: SentInvitation) {
    setTeamError(null);
    try {
      await repo.cancelInvitation(invitation.id);
      await sent.reload();
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : "Could not withdraw the request.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!groupId) return setError("Send a request to at least one teammate first.");
    if (!teacher) return setError("Choose your mentor: type their name and pick them from the list.");
    if (!form) return setError("Attach the application your mentor signed.");

    setBusy(true);
    try {
      await repo.requestMentor({ groupId, facultyId: teacher.id, message: message.trim(), form });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the request.");
      setBusy(false);
      return;
    }
    await onDone();
  }

  /** Enter in a teammate field sends that request, not the whole form. */
  function sendOnEnter(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void sendRequest();
  }

  return (
    <div className="space-y-6">
      {invitations.length > 0 ? (
        <div className="space-y-3">
          <h2 className="font-display text-[1.3rem] text-ink-900">Join a team</h2>
          <p className="text-[13px] text-stone-500">
            Classmates want you in their team. Accept one to join it; the others are declined for you.
          </p>
          {invitations.map((inv) => (
            <InvitationCard key={inv.id} invitation={inv} onAnswered={() => void onDone()} />
          ))}
          <p className="pt-2 text-[13px] text-stone-500">Or start your own team below.</p>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-6" noValidate>
        {/* ------------------------------- team ------------------------------- */}
        <Card>
          <CardHeader
            title="1 · Your team"
            description="2 or 3 students. Send each teammate a request: they must have signed up on PACE, and they join once they accept."
          />
          <CardBody className="space-y-5">
            <Field label="Project title" htmlFor="gs-title">
              <Input
                id="gs-title"
                value={group?.projectTitle ?? title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={groupId != null}
              />
            </Field>

            <div className="space-y-2.5">
              <p className="text-[12px] font-medium tracking-wide text-stone-500 uppercase">Team</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_12rem_9rem]">
                <div className="flex items-center gap-2 rounded-lg bg-ivory-100/80 px-3 py-2 text-sm text-ink-900">
                  <Crown className="size-3.5 text-gold-500" aria-hidden />
                  {student.fullName}
                  <span className="text-[12px] text-stone-500">· Team lead</span>
                </div>
                <div className="tnum rounded-lg bg-ivory-100/80 px-3 py-2 text-sm text-ink-900">{student.registrationNumber}</div>
              </div>
              {joined.map((m) => (
                <TeamRow key={m.studentId} name={m.fullName} registrationNumber={m.registrationNumber}>
                  <Badge tone="sage" dot>Joined</Badge>
                </TeamRow>
              ))}
              {[...pending, ...declined].map((i) => (
                <TeamRow key={i.id} name={i.fullName} registrationNumber={i.registrationNumber}>
                  {i.status === "pending" ? (
                    <>
                      <Badge tone="gold" dot>Request sent</Badge>
                      <button
                        type="button"
                        onClick={() => void withdraw(i)}
                        className="text-[12px] text-stone-400 hover:text-clay-500"
                      >
                        Withdraw
                      </button>
                    </>
                  ) : (
                    <Badge tone="clay">Declined</Badge>
                  )}
                </TeamRow>
              ))}
              {room > 0 ? (
                <div className="grid items-center gap-2 sm:grid-cols-[1fr_12rem_9rem]">
                  <Input
                    value={mate.fullName}
                    onChange={(e) => setMate({ ...mate, fullName: e.target.value })}
                    onKeyDown={sendOnEnter}
                    placeholder="Teammate's name"
                    aria-label="Teammate's name"
                  />
                  <Input
                    value={mate.registrationNumber}
                    onChange={(e) => setMate({ ...mate, registrationNumber: e.target.value })}
                    onKeyDown={sendOnEnter}
                    inputMode="numeric"
                    placeholder="Registration no."
                    aria-label="Teammate's registration number"
                  />
                  <Button type="button" size="sm" variant="secondary" loading={sending} onClick={() => void sendRequest()}>
                    <UserPlus className="size-3.5" />
                    Send request
                  </Button>
                </div>
              ) : null}
              {teamError ? <p role="alert" className="text-[13px] text-clay-500">{teamError}</p> : null}
            </div>
          </CardBody>
        </Card>

        {/* ------------------------------ mentor ------------------------------ */}
        {/* Lifted above the next card so the name suggestions can overlap it. */}
        <Card className="relative z-10 overflow-visible">
          <CardHeader title="2 · Your mentor" description="The teacher who agreed to mentor your team and signed your application." />
          <CardBody>
            <MentorPicker idPrefix="gs" value={teacher} onChange={setTeacher} />
          </CardBody>
        </Card>

        {/* ---------------------------- application ---------------------------- */}
        <Card>
          <CardHeader title="3 · Signed application" />
          <CardBody className="space-y-5">
            <Field label="Signed application" htmlFor="gs-form">
              <FileDrop
                id="gs-form"
                files={form ? [form] : []}
                onChange={(files) => setForm(files[0] ?? null)}
                accept=".pdf,image/png,image/jpeg"
                specs="PDF, or a clear scan or photo (PNG, JPG) · up to 25 MB"
                disabled={busy}
              />
            </Field>

            <Field label="Message to your mentor (optional)" htmlFor="gs-msg">
              <Textarea
                id="gs-msg"
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. We talked this afternoon. Here is my signed form, our team and project title."
              />
            </Field>

            {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
            <Button type="submit" loading={busy}>
              <Send className="size-3.5" />
              Send request{teacher ? ` to ${teacher.fullName}` : ""}
            </Button>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}

/** A teammate in the team list: name, registration number, then where they stand. */
function TeamRow({ name, registrationNumber, children }: { name: string; registrationNumber: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_12rem_9rem]">
      <div className="rounded-lg bg-white/70 px-3 py-2 text-sm text-ink-900 ring-1 ring-sand-200/70">{name}</div>
      <div className="tnum rounded-lg bg-white/70 px-3 py-2 text-sm text-ink-900 ring-1 ring-sand-200/70">{registrationNumber}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
