"use client";

import Link from "next/link";
import { Award, Check } from "lucide-react";
import type { ReactNode } from "react";

import { FileLink } from "@/components/shared/file-link";
import { Card, CardHeader } from "@/components/ui/card";
import type { GroupGrade, GroupMilestone } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

/** Round an average of two /10 marks to the /10 "updated synopsis" component. */
function synopsisScore(s1: number | null, s2: number | null): number | null {
  const vals = [s1, s2].filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/** Every file of a phase (midterm or endterm), shown compactly next to a plan row. */
export function FileTag({ ms }: { ms: Array<GroupMilestone | undefined> }) {
  const files = ms.flatMap((m) => m?.files ?? []);
  if (files.length === 0) return <span className="text-stone-400">not uploaded</span>;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {files.map((f) => (
        <FileLink key={f.path} bucket="submissions" path={f.path} name={f.name} variant="pill" />
      ))}
    </span>
  );
}

/**
 * The group's 100-point assessment plan: internal (60) plus the end term exam
 * (40). Shown read-only on the group page, with a Final grading window the
 * supervisor opens when it is time to grade.
 */
export function GradingPlanCard({
  groupId,
  milestones,
  grade,
  weeklyAverage,
  canGrade,
}: {
  groupId: string;
  milestones: GroupMilestone[];
  grade: GroupGrade | null;
  /** Average of the graded weekly reports, scaled to 15 (used when the teacher hasn't overridden it). */
  weeklyAverage: number | null;
  canGrade: boolean;
}) {
  const bySlot = (s: GroupMilestone["slot"]) => milestones.find((m) => m.slot === s);
  // Each phase is one upload of the PPT, project report and synopsis (older uploads may sit in the synopsis slot).
  const mid = [bySlot("mid_ppt"), bySlot("mid_synopsis")];
  const ete = [bySlot("ete_ppt"), bySlot("ete_synopsis")];

  const synopsis = synopsisScore(grade?.synopsis1 ?? null, grade?.synopsis2 ?? null);
  const weekly = grade?.weekly15 ?? weeklyAverage;
  const components: Array<{ label: string; value: number | null; max: number; note?: ReactNode }> = [
    {
      label: "Updated synopsis",
      value: synopsis,
      max: 10,
      note: (
        <span className="text-[11px] text-stone-400">
          Midterm: <FileTag ms={mid} /> · Endterm: <FileTag ms={ete} />
        </span>
      ),
    },
    { label: "Weekly progress report", value: weekly, max: 15 },
    {
      label: "Analysis process PPT",
      value: grade?.ppt15 ?? null,
      max: 15,
      note: (
        <span className="text-[11px] text-stone-400">
          Midterm: <FileTag ms={mid} /> · Endterm: <FileTag ms={ete} />
        </span>
      ),
    },
    { label: "Design & implementation", value: grade?.design20 ?? null, max: 20 },
    { label: "End term exam", value: grade?.ete40 ?? null, max: 40 },
  ];

  const values = components.map((c) => c.value);
  const complete = values.every((v) => v != null);
  const total = complete ? Math.round(values.reduce((a, v) => a + (v as number), 0) * 10) / 10 : null;
  const internal =
    synopsis != null && weekly != null && grade?.ppt15 != null && grade?.design20 != null
      ? Math.round((synopsis + weekly + (grade!.ppt15 as number) + (grade!.design20 as number)) * 10) / 10
      : null;

  return (
    <Card>
      <CardHeader
        title="Assessment plan"
        description="Out of 100: internal assessment plus the end term exam. Final grading opens in its own window when it is time to grade."
        action={
          canGrade ? (
            <Link
              href={`/faculty/groups/${groupId}/grading`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-lg bg-azure-50 px-3 py-1.5 text-[12.5px] font-medium text-azure-600 ring-1 ring-azure-100 transition-colors hover:bg-azure-50/70"
            >
              <Award className="size-3.5" />
              Final grading
            </Link>
          ) : null
        }
      />
      <div className="px-5 py-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-sand-200/60 bg-white/40 text-[10.5px] tracking-[0.12em] text-ink-400 uppercase">
              <th className="py-2 pr-4 font-semibold">Component</th>
              <th className="w-20 py-2 pr-4 text-right font-semibold">Score</th>
              <th className="w-16 py-2 text-right font-semibold">Max</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200/70">
            <tr>
              <td className="py-2.5 pr-4 text-[13px] font-medium text-ink-900">Internal assessment</td>
              <td className="tnum py-2.5 pr-4 text-right text-[13px] text-stone-600">{internal != null ? internal : "-"}</td>
              <td className="tnum py-2.5 text-right text-[13px] text-stone-500">60</td>
            </tr>
            {components.map((c, i) => (
              <tr key={i} className="pl-6">
                <td className="py-2 pr-4">
                  <p className="text-[12.5px] text-stone-600">{c.label}</p>
                  {c.note ? <div className="mt-1">{c.note}</div> : null}
                </td>
                <td className="tnum py-2 pr-4 text-right text-[13px] text-stone-600">{c.value != null ? c.value : "-"}</td>
                <td className="tnum py-2 text-right text-[12px] text-stone-400">{c.max}</td>
              </tr>
            ))}
            <tr className="bg-sage-50/60">
              <td className="py-2.5 pr-4 text-[13.5px] font-semibold text-ink-900">Total</td>
              <td className="tnum py-2.5 pr-4 text-right font-display text-[15px] font-semibold text-sage-500">{total != null ? total : "-"}</td>
              <td className="tnum py-2.5 text-right text-[13px] font-semibold text-stone-500">100</td>
            </tr>
          </tbody>
        </table>

        {grade?.updatedAt ? (
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-stone-400">
            <Check className="size-3.5 text-sage-500" />
            Last saved {timeAgo(grade.updatedAt)}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
