"use client";

import { useState, type FormEvent } from "react";
import { Crown, Send, UserCheck } from "lucide-react";

import { FacultyDirectory } from "@/components/shared/faculty-directory";
import { InvitationCard } from "@/components/student/invitation-card";
import { StudentDetailsCard } from "@/components/student/student-details-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import * as repo from "@/lib/data/repository";
import type { Faculty, GroupInvitation, Student } from "@/lib/types";

/**
 * Shown to a student who is not in a group yet: their details, then one form:
 * choose the supervisor, attach the application they signed, give the project
 * title and the team (lead plus one or two teammates), and send. Teammates are
 * invited and join once they accept; the supervisor approves the request.
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
  const [choosing, setChoosing] = useState(false);
  const [form, setForm] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [mates, setMates] = useState([
    { fullName: "", registrationNumber: "" },
    { fullName: "", registrationNumber: "" },
  ]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setMate(i: number, field: "fullName" | "registrationNumber", value: string) {
    setMates(mates.map((m, j) => (j === i ? { ...m, [field]: value } : m)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const teammates = mates
      .map((m) => ({ fullName: m.fullName.trim(), registrationNumber: m.registrationNumber.trim() }))
      .filter((m) => m.fullName || m.registrationNumber);
    if (!teacher) return setError("Choose your supervisor.");
    if (!form) return setError("Attach the application your supervisor signed.");
    if (!title.trim()) return setError("Give your project title.");
    if (teammates.length === 0) return setError("Add at least one teammate - a team has 2 or 3 students.");
    if (teammates.some((m) => !m.fullName || !m.registrationNumber)) {
      return setError("Give each teammate's name and registration number.");
    }

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
      <StudentDetailsCard student={student} />

      {invitations.length > 0 ? (
        <div className="space-y-3">
          <h2 className="font-display text-[1.3rem] text-ink-900">Invitations for you</h2>
          {invitations.map((inv) => (
            <InvitationCard key={inv.id} invitation={inv} onAnswered={() => void onDone()} />
          ))}
          <p className="text-[13px] text-stone-500">Or register your own team below.</p>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-6">
        {/* ---------------------------- supervisor ---------------------------- */}
        <Card>
          <CardHeader
            title="1 · Choose your supervisor"
            description="The teacher who agreed to mentor your team and signed your application."
            action={
              teacher && !choosing ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setChoosing(true)}>
                  Change
                </Button>
              ) : null
            }
          />
          {teacher && !choosing ? (
            <CardBody className="flex items-center gap-3 border-t border-sand-200/60">
              <Avatar name={teacher.fullName} size="md" />
              <div>
                <p className="text-[14px] font-medium text-ink-900">{teacher.fullName}</p>
                <p className="text-[12px] text-stone-500">{teacher.designation} · {teacher.department}</p>
              </div>
            </CardBody>
          ) : (
            <CardBody className="border-t border-sand-200/60">
              <FacultyDirectory
                action={(f) => (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setTeacher(f);
                      setChoosing(false);
                    }}
                  >
                    <UserCheck className="size-3.5" />
                    Choose
                  </Button>
                )}
              />
            </CardBody>
          )}
        </Card>

        {/* ------------------------- application + team ------------------------ */}
        <Card>
          <CardHeader
            title="2 · Signed application and team"
            description="A team has 2 or 3 students. Teammates get an invitation to accept."
          />
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

            <Field label="Project title" htmlFor="gs-title">
              <Input id="gs-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            <div className="space-y-2.5">
              <p className="text-[12px] font-medium tracking-wide text-stone-500 uppercase">Team</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                <div className="flex items-center gap-2 rounded-lg bg-ivory-100/80 px-3 py-2 text-sm text-ink-900">
                  <Crown className="size-3.5 text-gold-500" aria-hidden />
                  {student.fullName}
                  <span className="text-[12px] text-stone-500">· Team lead</span>
                </div>
                <div className="tnum rounded-lg bg-ivory-100/80 px-3 py-2 text-sm text-ink-900">{student.registrationNumber}</div>
              </div>
              {mates.map((m, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                  <Input
                    value={m.fullName}
                    onChange={(e) => setMate(i, "fullName", e.target.value)}
                    placeholder={i === 0 ? "Teammate's name" : "Teammate's name (optional)"}
                    aria-label={`Teammate ${i + 1} name`}
                  />
                  <Input
                    value={m.registrationNumber}
                    onChange={(e) => setMate(i, "registrationNumber", e.target.value)}
                    inputMode="numeric"
                    placeholder="Registration no."
                    aria-label={`Teammate ${i + 1} registration number`}
                  />
                </div>
              ))}
            </div>

            <Field label="Message to your supervisor" htmlFor="gs-msg" help="e.g. We talked this afternoon - submitting my form and team details with my project title.">
              <Textarea id="gs-msg" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
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
