"use client";

import { useState, type FormEvent } from "react";
import { ArrowRightLeft, Award, ChevronDown, Crown, Eye, FileText, Info, Mail, MessageCircleQuestion, Save, Trophy } from "lucide-react";

import { FileChips } from "@/components/shared/file-link";
import { ReportProgress, TimelineItem, type TimelineState } from "@/components/shared/timeline";
import { RichEditor } from "@/components/shared/rich-editor";
import { GradingPlanCard } from "@/components/staff/grading-plan";
import { QueryList } from "@/components/shared/queries";
import { ChangeSupervisorForm, SupervisorHistory } from "@/components/staff/supervisor-change";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session";
import * as repo from "@/lib/data/repository";
import type { Achievement, Group, GroupGrade, GroupMilestone, StudentGrade, WeeklyReport } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { RichText, plainText } from "@/components/shared/rich-text";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

async function loadGroupDetail(groupId: string) {
  const group = await repo.getGroup(groupId);
  if (!group) throw new Error("This group does not exist or is not visible to you.");
  const [mentor, reports, grades, tickets, changes, milestones, groupGrade, weeklyAverage, allAchievements] = await Promise.all([
    repo.getFaculty(group.mentorId),
    repo.listReports(group.id),
    repo.listGrades(group.members.map((m) => m.studentId)),
    repo.listTickets(group.id),
    repo.listSupervisorChanges(group.id),
    repo.listMilestones(group.id),
    repo.getGroupGrade(group.id),
    repo.weeklyAverage(group.id),
    repo.listAchievements(),
  ]);
  const studentIds = new Set(group.members.map((m) => m.studentId));
  const achievements = allAchievements.filter((a) => studentIds.has(a.studentId));
  return { group, mentor, reports, grades, tickets, changes, milestones, groupGrade, weeklyAverage, achievements };
}

/**
 * Everything about one team, for its supervisor and the PBL office. Only the
 * supervisor grades and sets the report count; the PBL office (`isAdmin`) sees
 * it read-only and can move the group to another supervisor.
 */
