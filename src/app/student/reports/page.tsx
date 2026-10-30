"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, FileText, MessageCircleQuestion, Presentation, ScrollText, Trophy, Upload, type LucideIcon } from "lucide-react";

import { FileLink } from "@/components/shared/file-link";
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
import { timeAgo, cn } from "@/lib/utils";

/** One weekly report slot, the way the mockup shows it: a card per week. */
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

  const byWeek = new Map((reports.data ?? []).map((r) => [r.week, r]));
  const weeks = Array.from({ length: group.reportCount }, (_, i) => i + 1);
  const submitted = weeks.filter((w) => byWeek.has(w)).length;

  const slotOf = (s: MilestoneSlot) => (milestones.data ?? []).find((m) => m.slot === s);

  /** One week's card, plus a milestone block after week 3 (midterm) and 7 (endterm). */
  function weekBlock(week: number): ReactNode {
    return (
      <div key={week} className="space-y-4">
        <WeekCard
          week={week}
          report={byWeek.get(week)}
          mentorName={mentor?.fullName ? mentor.fullName : "your supervisor"}
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
      <PageHeader
        eyebrow="Weekly Reports"
        title="Weekly"
        emphasis="reports."
        description={`${submitted} of ${group.reportCount} submitted. One report per week for the whole team - you can replace one until your supervisor grades it. PPT and synopsis submissions come in after week 3 (midterm) and week 7 (endterm).`}
        scene="reports"
      />

      {submittedWeek != null ? (
        <p role="status" className="text-[13px] text-sage-500">
          Week {submittedWeek} report submitted - your supervisor has been notified.
        </p>
      ) : null}

      <div className="space-y-4">
        {weeks.map((week) => weekBlock(week))}
      </div>
    </div>
  );
}

type Slot = WeeklyReport | undefined;

/** A single week's card: header row, then the score / report / feedback body. */
function WeekCard({
  week,
  report,
  mentorName,
  onSubmitted,
}: {
  week: number;
  report: Slot;
  mentorName: string;
  onSubmitted: (week: number) => void;
}) {
  const graded = report?.grade != null;
  const pending = !report;
  const [open, setOpen] = useState(!pending);

  return (
    <Card>
      <button
        type="button"
        onClick={() => pending && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-4 px-5 py-4 text-left",
          pending && "cursor-pointer",
          !pending && "cursor-default",
        )}
        aria-expanded={!pending || open}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-[17px] text-ink-900">Week {week}</span>
          <Badge tone={graded ? "sage" : pending ? "gold" : "sky"} dot>
            {graded ? "Graded" : pending ? "Pending" : "Submitted"}
          </Badge>
          {report ? (
            <span className="text-[12px] text-stone-500">
              {graded ? `Evaluated ${timeAgo(report.gradedAt ?? report.submittedAt)}` : `Sent ${timeAgo(report.submittedAt)}`}
            </span>
          ) : null}
        </div>

        {pending ? (
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-azure-50 px-3 py-1.5 text-[13px] font-medium text-azure-600 ring-1 ring-azure-100">
              <Upload className="size-3.5" />
              Submit Week {week} Report
            </span>
            <ChevronDown className={cn("size-4 text-stone-400 transition-transform", open && "rotate-180")} />
          </span>
        ) : null}
      </button>

      {pending ? (
        open ? <SubmitForm week={week} onSubmitted={onSubmitted} /> : null
      ) : (
        report ? <ReportBody report={report} mentorName={mentorName} /> : null
      )}
    </Card>
  );
}

