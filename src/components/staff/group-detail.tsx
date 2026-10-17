"use client";

import { useState, type FormEvent } from "react";
import { ArrowRightLeft, Award, Crown, FileText, Mail, MessageCircleQuestion } from "lucide-react";

import { FileLink } from "@/components/shared/file-link";
import { QueryList } from "@/components/shared/queries";
import { ChangeSupervisorForm, SupervisorHistory } from "@/components/staff/supervisor-change";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import type { Group, StudentGrade, WeeklyReport } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { formatDateTime, timeAgo } from "@/lib/utils";

async function loadGroupDetail(groupId: string) {
  const group = await repo.getGroup(groupId);
  if (!group) throw new Error("This group does not exist or is not visible to you.");
  const [mentor, reports, grades, tickets, changes] = await Promise.all([
    repo.getFaculty(group.mentorId),
    repo.listReports(group.id),
    repo.listGrades(group.members.map((m) => m.studentId)),
    repo.listTickets(group.id),
    repo.listSupervisorChanges(group.id),
  ]);
  return { group, mentor, reports, grades, tickets, changes };
}

/**
 * Everything about one team, for its supervisor and the PBL office. The PBL
 * office (`isAdmin`) can also move the group to another supervisor.
 */
export function GroupDetail({ groupId, isAdmin = false }: { groupId: string; isAdmin?: boolean }) {
  const [changing, setChanging] = useState(false);
  const { data, error, reload } = useLoad(() => loadGroupDetail(groupId), groupId);

  if (error) return <Card><EmptyState title="Could not load this group" description={error} /></Card>;
  if (!data) return <PageSkeleton />;

  const { group, mentor, reports, grades, tickets, changes } = data;

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
          <CardHeader title="Project idea" />
          <CardBody className="space-y-4">
            <p className="text-[14px] leading-relaxed whitespace-pre-line text-stone-600">
              {group.projectIdea || "The group has not described its idea yet."}
            </p>
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
        <CardHeader title="Students" description="Grade individuals and note what each should improve." />
        <ul className="divide-y divide-sand-200/70">
          {group.members.map((m) => (
            <StudentRow
              key={m.studentId}
              member={m}
              isLeader={m.studentId === group.leaderStudentId}
              grades={grades.filter((g) => g.studentId === m.studentId)}
              onGraded={reload}
            />
          ))}
        </ul>
      </Card>

      {/* ------------------------- weekly reports ------------------------ */}
      <Card>
        <CardHeader
          title="Weekly reports"
          description={`${reports.filter((r) => r.week <= group.reportCount).length} of ${group.reportCount} submitted. Grade out of 10 with feedback - students are notified.`}
          action={<ReportCountPicker groupId={group.id} value={group.reportCount} onChanged={reload} />}
        />
        <ul className="divide-y divide-sand-200/70">
          {Array.from({ length: group.reportCount }, (_, i) => i + 1).map((week) => {
            const r = reports.find((x) => x.week === week);
            return r ? (
              <ReportRow key={r.id} report={r} onGraded={reload} />
            ) : (
              <li key={week} className="flex items-center gap-2 px-5 py-3">
                <FileText className="size-4 text-stone-300" />
                <span className="font-display text-[15px] text-stone-500">Week {week}</span>
                <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-semibold text-gold-600">Pending</span>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ----------------------------- queries ---------------------------- */}
      <Card>
        <CardHeader title="Queries from this group" />
        {tickets.length === 0 ? (
          <EmptyState icon={<MessageCircleQuestion className="size-5" />} title="No queries raised" scene="queries" />
        ) : (
          <QueryList queries={tickets} canReply={!isAdmin} onChanged={reload} />
        )}
      </Card>
    </div>
  );
}

function StudentRow({
  member,
  isLeader,
  grades,
  onGraded,
}: {
  member: Group["members"][number];
  isLeader: boolean;
  grades: StudentGrade[];
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
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          <Award className="size-3.5" />
          {open ? "Cancel" : "Give grade"}
        </Button>
      </div>

      {grades.length > 0 ? (
        <ul className="mt-3 space-y-1.5 pl-[3.25rem]">
          {grades.map((g) => (
            <li key={g.id} className="text-[12.5px] text-stone-600">
              <span className="tnum font-semibold text-ink-900">{g.score}/{g.maxScore}</span> · {g.title}
              {g.improvements ? <span className="text-stone-500"> - {g.improvements}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
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

/** How many weekly reports the group owes: 5 or 6. */
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

function ReportRow({ report, onGraded }: { report: WeeklyReport; onGraded: () => void }) {
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await repo.gradeReport(report.id, Number(grade), feedback.trim());
      onGraded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the grade.");
      setBusy(false);
    }
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[16px] text-ink-900">Week {report.week}</p>
          <p className="text-[12px] text-stone-500" title={formatDateTime(report.submittedAt)}>
            Submitted {timeAgo(report.submittedAt)}
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-stone-600">{report.summary}</p>
          {report.filePath && report.fileName ? (
            <FileLink bucket="submissions" path={report.filePath} name={report.fileName} className="mt-2" />
          ) : null}
        </div>
        {report.grade != null ? (
          <div className="rounded-xl bg-sage-100 px-3 py-2 text-center text-sage-500">
            <p className="tnum font-display text-xl leading-none">{report.grade}</p>
            <p className="mt-1 text-[10.5px] font-semibold tracking-wide uppercase">out of 10</p>
          </div>
        ) : null}
      </div>

      {report.grade != null ? (
        report.feedback ? <p className="mt-2 text-[12.5px] text-stone-500">Feedback: {report.feedback}</p> : null
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3 rounded-[14px] bg-white/60 p-3">
          <Field label="Grade /10" htmlFor={`g-${report.id}`} className="w-24">
            <Input id={`g-${report.id}`} type="number" min={0} max={10} step="0.5" required value={grade} onChange={(e) => setGrade(e.target.value)} />
          </Field>
          <Field label="Feedback" htmlFor={`f-${report.id}`} className="min-w-[14rem] flex-1">
            <Input id={`f-${report.id}`} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, what to fix next week" />
          </Field>
          <Button type="submit" size="sm" loading={busy}>Grade</Button>
          {error ? <p role="alert" className="w-full text-[12.5px] text-clay-500">{error}</p> : null}
        </form>
      )}
    </li>
  );
}
