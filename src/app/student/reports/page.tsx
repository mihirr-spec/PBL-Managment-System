"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, Clock, Download, FileText, Quote, Upload, X } from "lucide-react";

import { DocumentViewer } from "@/components/shared/document-viewer";
import { FileChips } from "@/components/shared/file-link";
import { FileTypeIcon, fileTypeLabel } from "@/components/shared/file-type-icon";
import { RichEditor } from "@/components/shared/rich-editor";
import { RichText, plainText } from "@/components/shared/rich-text";
import { TimelineItem } from "@/components/shared/timeline";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { FileDrop } from "@/components/ui/file-drop";
import { Label } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import type { MilestoneSlot, StoredFile, WeeklyReport } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

/** "02 Oct 2026, 10:24 PM" */
function stamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

/** Opens a private file's download under its own name. */
async function download(file: StoredFile) {
  window.location.assign(await repo.getDownloadUrl("submissions", file.path, file.name));
}

interface Supervisor {
  name: string;
  avatar?: string;
}

/**
 * Weekly reports: three summary cards, then one card with the timeline. Each
 * submitted week shows score, feedback, work done and the file in one strip;
 * clicking the feedback opens it in full in a side panel. Open weeks offer
 * "Submit Report"; the midterm and endterm sit after week 3 and the last week.
 */