export function GroupDetail({ groupId, isAdmin = false }: { groupId: string; isAdmin?: boolean }) {
  const { user } = useSession();
  const [changing, setChanging] = useState(false);
  const { data, error, reload } = useLoad(() => loadGroupDetail(groupId), groupId);

  if (error) return <Card><EmptyState title="Could not load this group" description={error} /></Card>;
  if (!data) return <PageSkeleton />;

  const { group, mentor, reports, grades, tickets, changes, milestones, groupGrade, weeklyAverage, achievements } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Group ${group.number}`}
        title={group.projectTitle}
        description={`${group.name} · ${group.domain || "No domain set"} · Supervisor: ${mentor?.fullName ?? "not assigned"}`}
        scene="team"
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Project description" description="Written by the team lead." />
          <CardBody className="space-y-4">
            {group.projectIdea ? (
              <RichText text={group.projectIdea} className="text-[14px]" />
            ) : (
              <p className="text-[14px] text-stone-600">The team has not described its project yet.</p>
            )}
            <div className="max-w-sm">
              <div className="mb-1 flex justify-between text-[12px] text-stone-500">
                <span>Progress</span>
                <span className="tnum font-medium text-ink-800">{group.progress}%</span>
              </div>
              <ProgressBar value={group.progress} label="Group progress" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="At a glance" />
          <CardBody className="space-y-2 text-[13px] text-stone-600">
            <p><span className="tnum font-semibold text-ink-900">{group.members.length}</span> students</p>
            <p><span className="tnum font-semibold text-ink-900">{reports.length}</span> weekly reports · {reports.filter((r) => r.grade == null).length} awaiting grade</p>
            <p><span className="tnum font-semibold text-ink-900">{tickets.filter((t) => t.status === "open").length}</span> open queries</p>
            {group.assignedAt ? <p>Supervising since {formatDateTime(group.assignedAt)}</p> : null}
          </CardBody>
        </Card>
      </div>

      {/* -------------------------- supervisor --------------------------- */}
      {isAdmin || changes.length > 0 ? (
        <Card>
          <CardHeader
            title="Supervisor"
            description={
              mentor
                ? `Currently ${mentor.fullName}${changes.length > 0 ? ` · changed ${changes.length} time${changes.length > 1 ? "s" : ""}` : ""}`
                : "No supervisor yet"
            }
            action={
              isAdmin && !changing ? (
                <Button size="sm" variant="secondary" onClick={() => setChanging(true)}>
                  <ArrowRightLeft className="size-3.5" />
                  Change supervisor
                </Button>
              ) : null
            }
          />
          {isAdmin && changing ? (
            <div className="px-5 pb-4">
              <ChangeSupervisorForm
                groupId={group.id}
                currentMentorId={group.mentorId}
                onDone={() => {
                  setChanging(false);
                  void reload();
                }}
              />
              <button type="button" onClick={() => setChanging(false)} className="mt-2 text-[12.5px] text-stone-500 hover:text-ink-800">
                Cancel
              </button>
            </div>
          ) : null}
          {changes.length > 0 ? <SupervisorHistory changes={changes} /> : null}
        </Card>
      ) : null}

      {/* --------------------------- students --------------------------- */}
      <Card>
        <CardHeader
          title="Students"
          description={isAdmin ? "Grades given by the supervisor." : "Grade individuals and note what each should improve."}
        />
        <ul className="divide-y divide-sand-200/70">
          {group.members.map((m) => (
            <StudentRow
              key={m.studentId}
              member={m}
              isLeader={m.studentId === group.leaderStudentId}
              grades={grades.filter((g) => g.studentId === m.studentId)}
              canGrade={!isAdmin}
              onGraded={reload}
            />
          ))}
        </ul>
      </Card>

      {/* ------------------------- weekly reports ------------------------ */}
      <GradingPlanCard
        groupId={group.id}
        milestones={milestones}
        grade={groupGrade}
        weeklyAverage={weeklyAverage}
        canGrade={!isAdmin}
      />
      <PerStudentFinals
        group={group}
        grade={groupGrade}
        weeklyAverage={weeklyAverage}
        achievements={achievements}
        canEdit={!isAdmin}
        onSaved={reload}
      />
      <Card>
        <CardHeader
          title="Weekly reports"
          description={`${reports.filter((r) => r.week <= group.reportCount).length} of ${group.reportCount} submitted. ${
            isAdmin ? "Graded out of 10 by the supervisor." : "Grade out of 10 with feedback - students are notified."
          }`}
          action={isAdmin ? null : <ReportCountPicker groupId={group.id} value={group.reportCount} onChanged={reload} />}
        />
        <ReportTimeline
          weeks={group.reportCount}
          reports={reports}
          milestones={milestones}
          grade={groupGrade}
          groupId={group.id}
          canGrade={!isAdmin}
          onSaved={reload}
          row={(week, r) => <WeekRow key={week} week={week} report={r} canGrade={!isAdmin} onGraded={reload} />}
        />
      </Card>

      {/* ----------------------------- queries ---------------------------- */}
      <Card>
        <CardHeader title="Queries from this group" />
        {tickets.length === 0 ? (
          <EmptyState icon={<MessageCircleQuestion className="size-5" />} title="No queries raised" scene="queries" />
        ) : (
          <QueryList queries={tickets} canReply={!isAdmin} viewerFacultyId={user?.profileId} onChanged={reload} />
        )}
      </Card>
    </div>
  );
}

function StudentRow({
  member,
  isLeader,
  grades,
  canGrade,
  onGraded,
}: {
  member: Group["members"][number];
  isLeader: boolean;
  grades: StudentGrade[];
  canGrade: boolean;
  onGraded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [max, setMax] = useState("10");
  const [improvements, setImprovements] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await repo.gradeStudent({
        studentId: member.studentId,
        title: title.trim() || "Assessment",
        score: Number(score),
        maxScore: Number(max) || 10,
        improvements: improvements.trim(),
      });
      setTitle("");
      setScore("");
      setImprovements("");
      setOpen(false);
      onGraded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the grade.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={member.fullName} src={member.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[14px] font-medium text-ink-900">
            {member.fullName}
            {isLeader ? <Crown className="size-3.5 text-gold-500" aria-label="Team leader" /> : null}
          </p>
          <p className="tnum text-[12px] text-stone-500">
            {member.registrationNumber} · {member.teamRole || "Member"}
          </p>
          {member.email ? (
            <p className="flex items-center gap-1 text-[12px] text-stone-500">
              <Mail className="size-3" /> {member.email}
            </p>
          ) : null}
        </div>
        {canGrade ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            <Award className="size-3.5" />
            {open ? "Cancel" : "Give grade"}
          </Button>
        ) : null}
      </div>

      {grades.length > 0 ? (
        <ul className="mt-3 space-y-2.5 pl-[3.25rem]">
          {grades.map((g) => (
            <EditableGrade
              key={g.id}
              grade={g}
              canGrade={canGrade}
              onChanged={onGraded}
            />
          ))}
        </ul>
      ) : null}

      {canGrade && open ? (
        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-[14px] bg-white/60 p-4 sm:grid-cols-[1fr_6rem_6rem]">
          <Field label="What is this grade for?" htmlFor={`t-${member.studentId}`}>
            <Input id={`t-${member.studentId}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Review II presentation" />
          </Field>
          <Field label="Score" htmlFor={`s-${member.studentId}`}>
            <Input id={`s-${member.studentId}`} type="number" min={0} step="0.5" required value={score} onChange={(e) => setScore(e.target.value)} />
          </Field>
          <Field label="Out of" htmlFor={`m-${member.studentId}`}>
            <Input id={`m-${member.studentId}`} type="number" min={1} step="1" value={max} onChange={(e) => setMax(e.target.value)} />
          </Field>
          <Field label="Improvements to make" htmlFor={`i-${member.studentId}`} className="sm:col-span-3">
            <Textarea id={`i-${member.studentId}`} rows={2} value={improvements} onChange={(e) => setImprovements(e.target.value)} />
          </Field>
          {error ? <p role="alert" className="text-[12.5px] text-clay-500 sm:col-span-3">{error}</p> : null}
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" loading={busy}>Save grade</Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/** One saved mark; the group's supervisor can correct the score or the note. */
function EditableGrade({
  grade,
  canGrade,
  onChanged,
}: {
  grade: StudentGrade;
  canGrade: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(String(grade.score));
  const [improvements, setImprovements] = useState(grade.improvements);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await repo.updateStudentGrade(grade.id, Number(score), improvements.trim());
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the change.");
      setBusy(false);
    }
  }

  if (!canGrade || !editing) {
    return (
      <li className="group text-[12.5px] text-stone-600">
        <span className="tnum font-semibold text-ink-900">{grade.score}/{grade.maxScore}</span>
        <span className="font-medium text-ink-800"> · {grade.title}</span>
        {grade.improvements ? <span className="text-stone-500"> - {grade.improvements}</span> : null}
        {canGrade ? (
          <button
            type="button"
            onClick={() => {
              setScore(String(grade.score));
              setImprovements(grade.improvements);
              setEditing(true);
            }}
            className="ml-2 text-[11.5px] font-medium text-azure-600 opacity-0 transition-opacity group-hover:opacity-100"
          >
            Edit
          </button>
        ) : null}
      </li>
    );
  }

  return (
    <li className="mt-1">
      <form onSubmit={save} className="grid gap-2.5 rounded-[12px] bg-white/70 p-3 ring-1 ring-sand-200">
        <div className="grid gap-2.5 sm:grid-cols-[7rem_1fr]">
          <Field label={`Score / ${grade.maxScore}`} htmlFor={`sg-${grade.id}`}>
            <Input
              id={`sg-${grade.id}`}
              type="number"
              min={0}
              max={grade.maxScore}
              step="0.5"
              required
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </Field>
          <Field label="Improvements to make" htmlFor={`si-${grade.id}`}>
            <Textarea
              id={`si-${grade.id}`}
              rows={2}
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
            />
          </Field>
        </div>
        {error ? <p role="alert" className="text-[12px] text-clay-500 sm:col-span-2">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={busy}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      </form>
    </li>
  );
}

/** How many weekly reports the group owes: 5 or 6. */
/**
 * The supervisor's view of the weekly reports: the same timeline and progress
 * bar the students see, with the midterm after week 3 and the endterm last.
 */
function ReportTimeline({
  weeks,
  reports,
  milestones,
  row,
  grade,
  groupId,
  canGrade,
  onSaved,
}: {
  weeks: number;
  reports: WeeklyReport[];
  milestones: GroupMilestone[];
  row: (week: number, report: WeeklyReport | undefined) => React.ReactNode;
  grade: import("@/lib/types").GroupGrade | null;
  groupId: string;
  canGrade: boolean;
  onSaved: () => void;
}) {
  const files = (a: string, b: string) => milestones.filter((m) => m.slot === a || m.slot === b).flatMap((m) => m.files);
  const mid = files("mid_ppt", "mid_synopsis");
  const ete = files("ete_ppt", "ete_synopsis");
  const submitted = reports.filter((r) => r.week <= weeks).length;
  const total = weeks + 2;

  const stops: Array<{ key: string; state: TimelineState; milestone?: boolean; node: React.ReactNode }> = [];
  for (let week = 1; week <= weeks; week++) {
    const r = reports.find((x) => x.week === week);
    stops.push({ key: `w${week}`, state: !r ? "pending" : r.grade != null ? "evaluated" : "submitted", node: row(week, r) });
    if (week === 3) {
      stops.push({
        key: "mid",
        milestone: true,
        state: grade?.synopsis1 != null ? "evaluated" : mid.length ? "submitted" : "pending",
        node: (
          <PhaseFiles
            phase="mid"
            title="Midterm (MTE)"
            files={mid}
            grade={grade}
            groupId={groupId}
            canGrade={canGrade}
            onSaved={onSaved}
          />
        ),
      });
    }
  }
  stops.push({
    key: "ete",
    milestone: true,
    state: grade?.ete40 != null ? "evaluated" : ete.length ? "submitted" : "pending",
    node: (
      <PhaseFiles
        phase="ete"
        title="Endterm (ETE)"
        files={ete}
        grade={grade}
        groupId={groupId}
        canGrade={canGrade}
        onSaved={onSaved}
      />
    ),
  });

  return (
    <div className="space-y-3 p-4 sm:p-5">
      <ReportProgress done={submitted + (mid.length ? 1 : 0) + (ete.length ? 1 : 0)} total={total} />
      {stops.map((s, i) => (
        <TimelineItem key={s.key} state={s.state} milestone={s.milestone} last={i === stops.length - 1}>
          {s.node}
        </TimelineItem>
      ))}
    </div>
  );
}

/**
 * A midterm or endterm stop: the PPT, project report and synopsis the team
 * uploaded, with an Evaluate panel the supervisor opens to score that phase.
 * Midterm scores the synopsis (/10) and the midterm PPT half (saved as half of
 * `ppt15`). Endterm scores the synopsis (/10), the endterm PPT half, Design &
 * Implementation (/20) and the End Term Exam (/40).
 */
function PhaseFiles({
  phase,
  title,
  files,
  grade,
  groupId,
  canGrade,
  onSaved,
}: {
  phase: "mid" | "ete";
  title: string;
  files: Array<{ path: string; name: string }>;
  grade: import("@/lib/types").GroupGrade | null;
  groupId: string;
  canGrade: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedPpt = phase === "mid" ? grade?.pptMid : grade?.pptEnd;
  const [synopsis, setSynopsis] = useState<string>(
    phase === "mid"
      ? (grade?.synopsis1 != null ? String(grade.synopsis1) : "")
      : (grade?.synopsis2 != null ? String(grade.synopsis2) : ""),
  );
  const [ppt, setPpt] = useState<string>(savedPpt != null ? String(savedPpt) : "");
  const [design, setDesign] = useState<string>(grade?.design20 != null ? String(grade.design20) : "");
  const [ete, setEte] = useState<string>(grade?.ete40 != null ? String(grade.ete40) : "");

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const n = (s: string) => (s.trim() === "" ? null : Number(s));
      await repo.saveGroupGrades(groupId, {
        synopsis1: phase === "mid" ? n(synopsis) : (grade?.synopsis1 ?? null),
        synopsis2: phase === "ete" ? n(synopsis) : (grade?.synopsis2 ?? null),
        weekly15: grade?.weekly15 ?? null,
        pptMid: phase === "mid" ? n(ppt) : (grade?.pptMid ?? null),
        pptEnd: phase === "ete" ? n(ppt) : (grade?.pptEnd ?? null),
        design20: phase === "ete" ? n(design) : (grade?.design20 ?? null),
        ete40: phase === "ete" ? n(ete) : (grade?.ete40 ?? null),
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the evaluation.");
    } finally {
      setBusy(false);
    }
  }

  const synopsisSaved = phase === "mid" ? grade?.synopsis1 : grade?.synopsis2;
  const anyScore = synopsisSaved != null || savedPpt != null || (phase === "ete" && (grade?.design20 != null || grade?.ete40 != null));

  return (
    <div className="rounded-[14px] bg-white/80 px-4 py-3.5 ring-1 ring-sand-200">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-semibold text-ink-900">{title} submission</p>
        <span className={cn("text-[12.5px] font-semibold", files.length ? "text-azure-600" : "text-gold-600")}>
          {files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "Not uploaded yet"}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] text-stone-500">PPT, project report and project synopsis.</p>
      {files.length ? <FileChips bucket="submissions" files={files} className="mt-2.5" /> : null}

      {canGrade ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-sand-200/70 pt-3">
          <p className="text-[12.5px] text-stone-500">
            {anyScore ? "Evaluation saved - open to edit." : "Enter the scores for this phase."}
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={!files.length && !anyScore}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset transition-colors",
              !files.length && !anyScore
                ? "bg-ivory-200/70 text-stone-400 ring-sand-200"
                : anyScore
                  ? "bg-azure-50 text-azure-600 ring-azure-100 hover:bg-azure-50/70"
                  : "bg-clay-500 text-white ring-clay-500 shadow-sm hover:bg-clay-500/90 animate-pulse",
            )}
          >
            <Eye className="size-3.5" />
            {anyScore ? "Review evaluation" : "Evaluate"}
          </button>
        </div>
      ) : null}

      {open && canGrade ? (
        <form onSubmit={save} className="mt-3 rounded-[14px] bg-azure-50/60 p-4 ring-1 ring-azure-100">
          <p className="text-[14px] font-semibold text-ink-900">Evaluate {phase === "mid" ? "midterm" : "endterm"} submission</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Synopsis (out of 10)" htmlFor={`syn-${phase}`}>
              <Input
                id={`syn-${phase}`}
                type="number"
                min={0}
                max={10}
                step="0.5"
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
              />
            </Field>
            <Field label="PPT (out of 15)" htmlFor={`ppt-${phase}`}>
              <Input
                id={`ppt-${phase}`}
                type="number"
                min={0}
                max={15}
                step="0.5"
                value={ppt}
                onChange={(e) => setPpt(e.target.value)}
              />
            </Field>
            {phase === "ete" ? (
              <>
                <Field label="Design & implementation (out of 20)" htmlFor="design-ete">
                  <Input
                    id="design-ete"
                    type="number"
                    min={0}
                    max={20}
                    step="0.5"
                    value={design}
                    onChange={(e) => setDesign(e.target.value)}
                  />
                </Field>
                <Field label="End Term Exam (out of 40)" htmlFor="ete-40">
                  <Input
                    id="ete-40"
                    type="number"
                    min={0}
                    max={40}
                    step="0.5"
                    value={ete}
                    onChange={(e) => setEte(e.target.value)}
                  />
                </Field>
              </>
            ) : null}
          </div>
          {error ? <p className="mt-2 text-[12.5px] text-clay-500">{error}</p> : null}
          <div className="mt-3 flex items-center gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              <Save className="size-3.5" />
              {busy ? "Saving" : "Submit evaluation"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ReportCountPicker({ groupId, value, onChanged }: { groupId: string; value: number; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-stone-500">
      Reports due
      <select
        value={value}
        onChange={async (e) => {
          setError(null);
          try {
            await repo.setReportCount(groupId, Number(e.target.value));
            onChanged();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not change it.");
          }
        }}
        className="rounded-lg border border-white/80 bg-white/75 px-2 py-1 text-[13px] text-ink-900"
      >
        {[5, 6].includes(value) ? null : <option value={value}>{value}</option>}
        <option value={5}>5</option>
        <option value={6}>6</option>
      </select>
      {error ? <span className="text-clay-500">{error}</span> : null}
    </label>
  );
}

/** One week's row in the supervisor's list; expands into the evaluation panel. */
function WeekRow({
  week,
  report,
  canGrade,
  onGraded,
}: {
  week: number;
  report: WeeklyReport | undefined;
  canGrade: boolean;
  onGraded: () => void;
}) {
  const submitted = report != null;
  const graded = report?.grade != null;
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!report) return;
    setBusy(true);
    setError(null);
    try {
      await repo.gradeReport(report.id, Number(grade), feedback.trim());
      onGraded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the evaluation.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-sand-200/70 bg-white/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ivory-200/80 text-stone-500">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[15px] text-ink-900">Week {week}</span>
              <Badge tone={graded ? "sage" : submitted ? "sky" : "gold"} dot>
                {graded ? "Graded" : submitted ? "Submitted" : "Pending"}
              </Badge>
            </p>
            <p className="mt-0.5 truncate text-[12px] text-stone-500">
              {report
                ? `${graded ? "Evaluated" : "Submitted"} ${timeAgo(graded ? (report.gradedAt ?? report.submittedAt) : report.submittedAt)}`
                : "No submission yet"}
            </p>
            {report?.summary ? (
              <p className="mt-1 truncate text-[12.5px] text-stone-600">{plainText(report.summary)}</p>
            ) : null}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {submitted ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setGrade(report!.grade != null ? String(report!.grade) : "");
                setFeedback(report!.feedback ?? "");
                setOpen(true);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset transition-colors",
                graded
                  ? "bg-azure-50 text-azure-600 ring-azure-100 hover:bg-azure-50/70"
                  : "bg-clay-500 text-white ring-clay-500 shadow-sm hover:bg-clay-500/90 animate-pulse",
              )}
            >
              <Eye className="size-3.5" />
              {graded ? "Review evaluation" : "Evaluate"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-ivory-200/70 px-3 py-1.5 text-[13px] text-stone-400 ring-1 ring-inset ring-sand-200">
              Review submission
            </span>
          )}
          <ChevronDown className={cn("size-4 text-stone-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && submitted ? (
        <div className="border-t border-sand-200/70 p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Left: the score (when graded) and the file itself. */}
            <div className="space-y-3">
              {graded ? (
                <div className="rounded-[14px] bg-sage-100 p-4 text-sage-500 ring-1 ring-sage-500/15">
                  <div className="flex items-center justify-between">
                    <p>
                      <span className="tnum font-display text-[2.1rem] leading-none">{report!.grade}</span>
                      <span className="text-[14px] text-sage-500/80"> / 10</span>
                    </p>
                    <span className="flex size-9 items-center justify-center rounded-full bg-sage-500/15">
                      <Trophy className="size-4.5" />
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] font-medium">{scoreCaption(report!.grade ?? 0)}</p>
                </div>
              ) : null}

              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">Worked on</p>
                {report!.summary ? (
                  <RichText text={report!.summary} className="mt-1.5 text-[13.5px] text-ink-800" />
                ) : (
                  <p className="mt-1.5 text-[12.5px] text-stone-500">The team did not add a summary.</p>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">Report file</p>
                {report!.files.length > 0 ? (
                  <FileChips
                    bucket="submissions"
                    files={report!.files}
                    meta={`Sent ${timeAgo(report!.submittedAt)}`}
                    className="mt-2"
                  />
                ) : (
                  <p className="mt-2 text-[12.5px] text-stone-500">No file was attached to this submission.</p>
                )}
              </div>
            </div>

            {/* Right: the evaluation panel. */}
            {canGrade ? (
              <form onSubmit={save} className="rounded-[14px] bg-azure-50/60 p-4 ring-1 ring-azure-100">
                <p className="text-[14px] font-semibold text-ink-900">Evaluate submission</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[7rem_1fr]">
                  <Field label="Grade (out of 10)" htmlFor={`g-${week}`}>
                    <Input
                      id={`g-${week}`}
                      type="number"
                      min={0}
                      max={10}
                      step="0.5"
                      required
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                    />
                  </Field>
                  <Field label="Feedback for the team" htmlFor={`f-${week}`}>
                    <RichEditor
                      id={`f-${week}`}
                      rows={3}
                      maxLength={500}
                      value={feedback}
                      onChange={setFeedback}
                      placeholder="What went well, what to improve"
                      hint=""
                    />
                  </Field>
                </div>
                {error ? <p role="alert" className="mt-1 text-[12.5px] text-clay-500">{error}</p> : null}
                <div className="mt-2 flex items-center gap-2">
                  <Button type="submit" size="sm" loading={busy}>
                    <Save className="size-3.5" />
                    Save evaluation
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[12px] text-stone-500">
                  <Info className="size-3.5" />
                  The student will be notified once you save the evaluation.
                </p>
              </form>
            ) : (
              <p className="text-[12.5px] text-stone-500">Waiting for the supervisor to grade.</p>
            )}
          </div>
        </div>
      ) : open ? (
        <div className="border-t border-sand-200/70 px-4 py-3 text-[12.5px] text-stone-500">
          Nothing to review yet - the team has not submitted week {week}.
        </div>
      ) : null}
    </div>
  );
}

/** A one-line verdict shown next to a saved score. */
function scoreCaption(grade: number): string {
  if (grade >= 9) return "Excellent performance";
  if (grade >= 7) return "Strong progress";
  if (grade >= 5) return "Good work, keep it up";
  return "Needs attention - read the feedback";
}

/** The group's /100, taken as the sum of the plan's components. */
function groupTotal(grade: GroupGrade | null, weeklyAverage: number | null): number | null {
  if (!grade) return null;
  const synopsisVals = [grade.synopsis1, grade.synopsis2].filter((v): v is number => v != null);
  const synopsis = synopsisVals.length
    ? Math.round((synopsisVals.reduce((a, b) => a + b, 0) / synopsisVals.length) * 10) / 10
    : null;
  const weekly = grade.weekly15 ?? weeklyAverage;
  const parts = [synopsis, weekly, grade.ppt15, grade.design20, grade.ete40];
  if (parts.some((p) => p == null)) return null;
  return Math.round((parts as number[]).reduce((a, b) => a + b, 0) * 10) / 10;
}

/**
 * One editable row per student: the group's shared /100 is the starting point,
 * approved achievement bonuses are added on top, and the supervisor can override
 * the final to reward or dock any individual contribution.
 */
function PerStudentFinals({
  group,
  grade,
  weeklyAverage,
  achievements,
  canEdit,
  onSaved,
}: {
  group: Group;
  grade: GroupGrade | null;
  weeklyAverage: number | null;
  achievements: Achievement[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const groupScore = groupTotal(grade, weeklyAverage);
  return (
    <Card>
      <CardHeader
        title="Individual final scores"
        description="Each student starts at the group's /100. Approved achievements add bonus marks on top. Override any student to reflect their individual contribution."
      />
      <div className="divide-y divide-sand-200/70">
        {group.members.map((m) => {
          const bonus = achievements
            .filter((a) => a.studentId === m.studentId && a.status === "approved")
            .reduce((n, a) => n + (a.bonusMarks ?? 0), 0);
          const base = m.finalOverride ?? groupScore;
          const total = base != null ? Math.round((base + bonus) * 10) / 10 : null;
          return (
            <StudentFinalRow
              key={m.studentId}
              studentId={m.studentId}
              name={m.fullName}
              reg={m.registrationNumber}
              avatarUrl={m.avatarUrl}
              groupScore={groupScore}
              bonus={bonus}
              override={m.finalOverride ?? null}
              total={total}
              canEdit={canEdit}
              onSaved={onSaved}
            />
          );
        })}
      </div>
    </Card>
  );
}

function StudentFinalRow({
  studentId,
  name,
  reg,
  avatarUrl,
  groupScore,
  bonus,
  override,
  total,
  canEdit,
  onSaved,
}: {
  studentId: string;
  name: string;
  reg: string;
  avatarUrl?: string;
  groupScore: number | null;
  bonus: number;
  override: number | null;
  total: number | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(override != null ? String(override) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const n = value.trim() === "" ? null : Number(value);
      await repo.setStudentFinal(studentId, n);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
      <Avatar name={name} src={avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink-900">{name}</p>
        <p className="text-[12px] text-stone-500">
          {reg} · Group {groupScore ?? "-"}/100
          {bonus > 0 ? <span className="text-sage-600"> + bonus {bonus}</span> : null}
          {override != null ? <span className="text-azure-600"> · overridden</span> : null}
        </p>
      </div>
      {editing && canEdit ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={150}
            step="0.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={groupScore != null ? String(groupScore) : "auto"}
            className="w-24"
          />
          <Button size="sm" onClick={() => void save()} loading={busy}>
            <Save className="size-3.5" />
            Save
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="tnum font-display text-[1.4rem] leading-none text-ink-900">
            {total != null ? total : "-"}
            <span className="text-[0.9rem] text-stone-400">/100</span>
          </p>
          {canEdit ? (
            <Button size="sm" variant="secondary" onClick={() => { setValue(override != null ? String(override) : ""); setEditing(true); }}>
              Edit
            </Button>
          ) : null}
        </div>
      )}
      {error ? <p className="w-full text-right text-[12px] text-clay-500">{error}</p> : null}
    </div>
  );
}
