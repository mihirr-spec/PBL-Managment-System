"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, ClipboardList, MessageSquareText, Presentation, ScrollText, Upload, type LucideIcon } from "lucide-react";

import { FileChips, FileRow } from "@/components/shared/file-link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/card";
import { FileDrop } from "@/components/ui/file-drop";
import { Label, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import type { GroupMilestone, MilestoneSlot, WeeklyReport } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

/** "02 Oct 2026, 10:24 PM" */
function stamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

/**
 * Weekly reports: a summary of submitted and evaluated reports, then one
 * collapsible row per week. A submitted week shows its score, file and the
 * supervisor's feedback; an open week shows the submission form.
 */
export default function ReportsPage() {
  const { loading, student, group, mentor, refresh } = usePortal();
  const reports = useLoad(() => repo.listReports(group!.id), group ? group.id : null);
  const milestones = useLoad(() => (group ? repo.listMilestones(group.id) : Promise.resolve([])), group ? group.id : null);
  const [submittedWeek, setSubmittedWeek] = useState<number | null>(null);

  if (loading || !student) return <PageSkeleton />;

  if (!group || !group.mentorId) {
    return (
      <div>
        <PageHeader eyebrow="Weekly Reports" title="Weekly" emphasis="reports." scene="reports" />
        <Card>
          <EmptyState
            title={group ? "Waiting for your supervisor" : "Join a group first"}
            description={
              group
                ? "Report slots open once your supervisor approves your team's request."
                : "Weekly reports are submitted per group."
            }
            scene="reports"
          />
        </Card>
      </div>
    );
  }

  if (reports.error) return <p role="alert" className="text-[13px] text-clay-500">{reports.error}</p>;
  if (!reports.data) return <PageSkeleton />;

  const byWeek = new Map(reports.data.map((r) => [r.week, r]));
  const weeks = Array.from({ length: group.reportCount }, (_, i) => i + 1);
  const submitted = weeks.filter((w) => byWeek.has(w)).length;
  const evaluated = weeks.filter((w) => byWeek.get(w)?.grade != null).length;
  // Open the latest submitted week, or the first week if nothing is in yet.
  const openFirst = [...weeks].reverse().find((w) => byWeek.has(w)) ?? 1;

  const slotOf = (s: MilestoneSlot) => (milestones.data ?? []).find((m) => m.slot === s);

  /** One week's row, plus a milestone block after week 3 (midterm) and 7 (endterm). */
  function weekBlock(week: number): ReactNode {
    return (
      <div key={week} className="space-y-3">
        <WeekRow
          week={week}
          report={byWeek.get(week)}
          defaultOpen={week === openFirst}
          mentorName={mentor?.fullName ?? "Your supervisor"}
          mentorAvatar={mentor?.avatarUrl}
          onSubmitted={(w) => {
            setSubmittedWeek(w);
            void reports.reload();
            void refresh();
          }}
        />
        {week === 3 ? (
          <MilestonePhase
            title="Midterm"
            note="After week 3"
            items={[
              { slot: "mid_ppt", label: "Analysis process PPT", icon: Presentation },
              { slot: "mid_synopsis", label: "Synopsis", icon: ScrollText },
            ]}
            get={slotOf}
            reload={() => void milestones.reload()}
          />
        ) : null}
        {week === 7 ? (
          <MilestonePhase
            title="Endterm"
            note="After week 7"
            items={[
              { slot: "ete_ppt", label: "Updated PPT", icon: Presentation },
              { slot: "ete_synopsis", label: "Updated synopsis", icon: ScrollText },
            ]}
            get={slotOf}
            reload={() => void milestones.reload()}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="font-display text-[2.4rem] leading-tight tracking-tight text-ink-900">Weekly Reports</h1>
          <p className="mt-1 text-[14.5px] text-stone-600">Submit your weekly progress reports and track supervisor evaluations.</p>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-sand-200 rounded-2xl bg-white/70 py-4 ring-1 ring-sand-200/70 backdrop-blur-sm">
          <Stat value={<>{submitted}<span className="text-[1.1rem] text-stone-500"> / {group.reportCount}</span></>} label="Submitted" />
          <Stat value={evaluated} label="Evaluated" />
          <Stat value={submitted - evaluated} label="Pending Evaluation" />
        </dl>
      </div>

      {submittedWeek != null ? (
        <p role="status" className="text-[13px] text-sage-500">
          Week {submittedWeek} report submitted - your supervisor has been notified.
        </p>
      ) : null}

      <div className="space-y-3">{weeks.map((week) => weekBlock(week))}</div>
    </div>
  );
}

/** One number in the header's summary panel. */
function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="px-6 text-center sm:px-10">
      <dd className="tnum font-display text-[1.9rem] leading-none text-ink-900">{value}</dd>
      <dt className="mt-1.5 text-[12.5px] text-stone-500">{label}</dt>
    </div>
  );
}

/** A collapsible week: the header line, then the report (or the submission form). */
function WeekRow({
  week,
  report,
  defaultOpen,
  mentorName,
  mentorAvatar,
  onSubmitted,
}: {
  week: number;
  report: WeeklyReport | undefined;
  defaultOpen: boolean;
  mentorName: string;
  mentorAvatar?: string;
  onSubmitted: (week: number) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const graded = report?.grade != null;
  const status = !report ? "Pending Submission" : graded ? "Evaluated" : "Pending Evaluation";

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-white/60"
      >
        <span className="w-24 shrink-0 font-display text-[1.35rem] text-ink-900">Week {week}</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-stone-500">
          {report ? `Submitted on ${stamp(report.submittedAt)}` : "Not submitted yet"}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-[12.5px] font-medium",
            graded ? "bg-azure-50 text-azure-600" : "bg-ivory-200/80 text-stone-600",
          )}
        >
          <span className={cn("size-1.5 rounded-full", graded ? "bg-azure-600" : "bg-stone-500")} />
          {status}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-stone-500 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        report ? (
          <ReportBody report={report} mentorName={mentorName} mentorAvatar={mentorAvatar} />
        ) : (
          <SubmitForm week={week} onSubmitted={onSubmitted} />
        )
      ) : null}
    </Card>
  );
}