export default function ReportsPage() {
  const { loading, student, group, mentor, refresh } = usePortal();
  const reports = useLoad(() => repo.listReports(group!.id), group ? group.id : null);
  const milestones = useLoad(() => (group ? repo.listMilestones(group.id) : Promise.resolve([])), group ? group.id : null);
  const [submittedWeek, setSubmittedWeek] = useState<number | null>(null);
  const [panel, setPanel] = useState<WeeklyReport | null>(null);

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

  const supervisor: Supervisor = { name: mentor?.fullName ?? "Your supervisor", avatar: mentor?.avatarUrl };
  const byWeek = new Map(reports.data.map((r) => [r.week, r]));
  const weeks = Array.from({ length: group.reportCount }, (_, i) => i + 1);
  const submitted = weeks.filter((w) => byWeek.has(w)).length;
  const evaluated = weeks.filter((w) => byWeek.get(w)?.grade != null).length;

  const slotOf = (s: MilestoneSlot) => (milestones.data ?? []).find((m) => m.slot === s);
  const midFiles = [...(slotOf("mid_ppt")?.files ?? []), ...(slotOf("mid_synopsis")?.files ?? [])];
  const eteFiles = [...(slotOf("ete_ppt")?.files ?? []), ...(slotOf("ete_synopsis")?.files ?? [])];
  const total = weeks.length + 2;
  const percent = Math.round(((submitted + (midFiles.length ? 1 : 0) + (eteFiles.length ? 1 : 0)) / total) * 100);

  // The timeline: each week, the midterm after week 3 and the endterm last.
  const stops: Array<{ key: string; state: "evaluated" | "submitted" | "pending"; milestone?: boolean; node: ReactNode }> = [];
  for (const week of weeks) {
    const report = byWeek.get(week);
    stops.push({
      key: `w${week}`,
      state: !report ? "pending" : report.grade != null ? "evaluated" : "submitted",
      node: (
        <WeekRow
          week={week}
          report={report}
          supervisor={supervisor}
          onOpenFeedback={setPanel}
          onSubmitted={(w) => {
            setSubmittedWeek(w);
            void reports.reload();
            void refresh();
          }}
        />
      ),
    });
    if (week === 3) {
      stops.push({
        key: "mid",
        milestone: true,
        state: midFiles.length ? "submitted" : "pending",
        node: <MilestonePhase title="Midterm (MTE)" note="After week 3" slot="mid_ppt" files={midFiles} reload={() => void milestones.reload()} />,
      });
    }
  }
  stops.push({
    key: "ete",
    milestone: true,
    state: eteFiles.length ? "submitted" : "pending",
    node: (
      <MilestonePhase
        title="Endterm (ETE)"
        note={`After week ${weeks.length}`}
        slot="ete_ppt"
        files={eteFiles}
        reload={() => void milestones.reload()}
      />
    ),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[2.4rem] leading-tight tracking-tight text-ink-900">Weekly Reports</h1>
        <p className="mt-1 text-[14.5px] text-stone-600">
          Submit your weekly progress reports, upload required documents and track supervisor evaluations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard tone="blue" icon={<FileText className="size-6" />} value={submitted} label="Submitted" note={`of ${group.reportCount} weekly reports`} />
        <StatCard tone="green" icon={<CheckCircle2 className="size-6" />} value={evaluated} label="Evaluated" note="Reviewed and graded by your supervisor" />
        <StatCard tone="orange" icon={<Clock className="size-6" />} value={submitted - evaluated} label="Pending Evaluation" note="Awaiting supervisor review" />
      </div>

      {submittedWeek != null ? (
        <p role="status" className="text-[13px] text-sage-500">
          Week {submittedWeek} report submitted - your supervisor has been notified.
        </p>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sand-200/70 px-6 py-4">
          <h2 className="text-[1.25rem] font-semibold text-ink-900">Reports Timeline</h2>
          <div className="w-full max-w-xs" title={`${percent}% of the weekly reports and evaluation uploads are in`}>
            <div className="flex items-baseline justify-between text-[12.5px] text-stone-500">
              <span>Progress</span>
              <span className="tnum font-semibold text-azure-600">{percent}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand-200/70" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-azure-600 transition-[width] duration-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
        <div className="space-y-3 px-5 py-4">
          {stops.map((s, i) => (
            <TimelineItem key={s.key} state={s.state} milestone={s.milestone} last={i === stops.length - 1}>
              {s.node}
            </TimelineItem>
          ))}
        </div>
      </Card>

      {panel ? <FeedbackPanel report={panel} supervisor={supervisor} onClose={() => setPanel(null)} /> : null}
    </div>
  );
}

/** One summary card: a coloured icon tile, the number, its label and a note. */
function StatCard({
  tone,
  icon,
  value,
  label,
  note,
}: {
  tone: "blue" | "green" | "orange";
  icon: ReactNode;
  value: number;
  label: string;
  note: string;
}) {
  return (
    <Card className="flex items-center gap-5 px-6 py-5">
      <span
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-2xl",
          tone === "blue" ? "bg-azure-50 text-azure-600" : tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="tnum text-[1.8rem] leading-none font-semibold text-ink-900">{value}</p>
        <p className="mt-1.5 text-[14px] font-medium text-ink-800">{label}</p>
        <p className="text-[12.5px] text-stone-500">{note}</p>
      </div>
    </Card>
  );
}

/** The status pill on the right of a week. */
function StatusPill({ status }: { status: "Evaluated" | "Pending Evaluation" | "Pending Submission" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-lg px-3 py-1 text-[12.5px] font-medium",
        status === "Evaluated"
          ? "bg-emerald-50 text-emerald-700"
          : status === "Pending Evaluation"
            ? "bg-orange-50 text-orange-600"
            : "bg-slate-100 text-stone-600",
      )}
    >
      {status}
    </span>
  );
}

/** One week: the header line and, when open, the report strip or the submit bar. */
function WeekRow({
  week,
  report,
  supervisor,
  onOpenFeedback,
  onSubmitted,
}: {
  week: number;
  report: WeeklyReport | undefined;
  supervisor: Supervisor;
  onOpenFeedback: (report: WeeklyReport) => void;
  onSubmitted: (week: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const graded = report?.grade != null;
  const status = !report ? "Pending Submission" : graded ? "Evaluated" : "Pending Evaluation";

  return (
    <div>
      <div className="flex items-start gap-4 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15.5px] font-semibold text-ink-900">Week {week}</p>
          <p className="text-[13px] text-stone-500">{report ? `Submitted on ${stamp(report.submittedAt)}` : "Not submitted yet"}</p>
        </div>
        <StatusPill status={status} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? `Collapse week ${week}` : `Expand week ${week}`}
          className="rounded-lg p-1 text-stone-500 hover:bg-white hover:text-ink-900"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open ? (
        <div className="mt-3">
          {report ? (
            <ReportStrip report={report} supervisor={supervisor} onOpenFeedback={() => onOpenFeedback(report)} />
          ) : submitting ? (
            <SubmitForm week={week} onCancel={() => setSubmitting(false)} onSubmitted={onSubmitted} />
          ) : (
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50/80 px-5 py-4 ring-1 ring-sand-200/70">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-stone-500 ring-1 ring-sand-200">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink-900">Submit your Week {week} report</p>
                <p className="text-[13px] text-stone-500">Upload your weekly progress report to get evaluation from your supervisor.</p>
              </div>
              <Button onClick={() => setSubmitting(true)}>
                <Upload className="size-4" />
                Submit Report
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** A submitted week in one strip: score, feedback (opens the side panel), work done, file. */
function ReportStrip({
  report,
  supervisor,
  onOpenFeedback,
}: {
  report: WeeklyReport;
  supervisor: Supervisor;
  onOpenFeedback: () => void;
}) {
  const graded = report.grade != null;
  const file = report.files[0];
  const [viewing, setViewing] = useState(false);

  return (
    <div className="grid divide-sand-200 rounded-xl border border-sand-200 bg-white lg:grid-cols-[8.5rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.7fr)] lg:divide-x">
      <div className="px-5 py-4">
        <p className="text-[12.5px] text-stone-500">Report Score</p>
        <p className="tnum mt-1 text-[1.8rem] leading-none font-semibold text-ink-900">
          {graded ? report.grade : "-"}
          <span className="text-[1rem] font-normal text-stone-500"> / 10</span>
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenFeedback}
        disabled={!graded}
        className="group min-w-0 px-5 py-4 text-left transition-colors enabled:hover:bg-azure-50/40 disabled:cursor-default"
        title={graded ? "Read the full feedback" : undefined}
      >
        <p className="text-[12.5px] text-stone-500">Supervisor Feedback</p>
        {graded ? (
          <>
            <p className="mt-1 line-clamp-2 text-[14px] font-semibold text-ink-900 group-hover:text-azure-600">
              {plainText(report.feedback ?? "") || "No note left"}
            </p>
            <p className="mt-0.5 text-[12.5px] text-stone-500">- {supervisor.name}</p>
            <p className="mt-1 text-[12px] font-medium text-azure-600 opacity-0 transition-opacity group-hover:opacity-100">
              Read full feedback →
            </p>
          </>
        ) : (
          <p className="mt-1 text-[13.5px] text-stone-500">Awaiting evaluation</p>
        )}
      </button>

      <button
        type="button"
        onClick={onOpenFeedback}
        disabled={!graded}
        className="min-w-0 px-5 py-4 text-left disabled:cursor-default"
      >
        <p className="text-[12.5px] text-stone-500">Work Done</p>
        <p className="mt-1 line-clamp-3 text-[13.5px] text-ink-800">{plainText(report.summary) || "No summary added"}</p>
      </button>

      <div className="px-5 py-4">
        <p className="text-[12.5px] text-stone-500">Submitted File</p>
        {file ? (
          <div className="mt-1.5 flex items-center gap-3">
            <button type="button" onClick={() => setViewing(true)} title={`Open ${file.name}`} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <FileTypeIcon name={file.name} className="size-9" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium break-words text-ink-900 hover:text-azure-600">{file.name}</span>
                <span className="block text-[12px] text-stone-500">
                  {fileTypeLabel(file.name).split(" ")[0]} · {stamp(report.submittedAt)}
                  {report.files.length > 1 ? ` · +${report.files.length - 1} more` : ""}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => void download(file)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-azure-50 px-3 py-2 text-[13px] font-medium text-azure-600 hover:bg-azure-100"
            >
              <Download className="size-4" />
              Download
            </button>
            {viewing ? <DocumentViewer bucket="submissions" path={file.path} name={file.name} onClose={() => setViewing(false)} /> : null}
          </div>
        ) : (
          <p className="mt-1 text-[13px] text-stone-500">No file attached</p>
        )}
      </div>
    </div>
  );
}

/** The full feedback for a week in a side panel: supervisor, formatted feedback, score, work done and files. */
function FeedbackPanel({
  report,
  supervisor,
  onClose,
}: {
  report: WeeklyReport;
  supervisor: Supervisor;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/25 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="animate-fade-rise flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-[0_0_60px_-20px_rgba(13,31,63,0.5)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-sand-200/70 px-6 py-5">
          <div>
            <h2 id="feedback-title" className="text-[1.35rem] font-semibold text-ink-900">Feedback</h2>
            <p className="text-[13px] text-stone-500">
              <span className="font-semibold text-ink-900">Week {report.week}</span> · Submitted on {stamp(report.submittedAt)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-stone-500 hover:bg-slate-100 hover:text-ink-900">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-sand-200">
            <Avatar name={supervisor.name} src={supervisor.avatar} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink-900">{supervisor.name}</p>
              <p className="text-[12.5px] text-stone-500">Supervisor</p>
            </div>
            {report.gradedAt ? <p className="text-[12px] text-stone-500">{stamp(report.gradedAt)}</p> : null}
          </div>

          <div className="relative rounded-xl bg-azure-50/60 px-5 py-4 ring-1 ring-azure-100">
            <Quote className="absolute top-3 left-3 size-4 text-azure-500/50" aria-hidden />
            {report.feedback ? (
              <RichText text={report.feedback} className="pl-4 text-[13.5px] leading-relaxed text-ink-800" />
            ) : (
              <p className="pl-4 text-[13.5px] text-stone-500">No note was left with the grade.</p>
            )}
          </div>

          <div className="rounded-xl px-5 py-4 ring-1 ring-sand-200">
            <p className="text-[12.5px] text-stone-500">Score</p>
            <p className="tnum mt-1 text-[1.8rem] leading-none font-semibold text-ink-900">
              {report.grade ?? "-"}
              <span className="text-[1rem] font-normal text-stone-500"> / 10</span>
            </p>
          </div>

          <div className="rounded-xl px-5 py-4 ring-1 ring-sand-200">
            <p className="text-[12.5px] text-stone-500">
              Work Done <span className="text-stone-400">(as per submission)</span>
            </p>
            {report.summary ? (
              <RichText text={report.summary} className="mt-1 text-[13.5px] text-ink-800" />
            ) : (
              <p className="mt-1 text-[13.5px] text-stone-500">No summary added.</p>
            )}
          </div>

          <div className="rounded-xl px-5 py-4 ring-1 ring-sand-200">
            <p className="mb-2 text-[12.5px] text-stone-500">Submitted File{report.files.length > 1 ? "s" : ""}</p>
            {report.files.length ? (
              <div className="space-y-2">
                {report.files.map((f) => (
                  <div key={f.path} className="flex items-center gap-3">
                    <FileTypeIcon name={f.name} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium break-words text-ink-900">{f.name}</span>
                      <span className="block text-[12px] text-stone-500">{stamp(report.submittedAt)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void download(f)}
                      aria-label={`Download ${f.name}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-azure-50 text-azure-600 hover:bg-azure-100"
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-stone-500">No file attached.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/** The submission form for a week, opened from its "Submit Report" button. */
function SubmitForm({
  week,
  onCancel,
  onSubmitted,
}: {
  week: number;
  onCancel: () => void;
  onSubmitted: (week: number) => void;
}) {
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
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-slate-50/80 px-5 py-4 ring-1 ring-sand-200/70">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`r-file-${week}`}>Report file</Label>
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
          <Label htmlFor={`r-summary-${week}`}>Work done</Label>
          <RichEditor
            id={`r-summary-${week}`}
            rows={4}
            value={summary}
            onChange={setSummary}
            placeholder="Progress, blockers and next week's plan"
            hint=""
          />
        </div>
      </div>
      {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          <Upload className="size-4" />
          Submit week {week}
        </Button>
      </div>
    </form>
  );
}

/**
 * A midterm or endterm block: one upload for the whole set - the PPT, the
 * project report and the project synopsis - picked together or added later.
 */
function MilestonePhase({
  title,
  note,
  slot,
  files,
  reload,
}: {
  title: string;
  note: string;
  slot: MilestoneSlot;
  files: StoredFile[];
  reload: () => void;
}) {
  const { group } = usePortal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(picked: File[]) {
    if (!group || picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await repo.submitMilestone(group.id, slot, picked);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload the files.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15.5px] font-semibold text-ink-900">{title} submission</p>
          <p className="text-[13px] text-stone-500">{note}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-lg px-3 py-1 text-[12.5px] font-medium",
            files.length ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-600",
          )}
        >
          {files.length ? "Uploaded" : note.replace("After ", "Due after ")}
        </span>
      </div>
      <div className="mt-3 space-y-3 rounded-xl bg-violet-50/40 px-5 py-4 ring-1 ring-violet-100">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] text-ink-800">
              Upload all three here: the <strong>PPT</strong>, the <strong>Project Report</strong> and the{" "}
              <strong>Project Synopsis</strong>.
            </p>
            <p className="text-[12.5px] text-stone-500">The team lead uploads them, together or one at a time.</p>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.zip,image/png,image/jpeg"
              multiple
              disabled={busy}
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length > 0) void upload(picked);
                e.target.value = "";
              }}
            />
            <span className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-4 py-2 text-[13.5px] font-medium text-violet-700 transition-colors hover:bg-violet-50">
              <Upload className="size-4" />
              {busy ? "Uploading..." : files.length ? "Add more files" : "Upload Files"}
            </span>
          </label>
        </div>
        {files.length ? <FileChips bucket="submissions" files={files} /> : null}
        {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
      </div>
    </div>
  );
}
