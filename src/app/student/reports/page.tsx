"use client";

import { useRef, useState, type FormEvent } from "react";
import { Upload } from "lucide-react";

import { FileLink } from "@/components/shared/file-link";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import { useLoad } from "@/lib/use-load";
import { formatDateTime, timeAgo } from "@/lib/utils";

/** One slot per weekly report the group owes (set by the supervisor, 5 by default). */
export default function ReportsPage() {
  const { loading, student, group, refresh } = usePortal();
  const reports = useLoad(() => repo.listReports(group!.id), group ? group.id : null);
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
          <div className="pb-6 text-center">
            <ButtonLink href="/student/group" size="sm">Go to my group</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const byWeek = new Map((reports.data ?? []).map((r) => [r.week, r]));
  const weeks = Array.from({ length: group.reportCount }, (_, i) => i + 1);
  const submitted = weeks.filter((w) => byWeek.has(w)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Weekly Reports"
        title="Weekly"
        emphasis="reports."
        description={`${submitted} of ${group.reportCount} submitted. One report per week for the whole team - you can replace one until your supervisor grades it.`}
        scene="reports"
      />

      {submittedWeek != null ? (
        <p role="status" className="text-[13px] text-sage-500">
          Week {submittedWeek} report submitted - your supervisor has been notified.
        </p>
      ) : null}

      <Card>
        <CardHeader title="Report slots" description="Pending slots are waiting for your team's report." />
        {!reports.data ? (
          <CardBody><p className="text-[13px] text-stone-500">Loading…</p></CardBody>
        ) : (
          <ul className="divide-y divide-sand-200/70">
            {weeks.map((week) => {
              const r = byWeek.get(week);
              return (
                <li key={week} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-display text-[16px] text-ink-900">
                        Week {week}
                        <Badge tone={r ? (r.grade != null ? "sage" : "sky") : "gold"} dot>
                          {r ? (r.grade != null ? "Graded" : "Submitted") : "Pending"}
                        </Badge>
                      </p>
                      {r ? (
                        <>
                          <p className="text-[12px] text-stone-500" title={formatDateTime(r.submittedAt)}>
                            Submitted {timeAgo(r.submittedAt)}
                          </p>
                          <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-stone-600">{r.summary}</p>
                          {r.filePath && r.fileName ? (
                            <FileLink bucket="submissions" path={r.filePath} name={r.fileName} className="mt-2" />
                          ) : null}
                          {r.feedback ? (
                            <p className="mt-3 rounded-[12px] bg-azure-50/70 px-3 py-2 text-[13px] text-ink-800">
                              <span className="font-semibold">Supervisor feedback:</span> {r.feedback}
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {r?.grade != null ? (
                      <div className="rounded-xl bg-sage-100 px-3 py-2 text-center text-sage-500">
                        <p className="tnum font-display text-xl leading-none">{r.grade}</p>
                        <p className="mt-1 text-[10.5px] font-semibold tracking-wide uppercase">out of 10</p>
                      </div>
                    ) : null}
                  </div>
                  {r?.grade == null ? (
                    <SubmitReport
                      groupId={group.id}
                      studentId={student.id}
                      week={week}
                      replacing={r != null}
                      onSubmitted={(w) => {
                        setSubmittedWeek(w);
                        void reports.reload();
                        void refresh();
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SubmitReport({
  groupId,
  studentId,
  week,
  replacing,
  onSubmitted,
}: {
  groupId: string;
  studentId: string;
  week: number;
  replacing: boolean;
  onSubmitted: (week: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await repo.submitReport({ groupId, studentId, week, summary: summary.trim(), file: file ?? undefined });
      setSummary("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setOpen(false);
      onSubmitted(week);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the report.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant={replacing ? "ghost" : "primary"} className="mt-3" onClick={() => setOpen(true)}>
        <Upload className="size-3.5" />
        {replacing ? "Replace report" : `Submit week ${week} report`}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-4 rounded-[14px] bg-white/60 p-4">
      <Field label="Report file" htmlFor={`r-file-${week}`} help="PDF, Word, PowerPoint, ZIP or images - up to 25 MB.">
        <input
          id={`r-file-${week}`}
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-[13px] text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-azure-50 file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-azure-600"
        />
      </Field>
      <Field label="What did the team do this week?" htmlFor={`r-summary-${week}`}>
        <Textarea
          id={`r-summary-${week}`}
          rows={3}
          required
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Progress, blockers and next week's plan"
        />
      </Field>
      {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={busy}>
          <Upload className="size-3.5" />
          Submit week {week}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