/** A submitted week: score and verdict, the files, and the supervisor's feedback. */
function ReportBody({
  report,
  mentorName,
  mentorAvatar,
}: {
  report: WeeklyReport;
  mentorName: string;
  mentorAvatar?: string;
}) {
  const graded = report.grade != null;
  return (
    <div className="space-y-3 border-t border-sand-200/70 px-4 pt-3 pb-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex items-center rounded-xl border border-sand-200 bg-white px-5 py-3">
          <div className="flex flex-1 items-center gap-4">
            <span className="flex size-11 items-center justify-center rounded-xl border border-sand-200 text-stone-500">
              <ClipboardList className="size-5" />
            </span>
            <div>
              <p className="text-[12.5px] text-stone-500">Score</p>
              <p className="tnum font-display text-[1.5rem] leading-tight text-ink-900">
                {graded ? report.grade : "-"}
                <span className="text-[1rem] text-stone-600"> / 10</span>
              </p>
            </div>
          </div>
          <span className="mx-4 h-10 w-px bg-sand-200" aria-hidden />
          <div className="flex flex-1 items-center gap-4">
            <span className="flex size-11 items-center justify-center rounded-xl border border-sand-200 text-stone-500">
              <MessageSquareText className="size-5" />
            </span>
            <div>
              <p className="text-[12.5px] text-stone-500">Feedback</p>
              <p className="font-display text-[1.25rem] leading-tight text-azure-600">
                {graded ? verdict(report.grade!) : "Awaiting"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {report.files.length > 0 ? (
            report.files.map((f) => (
              <FileRow key={f.path} bucket="submissions" path={f.path} name={f.name} meta={`Sent ${stamp(report.submittedAt)}`} />
            ))
          ) : (
            <p className="flex h-full items-center rounded-xl border border-dashed border-sand-200 px-4 py-3 text-[13px] text-stone-500">
              No file was attached to this report.
            </p>
          )}
        </div>
      </div>

      {report.summary ? (
        <p className="rounded-xl bg-white/70 px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-line text-stone-600 ring-1 ring-sand-200/70">
          {report.summary}
        </p>
      ) : null}

      <div className="flex gap-3 rounded-xl bg-azure-50/60 px-4 py-3.5 ring-1 ring-azure-100">
        <Avatar name={mentorName} src={mentorAvatar} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13.5px] font-semibold text-azure-600">Supervisor Feedback</p>
            {report.gradedAt ? <p className="text-[12.5px] text-stone-500">{stamp(report.gradedAt)}</p> : null}
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line text-ink-800">
            {graded
              ? report.feedback || "No note was left with the grade."
              : "Your supervisor has not evaluated this report yet. You will be notified when they do."}
          </p>
          {graded ? <p className="mt-1.5 text-[13px] font-semibold text-ink-900">{mentorName}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** A one-word verdict for the score. */
function verdict(grade: number): string {
  if (grade >= 9) return "Excellent";
  if (grade >= 7) return "Very good";
  if (grade >= 5) return "Good";
  return "Needs work";
}

/** The inline form for a week that hasn't been submitted yet. */
function SubmitForm({ week, onSubmitted }: { week: number; onSubmitted: (week: number) => void }) {
  const { student, group } = usePortal();
  const [summary, setSummary] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!student || !group) return;
    setBusy(true);
    setError(null);
    try {
      await repo.submitReport({ groupId: group.id, studentId: student.id, week, summary: summary.trim(), files: files.length ? files : undefined });
      setSummary("");
      setFiles([]);
      onSubmitted(week);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-sand-200/70 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`r-file-${week}`}>Report file (optional)</Label>
          <FileDrop
            id={`r-file-${week}`}
            files={files}
            onChange={setFiles}
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,image/png,image/jpeg"
            specs="PDF, Word, PowerPoint, ZIP or images · up to 25 MB each"
            disabled={busy}
          />
        </div>
        <div>
          <Label htmlFor={`r-summary-${week}`}>What did the team do this week? (optional)</Label>
          <Textarea
            id={`r-summary-${week}`}
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Progress, blockers and next week's plan"
          />
        </div>
      </div>
      {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={busy}>
          <Upload className="size-3.5" />
          Submit week {week}
        </Button>
      </div>
    </form>
  );
}

interface MilestoneItem {
  slot: MilestoneSlot;
  label: string;
  icon: LucideIcon;
}

/** A midterm or endterm block: one upload slot for each deliverable. */
function MilestonePhase({
  title,
  note,
  items,
  get,
  reload,
}: {
  title: string;
  note: string;
  items: MilestoneItem[];
  get: (slot: MilestoneSlot) => GroupMilestone | undefined;
  reload: () => void;
}) {
  const { group } = usePortal();
  const [busy, setBusy] = useState<MilestoneSlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(slot: MilestoneSlot, picked: File[]) {
    if (!group || picked.length === 0) return;
    setBusy(slot);
    setError(null);
    try {
      await repo.submitMilestone(group.id, slot, picked);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload the files.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gold-50 text-gold-600">
            <ScrollText className="size-4" />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-ink-900">{title} submissions</p>
            <p className="text-[12px] text-stone-500">{note}</p>
          </div>
        </div>
        <Badge tone="gold" dot>{note.replace("After ", "Due after ")}</Badge>
      </div>
      <div className="grid gap-3 border-t border-sand-200/70 px-5 py-4 sm:grid-cols-2">
        {items.map(({ slot, label, icon: Icon }) => {
          const m = get(slot);
          const attached = m?.files ?? [];
          return (
            <div key={slot} className="rounded-[12px] bg-white/70 p-3 ring-1 ring-sand-200">
              <p className="flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-stone-500">
                <Icon className="size-3.5 text-azure-600" />
                {label}
              </p>
              {attached.length > 0 ? (
                <FileChips bucket="submissions" files={attached} className="mt-2.5 sm:grid-cols-1" />
              ) : null}
              <label className="mt-2.5 block cursor-pointer">
                <input
                  type="file"
                  className="sr-only"
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.zip,image/png,image/jpeg"
                  multiple
                  disabled={busy != null}
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    if (picked.length > 0) void upload(slot, picked);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-azure-50 px-2.5 py-1.5 text-[12px] font-medium text-azure-600 ring-1 ring-azure-100 transition-colors hover:bg-azure-50/70 disabled:opacity-50">
                  <Upload className="size-3.5" />
                  {busy === slot ? "Uploading..." : attached.length > 0 ? "Add more files" : "Upload files"}
                </span>
              </label>
            </div>
          );
        })}
      </div>
      {error ? <p role="alert" className="px-5 pb-3 text-[13px] text-clay-500">{error}</p> : null}
    </Card>
  );
}
