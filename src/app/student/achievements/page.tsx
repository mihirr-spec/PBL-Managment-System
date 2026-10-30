"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, Plus, Trophy, Upload, UserPlus, X } from "lucide-react";

import { AchievementDetail, AchievementRow } from "@/components/achievements/achievement-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FileDrop } from "@/components/ui/file-drop";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ACHIEVEMENT_CATEGORIES, dummyFor, findTemplate, MAX_BONUS_MARKS, type AchievementTemplate } from "@/lib/achievements";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import type { Achievement, GroupMember, Student } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

export default function AchievementsPage() {
  const { loading, student, group } = usePortal();
  const list = useLoad(() => repo.listAchievements(), student ? student.id : null);
  // "new" opens the form for a new achievement; an id edits that one.
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading || !student) return <PageSkeleton />;

  const header = (
    <PageHeader
      eyebrow="Achievements"
      title="Your"
      emphasis="achievements."
      description={`Hackathons, papers, patents, medals, awards - file each one with proof. Your supervisor reviews it, can award up to ${MAX_BONUS_MARKS} bonus marks, and approved achievements count towards the Student Excellence Award.`}
      scene="achievements"
    />
  );

  if (!group?.mentorId) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState
            title={group ? "Waiting for your supervisor" : "Join a group first"}
            description="Your group's supervisor is the one who reviews your achievements, so you can file them once you have one."
            scene="achievements"
          />
          <div className="pb-6 text-center">
            <ButtonLink href="/student/group" size="sm">Go to my group</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const mine = (list.data ?? []).filter((a) => a.studentId === student.id);
  // Achievements a classmate filed and added this student to.
  const withMe = (list.data ?? []).filter((a) => a.studentId !== student.id);
  const approved = mine.filter((a) => a.status === "approved");
  const bonus = approved.reduce((n, a) => n + (a.bonusMarks ?? 0), 0);
  const editingAchievement = editing && editing !== "new" ? mine.find((a) => a.id === editing) : undefined;
  const opened = (list.data ?? []).find((a) => a.id === openId);

  if (editing) {
    return (
      <div className="space-y-6">
        {header}
        <AchievementForm
          student={student}
          teammates={group.members.filter((m) => m.studentId !== student.id)}
          existing={editingAchievement}
          onCancel={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setOpenId(null);
            setNotice(message);
            void list.reload();
          }}
        />
      </div>
    );
  }

  if (opened) {
    const own = opened.studentId === student.id;
    return (
      <AchievementDetail
        achievement={opened}
        viewer="student"
        student={own ? student : undefined}
        onBack={() => setOpenId(null)}
        onChanged={() => void list.reload()}
        onEdit={own ? () => { setNotice(null); setEditing(opened.id); } : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => { setNotice(null); setEditing("new"); }}>
          <Plus className="size-4" />
          Add an achievement
        </Button>
        {mine.length > 0 ? (
          <p className="text-[13px] text-stone-500">
            {approved.length} approved of {mine.length} · <span className="tnum font-medium text-ink-800">+{bonus}</span> bonus marks
          </p>
        ) : null}
      </div>

      {notice ? <p role="status" className="text-[13px] text-sage-500">{notice}</p> : null}

      <Card>
        <CardHeader title="Filed achievements" description="Newest first. You'll be notified when your supervisor responds." />
        {list.error ? (
          <CardBody><p role="alert" className="text-[13px] text-clay-500">{list.error}</p></CardBody>
        ) : !list.data ? (
          <CardBody><p className="text-[13px] text-stone-500">Loading…</p></CardBody>
        ) : mine.length === 0 ? (
          <EmptyState
            icon={<Trophy className="size-5" />}
            title="Nothing filed yet"
            description="Won something, published something, represented MUJ? Add it with a certificate or proof."
            scene="achievements"
          />
        ) : (
          <div className="divide-y divide-azure-100/70">
            {mine.map((a) => (
              <AchievementRow key={a.id} achievement={a} viewer="student" onOpen={() => setOpenId(a.id)} />
            ))}
          </div>
        )}
      </Card>

      {withMe.length > 0 ? (
        <Card>
          <CardHeader title="Achievements you're part of" description="Filed by a classmate who added you. You're told when it's reviewed and posted." />
          <div className="divide-y divide-azure-100/70">
            {withMe.map((a) => (
              <AchievementRow key={a.id} achievement={a} viewer="reviewer" onOpen={() => setOpenId(a.id)} />
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

/** Someone outside the team, as typed into the form. */
interface OutsidePerson {
  key: number;
  name: string;
  registrationNumber: string;
  linkedin: string;
}

/**
 * Pick a category and template, answer its questions, say who achieved it
 * with you, attach proof. Also used to resubmit.
 */
function AchievementForm({
  student,
  teammates,
  existing,
  onCancel,
  onDone,
}: {
  student: Student;
  teammates: GroupMember[];
  existing?: Achievement;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const studentId = student.id;
  const initial = existing ? findTemplate(existing.category, existing.template) : null;
  const [myLinkedin, setMyLinkedin] = useState(existing?.linkedin || student.linkedin || "");
  // Teammates who were part of it, each with their LinkedIn profile.
  const [withMates, setWithMates] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (existing?.participants ?? [])
        .filter((p) => p.inTeam && p.studentId)
        .map((p) => [p.studentId!, p.linkedin]),
    ),
  );
  const [outside, setOutside] = useState<OutsidePerson[]>(() =>
    (existing?.participants ?? [])
      .filter((p) => !p.inTeam)
      .map((p, i) => ({ key: i, name: p.name, registrationNumber: p.registrationNumber, linkedin: p.linkedin })),
  );
  const [categoryKey, setCategoryKey] = useState<string | null>(existing?.category ?? null);
  const [template, setTemplate] = useState<AchievementTemplate | null>(initial?.template ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>(existing?.answers ?? {});
  const [title, setTitle] = useState(existing?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(Boolean(existing));
  const [description, setDescription] = useState(existing?.description ?? "");
  const [achievedOn, setAchievedOn] = useState(existing?.achievedOn ?? "");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = ACHIEVEMENT_CATEGORIES.find((c) => c.key === categoryKey);

  function answer(key: string, value: string) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (!titleTouched && template) setTitle(template.title(next));
  }

  /** Fills the template's fields with plausible prototype data, a proof
   *  placeholder, and the generated title - for demonstrating the portal. */
  function fillDummy(t: AchievementTemplate) {
    const dummy = dummyFor(t);
    if (!dummy) return;
    setTemplate(t);
    setTitleTouched(false);
    setTitle(t.title(dummy.answers));
    setAnswers({ ...dummy.answers });
    setDescription(dummy.description);
    setAchievedOn(dummy.date);
    const name = `dummy-proof-${t.key}.txt`;
    setFiles([
      new File(
        [
          `Placeholder proof document for the demo achievement "${t.label}".\n\n` +
            `In the real portal this would be a certificate, results page or screenshot.\n`,
        ],
        name,
        { type: "text/plain" },
      ),
    ]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!template || !categoryKey) return;
    const missing = template.fields.find((f) => !f.optional && !(answers[f.key] ?? "").trim());
    if (missing) {
      setError(`Fill in “${missing.label}”.`);
      return;
    }
    if (!existing && files.length === 0) {
      setError("Attach at least one supporting document - a certificate, letter, results page or screenshot.");
      return;
    }
    const people = outside.filter((p) => p.name.trim() || p.registrationNumber.trim() || p.linkedin.trim());
    if (people.some((p) => !p.name.trim())) {
      setError("Give the name of everyone you add from outside your team.");
      return;
    }
    setBusy(true);
    setError(null);
    const clean = Object.fromEntries(
      template.fields.map((f) => [f.key, (answers[f.key] ?? "").trim()]).filter(([, v]) => v),
    );
    const participants = [
      ...teammates
        .filter((m) => m.studentId in withMates)
        .map((m) => ({ name: m.fullName, registrationNumber: m.registrationNumber, linkedin: withMates[m.studentId] ?? "" })),
      ...people.map(({ name, registrationNumber, linkedin }) => ({ name, registrationNumber, linkedin })),
    ];
    const input = {
      title: title.trim() || template.title(clean),
      description: description.trim(),
      answers: clean,
      achievedOn,
      linkedin: myLinkedin,
      participants,
    };
    try {
      if (existing) {
        await repo.updateAchievement(studentId, existing.id, { ...input, files, note: note.trim() });
        onDone("Updated and sent back to your supervisor.");
      } else {
        await repo.submitAchievement(studentId, { ...input, category: categoryKey, template: template.key, files });
        onDone("Achievement submitted - your supervisor has been notified.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the achievement.");
    } finally {
      setBusy(false);
    }
  }

  // Step 1: category.
  if (!category) {
    return (
      <Card>
        <CardHeader
          title="What kind of achievement?"
          action={<Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          {ACHIEVEMENT_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategoryKey(c.key)}
              className="rounded-[14px] bg-white/65 p-4 text-left ring-1 ring-white transition-colors hover:bg-white hover:ring-azure-100"
            >
              <p className="font-display text-[15.5px] text-ink-900">{c.label}</p>
              <p className="mt-1 text-[12.5px] text-stone-500">{c.blurb}</p>
            </button>
          ))}
        </CardBody>
      </Card>
    );
  }

  // Step 2: template within the category.
  if (!template) {
    return (
      <Card>
        <CardHeader
          title={category.label}
          description="Pick the one that fits best."
          action={
            <Button size="sm" variant="ghost" onClick={() => setCategoryKey(null)}>
              <ArrowLeft className="size-3.5" /> Back
            </Button>
          }
        />
        <CardBody className="grid gap-3">
          {category.templates.map((t) => {
            const hasDummy = !!dummyFor(t);
            return (
              <div key={t.key} className="rounded-[14px] bg-white/65 p-4 ring-1 ring-white transition-colors hover:ring-azure-100">
                <button
                  type="button"
                  onClick={() => { setTemplate(t); setTitle(""); setTitleTouched(false); }}
                  className="block w-full text-left"
                >
                  <p className="font-medium text-ink-900">{t.label}</p>
                  <p className="mt-0.5 text-[12.5px] text-stone-500">{t.hint}</p>
                </button>
                {hasDummy ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mt-2.5"
                    onClick={() => fillDummy(t)}
                  >
                    Fill in dummy details
                  </Button>
                ) : null}
              </div>
            );
          })}
        </CardBody>
      </Card>
    );
  }

  // Step 3: the template's questions.
  return (
    <Card>
      <CardHeader
        title={existing ? "Update your achievement" : template.label}
        description={`${category.label} - these are the details MUJ states when it announces an achievement.`}
        action={
          existing ? (
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setTemplate(null)}>
              <ArrowLeft className="size-3.5" /> Back
            </Button>
          )
        }
      />
      <CardBody>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {template.fields.map((f) => (
              <Field
                key={f.key}
                label={f.optional ? `${f.label} (optional)` : f.label}
                htmlFor={`f-${f.key}`}
                className={cn(f.long && "sm:col-span-2")}
              >
                {f.long ? (
                  <Textarea id={`f-${f.key}`} rows={2} value={answers[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => answer(f.key, e.target.value)} />
                ) : (
                  <Input id={`f-${f.key}`} value={answers[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => answer(f.key, e.target.value)} />
                )}
              </Field>
            ))}
            <Field label="Date of the achievement" htmlFor="f-date">
              <Input id="f-date" type="date" value={achievedOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setAchievedOn(e.target.value)} />
            </Field>
          </div>

          <Field label="Title" htmlFor="f-title" help="Filled in from your answers - edit it if you like.">
            <Input id="f-title" value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
          </Field>

          <Field label="What did you do?" htmlFor="f-desc" help="Your contribution in your own words - what you built, how you prepared, what it took.">
            <Textarea id="f-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <fieldset className="grid gap-4 rounded-2xl bg-azure-50/50 p-4 ring-1 ring-azure-100">
            <legend className="px-1 text-[14px] font-semibold text-ink-900">Who achieved this?</legend>
            <p className="-mt-2 text-[12.5px] text-slate-500">
              Add only the people who were part of this achievement. They are told when it is reviewed and posted;
              if you add nobody, only you are. LinkedIn profiles are listed in the LinkedIn post.
            </p>

            <Field label="Your LinkedIn profile (optional)" htmlFor="f-my-linkedin" help="linkedin.com/in/your-name - remembered for next time.">
              <Input id="f-my-linkedin" value={myLinkedin} placeholder="linkedin.com/in/your-name" onChange={(e) => setMyLinkedin(e.target.value)} />
            </Field>

            {teammates.length > 0 ? (
              <div className="grid gap-2">
                <p className="text-[13px] font-medium text-ink-800">From your team</p>
                {teammates.map((m) => {
                  const picked = m.studentId in withMates;
                  return (
                    <div key={m.studentId} className={cn("rounded-xl bg-white/80 px-3 py-2.5 ring-1", picked ? "ring-azure-500/50" : "ring-white")}>
                      <label className="flex cursor-pointer items-center gap-3 text-[13.5px] text-ink-900">
                        <input
                          type="checkbox"
                          checked={picked}
                          onChange={(e) =>
                            setWithMates((cur) => {
                              const next = { ...cur };
                              if (e.target.checked) next[m.studentId] = m.linkedin ?? "";
                              else delete next[m.studentId];
                              return next;
                            })
                          }
                          className="size-4 accent-azure-600"
                        />
                        <span className="font-medium">{m.fullName}</span>
                        <span className="text-[12px] text-slate-500">{m.registrationNumber}</span>
                      </label>
                      {picked ? (
                        <Input
                          className="mt-2"
                          aria-label={`${m.fullName}'s LinkedIn profile`}
                          value={withMates[m.studentId] ?? ""}
                          placeholder={`${m.fullName}'s LinkedIn (optional)`}
                          onChange={(e) => setWithMates((cur) => ({ ...cur, [m.studentId]: e.target.value }))}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="grid gap-2">
              <p className="text-[13px] font-medium text-ink-800">From outside your team</p>
              {outside.map((p) => (
                <div key={p.key} className="grid gap-2 rounded-xl bg-white/80 p-3 ring-1 ring-white sm:grid-cols-[1fr_9rem_1fr_auto]">
                  <Input aria-label="Name" placeholder="Full name" value={p.name} onChange={(e) => setOutside((cur) => cur.map((x) => (x.key === p.key ? { ...x, name: e.target.value } : x)))} />
                  <Input aria-label="Registration number" placeholder="Reg. no. (optional)" value={p.registrationNumber} onChange={(e) => setOutside((cur) => cur.map((x) => (x.key === p.key ? { ...x, registrationNumber: e.target.value } : x)))} />
                  <Input aria-label="LinkedIn profile" placeholder="LinkedIn (optional)" value={p.linkedin} onChange={(e) => setOutside((cur) => cur.map((x) => (x.key === p.key ? { ...x, linkedin: e.target.value } : x)))} />
                  <Button type="button" size="sm" variant="ghost" aria-label="Remove" onClick={() => setOutside((cur) => cur.filter((x) => x.key !== p.key))}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setOutside((cur) => [...cur, { key: Date.now(), name: "", registrationNumber: "", linkedin: "" }])}
                >
                  <UserPlus className="size-3.5" />
                  Add someone outside your team
                </Button>
              </div>
              <p className="text-[12px] text-slate-500">With an MUJ registration number, a student on the portal is told too.</p>
            </div>
          </fieldset>

          <Field label={existing ? "Add more documents (optional)" : "Supporting documents"} htmlFor="f-files">
            <FileDrop
              id="f-files"
              multiple
              files={files}
              onChange={setFiles}
              accept=".pdf,.doc,.docx,.ppt,.pptx,image/png,image/jpeg,image/webp"
              specs="Certificates, letters, results pages, screenshots · PDF, images, Word or PowerPoint · up to 15 MB each"
              disabled={busy}
            />
          </Field>

          {existing ? (
            <Field label="Note to your supervisor" htmlFor="f-note">
              <Textarea id="f-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Added the certificate and the proceedings link." />
            </Field>
          ) : null}

          {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy}>
              <Upload className="size-4" />
              {existing ? "Resubmit for review" : "Submit for review"}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
