"use client";

import { Award, Lightbulb } from "lucide-react";

import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import { useLoad } from "@/lib/use-load";
import { formatDateTime, timeAgo } from "@/lib/utils";

export default function GradesPage() {
  const { loading, student, group } = usePortal();
  const { data } = useLoad(
    async () => {
      const [grades, reports, groupGrade, achievements] = await Promise.all([
        repo.listGrades([student!.id]),
        group ? repo.listReports(group.id) : Promise.resolve([]),
        group ? repo.getGroupGrade(group.id) : Promise.resolve(null),
        repo.listAchievements().then((all) => all.filter((a) => a.studentId === student!.id)),
      ]);
      return { grades, reports: reports.filter((r) => r.grade != null), groupGrade, achievements };
    },
    student ? `${student.id}:${group?.id ?? ""}` : null,
  );

  if (loading || !student || !data) return <PageSkeleton />;

  const g = data.groupGrade;
  const synopsisVals = g ? [g.synopsis1, g.synopsis2].filter((v): v is number => v != null) : [];
  const synopsis = synopsisVals.length
    ? Math.round((synopsisVals.reduce((a, b) => a + b, 0) / synopsisVals.length) * 10) / 10
    : undefined;
  const weekly = g?.weekly15 ?? undefined;
  const plan = g
    ? [
        { label: "Updated synopsis", value: synopsis, max: 10 },
        { label: "Weekly progress report", value: weekly, max: 15 },
        { label: "Analysis process PPT", value: g.ppt15 ?? undefined, max: 15 },
        { label: "Design & implementation", value: g.design20 ?? undefined, max: 20 },
        { label: "End term exam", value: g.ete40 ?? undefined, max: 40 },
      ]
    : [];
  const total =
    plan.length > 0 && plan.every((c) => c.value != null)
      ? Math.round(plan.reduce((a, c) => a + (c.value ?? 0), 0) * 10) / 10
      : null;
  /** Bonus marks from approved achievements; added on top with no cap. */
  const bonusMarks = data.achievements
    .filter((a) => a.status === "approved")
    .reduce((n, a) => n + (a.bonusMarks ?? 0), 0);
  const withBonus = total != null ? Math.round((total + bonusMarks) * 10) / 10 : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Grades & Feedback"
        title="Grades and"
        emphasis="improvements."
        description="Marks from your supervisor, with what to work on next."
        scene="grades"
      />

      <Card>
        <CardHeader
          title="Semester score"
          description={
            g
              ? "Out of 100, as published by your supervisor."
              : "Out of 100. Your supervisor publishes it to the group when every group is graded."
          }
        />
        <div className="px-5 py-4">
          {g ? (
            <>
              <table className="w-full text-left">
                <tbody className="divide-y divide-sand-200/70">
                  {plan.map((c, i) => (
                    <tr key={i} className="pl-4">
                      <td className="py-2 text-[13px] text-stone-600">{c.label}</td>
                      <td className="tnum py-2 pr-4 text-right text-[13px] text-stone-600">
                        {c.value != null ? c.value : "-"}
                      </td>
                      <td className="tnum py-2 w-12 text-right text-[12px] text-stone-400">/{c.max}</td>
                    </tr>
                  ))}
                  {bonusMarks > 0 ? (
                    <tr>
                      <td className="py-2 pl-4 text-[13px] text-stone-600">Achievement bonus marks</td>
                      <td className="tnum py-2 pr-4 text-right text-[13px] font-medium text-sage-500">
                        +{bonusMarks}
                      </td>
                      <td className="tnum py-2 w-12" />
                    </tr>
                  ) : null}
                  <tr className="bg-sage-50/60">
                    <td className="py-2.5 pl-4 text-[13.5px] font-semibold text-ink-900">
                      Total{bonusMarks > 0 ? " (with bonus)" : ""}
                    </td>
                    <td className="tnum py-2.5 pr-4 text-right font-display text-[1.2rem] font-semibold text-sage-500">
                      {withBonus != null ? withBonus : total != null ? total : "-"}
                    </td>
                    <td className="tnum py-2.5 w-12 text-right text-[13px] font-semibold text-stone-500">/100</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-[11.5px] text-stone-400">
                Published by your supervisor {timeAgo(g.updatedAt)}.
                {bonusMarks > 0 ? " Bonus marks from approved achievements are added on top, with no cap." : ""}
              </p>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-stone-500">
              Not published yet. Your total out of 100 appears here as soon as your supervisor
              finishes grading and publishes the assessment.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Your individual grades"
        />
        {data.grades.length === 0 ? (
          <EmptyState icon={<Award className="size-5" />} title="No grades yet" description="Your supervisor's grades appear here." />
        ) : (
          <ul className="divide-y divide-sand-200/70">
            {data.grades.map((g) => (
              <li key={g.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-ink-900">{g.title}</p>
                  <p className="text-[12px] text-stone-500">{formatDateTime(g.createdAt)}</p>
                  {g.improvements ? (
                    <p className="mt-2 flex gap-2 rounded-[12px] bg-gold-50/80 px-3 py-2 text-[13px] text-stone-700">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold-500" />
                      <span><span className="font-semibold">To improve:</span> {g.improvements}</span>
                    </p>
                  ) : null}
                </div>
                <p className="tnum font-display text-[1.6rem] leading-none text-ink-900">
                  {g.score}
                  <span className="text-[1rem] text-stone-400">/{g.maxScore}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Group weekly report grades" />
        {data.reports.length === 0 ? (
          <EmptyState title="No graded reports yet" scene="reports" />
        ) : (
          <ul className="divide-y divide-sand-200/70">
            {data.reports.map((r) => (
              <li key={r.id} className="flex items-start gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink-900">Week {r.week}</p>
                  {r.feedback ? <p className="text-[12.5px] text-stone-500">{r.feedback}</p> : null}
                </div>
                <p className="tnum font-display text-[1.25rem] text-ink-900">{r.grade}/10</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
