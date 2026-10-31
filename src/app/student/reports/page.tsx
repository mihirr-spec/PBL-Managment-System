"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, ClipboardList, ScrollText, Upload } from "lucide-react";

import { FileChips, FileRow } from "@/components/shared/file-link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/card";
import { FileDrop } from "@/components/ui/file-drop";
import { Label } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import type { MilestoneSlot, StoredFile, WeeklyReport } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { RichEditor } from "@/components/shared/rich-editor";
import { RichText } from "@/components/shared/rich-text";
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
            title="Midterm (MTE)"
            note="After week 3"
            slot="mid_ppt"
            files={[...(slotOf("mid_ppt")?.files ?? []), ...(slotOf("mid_synopsis")?.files ?? [])]}
            reload={() => void milestones.reload()}
          />
        ) : null}
        {week === 7 ? (
          <MilestonePhase
            title="Endterm (ETE)"
            note="After week 7"
            slot="ete_ppt"
            files={[...(slotOf("ete_ppt")?.files ?? []), ...(slotOf("ete_synopsis")?.files ?? [])]}
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

/** A small grey "Status" label with the value under it in the status colour. */
function StatusText({ tone, children }: { tone: "blue" | "grey" | "amber"; children: ReactNode }) {
  return (
    <span className="shrink-0 text-right leading-tight">
      <span className="block text-[11.5px] text-stone-500">Status</span>
      <span
        className={cn(
          "block text-[13px] font-semibold",
          tone === "blue" ? "text-azure-600" : tone === "amber" ? "text-gold-600" : "text-stone-600",
        )}
      >
        {children}
      </span>
    </span>
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
        <StatusText tone={graded ? "blue" : "grey"}>{status}</StatusText>
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

/**
 * A submitted week, two lines: the score beside the supervisor's feedback,
 * then what the team worked on beside the report file.
 */
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
      <div className="grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="flex items-center gap-4 rounded-xl border border-sand-200 bg-white px-5 py-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-sand-200 text-stone-500">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <p className="text-[12.5px] text-stone-500">Score</p>
            <p className="tnum font-display text-[1.6rem] leading-tight text-ink-900">
              {graded ? report.grade : "-"}
              <span className="text-[1rem] text-stone-600"> / 10</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl bg-azure-50/60 px-4 py-3 ring-1 ring-azure-100">
          <Avatar name={mentorName} src={mentorAvatar} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[12.5px] text-stone-500">
                Feedback{graded ? <span className="font-semibold text-ink-900"> · {mentorName}</span> : null}
              </p>
              {report.gradedAt ? <p className="text-[12px] text-stone-500">{stamp(report.gradedAt)}</p> : null}
            </div>
            {graded ? (
              report.feedback ? (
                <RichText text={report.feedback} className="mt-0.5 text-[13.5px] text-ink-800" />
              ) : (
                <p className="mt-0.5 text-[13.5px] text-stone-500">No note was left with the grade.</p>
              )
            ) : (
              <p className="mt-0.5 text-[13.5px] text-stone-500">Not evaluated yet. You will be notified when it is.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-sand-200 bg-white px-4 py-3">
          <p className="text-[12.5px] text-stone-500">Worked on</p>
          {report.summary ? (
            <RichText text={report.summary} className="mt-0.5 text-[13.5px] text-ink-800" />
          ) : (
            <p className="mt-0.5 text-[13.5px] text-stone-500">The team did not add a summary.</p>
          )}
        </div>
        <div className="space-y-2">
          {report.files.length > 0 ? (
            report.files.map((f) => (
              <FileRow key={f.path} bucket="submissions" path={f.path} name={f.name} meta={`Sent ${stamp(report.submittedAt)}`} />
            ))
          ) : (
            <p className="flex h-full items-center rounded-xl border border-dashed border-sand-200 px-4 py-3 text-[13px] text-stone-500">
              No report file was attached.
            </p>
          )}
        </div>
      </div>
    </div>
  );
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
          <Label htmlFor={`r-summary-${week}`}>Worked on (optional)</Label>
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={busy}>
          <Upload className="size-3.5" />
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
    <Card>
      <div className="flex items-center justify-between gap-3 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-gold-50 text-gold-600">
            <ScrollText className="size-4" />
          </span>
          <div>
            <p className="text-[14.5px] font-semibold text-ink-900">{title} submission</p>
            <p className="text-[12.5px] text-stone-500">{note}</p>
          </div>
        </div>
        <StatusText tone={files.length > 0 ? "blue" : "amber"}>
          {files.length > 0 ? "Uploaded" : note.replace("After ", "Due after ")}
        </StatusText>
      </div>
      <div className="space-y-3 border-t border-sand-200/70 px-6 py-4">
        <p className="rounded-xl bg-gold-50/60 px-4 py-2.5 text-[13px] text-ink-800 ring-1 ring-gold-500/15">
          Upload all three here: the <strong>PPT</strong>, the <strong>Project Report</strong> and the{" "}
          <strong>Project Synopsis</strong>. The team lead uploads them, together or one at a time.
        </p>
        {files.length > 0 ? <FileChips bucket="submissions" files={files} /> : null}
        <label className="inline-block cursor-pointer">
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
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-azure-50 px-3 py-2 text-[13px] font-medium text-azure-600 ring-1 ring-azure-100 transition-colors hover:bg-azure-100">
            <Upload className="size-4" />
            {busy ? "Uploading..." : files.length > 0 ? "Add more files" : "Upload PPT, report and synopsis"}
          </span>
        </label>
        {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
      </div>
    </Card>
  );
}
