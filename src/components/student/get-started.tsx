"use client";

import { useState, type FormEvent } from "react";
import { Crown, Send, UserPlus, X } from "lucide-react";

import { InvitationCard } from "@/components/student/invitation-card";
import { MentorPicker } from "@/components/student/mentor-picker";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import * as repo from "@/lib/data/repository";
import type { Faculty, GroupInvitation, Student } from "@/lib/types";

/** A team is the lead plus one or two teammates. */
const MAX_TEAMMATES = 2;

/**
 * Shown to a student who is not in a group yet. Invitations from classmates
 * come first (joining a team ends here). Otherwise one form: the team (project
 * title, then teammates, added one at a time), the mentor (department, then
 * teacher), and the application they signed. Teammates are invited and join
 * once they accept; the mentor approves the request.
 */
export function GetStarted({
  student,
  invitations,
  onDone,
}: {
  student: Student;
  invitations: GroupInvitation[];
  onDone: () => Promise<void> | void;
}) {
  const [teacher, setTeacher] = useState<Faculty | null>(null);
  const [form, setForm] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [mates, setMates] = useState([{ fullName: "", registrationNumber: "" }]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setMate(i: number, field: "fullName" | "registrationNumber", value: string) {
    setMates(mates.map((m, j) => (j === i ? { ...m, [field]: value } : m)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const teammates = mates.map((m) => ({ fullName: m.fullName.trim(), registrationNumber: m.registrationNumber.trim() }));
    if (!title.trim()) return setError("Give your project title.");
    if (teammates.some((m) => !m.fullName || !m.registrationNumber)) {
      return setError("Give each teammate's name and registration number, or remove the empty row.");
    }
    if (!teacher) return setError("Choose your mentor: pick the department, then the teacher.");
    if (!form) return setError("Attach the application your mentor signed.");

    setBusy(true);
    let groupId: string;
    try {
      groupId = await repo.createGroup({
        name: `${student.fullName.split(" ")[0]}'s team`,
        projectTitle: title.trim(),
        projectIdea: "",
        domain: "",
        teammates,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the team.");
      setBusy(false);
      return;
    }
    try {
      await repo.requestMentor({ groupId, facultyId: teacher.id, message: message.trim(), form });
    } catch {
      // The team exists; the group page lets the lead send the form again.
    }
    await onDone();
  }

  return (
    <div className="space-y-6">
      {invitations.length > 0 ? (
        <div className="space-y-3">
          <h2 className="font-display text-[1.3rem] text-ink-900">Join a team</h2>
          <p className="text-[13px] text-stone-500">A classmate has added you to their team. Accept to join it.</p>
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
            description="2 or 3 students. Each teammate gets an invitation when they sign in, and joins once they accept."
          />
          <CardBody className="space-y-5">
            <Field label="Project title" htmlFor="gs-title">
              <Input id="gs-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            <div className="space-y-2.5">
              <p className="text-[12px] font-medium tracking-wide text-stone-500 uppercase">Team</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_12rem_2rem]">
                <div className="flex items-center gap-2 rounded-lg bg-ivory-100/80 px-3 py-2 text-sm text-ink-900">
                  <Crown className="size-3.5 text-gold-500" aria-hidden />
                  {student.fullName}
                  <span className="text-[12px] text-stone-500">· Team lead</span>
                </div>
                <div className="tnum rounded-lg bg-ivory-100/80 px-3 py-2 text-sm text-ink-900">{student.registrationNumber}</div>
              </div>
              {mates.map((m, i) => (
                <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_12rem_2rem]">
                  <Input
                    value={m.fullName}
                    onChange={(e) => setMate(i, "fullName", e.target.value)}
                    placeholder={`Teammate ${i + 1} name`}
                    aria-label={`Teammate ${i + 1} name`}
                  />
                  <Input
                    value={m.registrationNumber}
                    onChange={(e) => setMate(i, "registrationNumber", e.target.value)}
                    inputMode="numeric"
                    placeholder="Registration no."
                    aria-label={`Teammate ${i + 1} registration number`}
                  />
                  {i > 0 ? (
                    <button
                      type="button"
                      onClick={() => setMates(mates.filter((_, j) => j !== i))}
                      aria-label={`Remove teammate ${i + 1}`}
                      className="justify-self-start rounded-md p-1.5 text-stone-400 hover:bg-clay-100 hover:text-clay-500"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              {mates.length < MAX_TEAMMATES ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setMates([...mates, { fullName: "", registrationNumber: "" }])}
                >
                  <UserPlus className="size-3.5" />
                  Add teammate
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {/* ------------------------------ mentor ------------------------------ */}
        <Card>
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