/** The filled-in body: mentor score tile, the submitted file, and feedback. */
function ReportBody({ report, mentorName }: { report: WeeklyReport; mentorName: string }) {
  const grade = report.grade;
  const graded = grade != null;
  return (
    <div className="border-t border-sand-200/70 px-5 py-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {graded ? (
          <div className="rounded-[14px] bg-sage-100 p-4 text-sage-500 ring-1 ring-sage-500/15">
            <div className="flex items-center justify-between">
              <p>
                <span className="tnum font-display text-[2.3rem] leading-none">{grade}</span>
                <span className="text-[15px] text-sage-500/80"> / 10</span>
              </p>
              <span className="flex size-10 items-center justify-center rounded-full bg-sage-500/15">
                <Trophy className="size-5" />
              </span>
            </div>
            <p className="mt-1 text-[10.5px] font-semibold tracking-wide text-sage-500/70 uppercase">Mentor score</p>
            <p className="mt-2 text-[13px] font-medium">{scoreCaption(grade)}</p>
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">Submitted report</p>
          {report.summary ? (
            <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-stone-600">{report.summary}</p>
          ) : null}
          {report.filePath && report.fileName ? (
            <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/70 px-3 py-2.5 ring-1 ring-sand-200">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileIcon />
                <span className="truncate text-[13px] font-medium text-ink-900">{report.fileName}</span>
              </div>
              <FileLink bucket="submissions" path={report.filePath} name={report.fileName} />
            </div>
          ) : null}
          {graded ? (
            <div className="rounded-[12px] bg-azure-50/70 px-3.5 py-3 ring-1 ring-azure-100">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-azure-600 uppercase">
                <MessageCircleQuestion className="size-3.5" />
                {mentorName}&apos;s feedback
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line text-ink-800">
                {report.feedback || "No note was left with the grade."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A one-line verdict for the score tile. */
function scoreCaption(grade: number): string {
  if (grade >= 9) return "Excellent performance";
  if (grade >= 7) return "Strong progress";
  if (grade >= 5) return "Good work, keep it up";
  return "Needs attention - check the feedback";
}

/** The inline form for a week that hasn't been submitted yet. */
function SubmitForm({ week, onSubmitted }: { week: number; onSubmitted: (week: number) => void }) {
  const { student, group } = usePortal();
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!student || !group) return;
    setBusy(true);
    setError(null);
    try {
      await repo.submitReport({ groupId: group.id, studentId: student.id, week, summary: summary.trim(), file: file ?? undefined });
      setSummary("");
      setFile(null);
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
            files={file ? [file] : []}
            onChange={(files) => setFile(files[0] ?? null)}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,image/png,image/jpeg"
            specs="PDF, Word, PowerPoint, ZIP or images · up to 25 MB"
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

/** A small red PDF glyph, matching the mockup's file card. */
function FileIcon() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-clay-100 text-clay-500 ring-1 ring-clay-500/15">
      <FileText className="size-4" />
    </span>
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

  async function upload(slot: MilestoneSlot, file: File) {
    if (!group) return;
    setBusy(slot);
    setError(null);
    try {
      await repo.submitMilestone(group.id, slot, file);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload the file.");
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
          const filePath = m?.filePath;
          const fileName = m?.fileName;
          return (
            <div key={slot} className="rounded-[12px] bg-white/70 p-3 ring-1 ring-sand-200">
              <p className="flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-stone-500">
                <Icon className="size-3.5 text-azure-600" />
                {label}
              </p>
              {filePath && fileName ? (
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileIcon />
                    <span className="truncate text-[12.5px] font-medium text-ink-900">{fileName}</span>
                  </div>
                  <FileLink bucket="submissions" path={filePath} name={fileName} />
                </div>
              ) : null}
              <label className="mt-2.5 block cursor-pointer">
                <input
                  type="file"
                  className="sr-only"
                  accept=".pdf,.ppt,.pptx"
                  disabled={busy != null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(slot, f);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-azure-50 px-2.5 py-1.5 text-[12px] font-medium text-azure-600 ring-1 ring-azure-100 transition-colors hover:bg-azure-50/70 disabled:opacity-50">
                  <Upload className="size-3.5" />
                  {busy === slot ? "Uploading..." : filePath && fileName ? "Replace file" : "Upload"}
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
