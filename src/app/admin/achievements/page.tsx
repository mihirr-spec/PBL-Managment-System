"use client";

import { useState } from "react";
import { Medal, Trophy } from "lucide-react";

import { AchievementCard } from "@/components/achievements/achievement-card";
import {
  LinkedInAccountCard,
  LinkedInPreview,
  pendingLinkedInPreview,
  type PendingApproval,
} from "@/components/achievements/linkedin-preview";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ACHIEVEMENT_CATEGORIES } from "@/lib/achievements";
import { listAchievements } from "@/lib/data/repository";
import type { Achievement } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

/**
 * PBL office: the portal's central LinkedIn account, the Student Excellence
 * Award shortlist (approved achievements ranked per student) and every
 * approved achievement's LinkedIn post.
 */
export default function AdminAchievementsPage() {
  const { data, error, reload } = useLoad(() => listAchievements(), "achievements");
  // Reopens the preview after a "Connect LinkedIn" round trip.
  const [preview, setPreview] = useState<{ id: string; approval?: PendingApproval } | null>(() => {
    const id = pendingLinkedInPreview();
    return id ? { id } : null;
  });
  const [category, setCategory] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);

  if (error) return <p role="alert" className="text-[13px] text-clay-500">{error}</p>;
  if (!data) return <PageSkeleton />;
  // Approving from the preview shows the achievement before it is approved.
  const previewed = data.find((a) => a.id === preview?.id && (preview.approval || a.status === "approved"));

  const approved = data.filter((a) => a.status === "approved");
  const shortlist = rankStudents(approved);
  const listed = (showAll ? data : approved).filter((a) => category === "all" || a.category === category);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Excellence & LinkedIn"
        title="Student"
        emphasis="excellence."
        description="Achievements approved by supervisors. The shortlist ranks students for the Student Excellence Award. Posts go out from the portal's LinkedIn account below when supervisors approve; any approved achievement not yet posted can be previewed and posted here."
        scene="achievements"
      />

      <LinkedInAccountCard />

      <Card>
        <CardHeader
          title="Student Excellence Award - shortlist"
          description="Ranked by approved achievements, then by bonus marks."
        />
        {shortlist.length === 0 ? (
          <EmptyState icon={<Medal className="size-5" />} title="No approved achievements yet" scene="achievements" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] tracking-wide text-stone-400 uppercase">
                  <th className="px-5 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Student</th>
                  <th className="px-2 py-2 font-medium">Approved</th>
                  <th className="px-2 py-2 font-medium">Bonus marks</th>
                  <th className="px-5 py-2 font-medium">Categories</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200/70">
                {shortlist.map((s, i) => (
                  <tr key={s.studentId}>
                    <td className="tnum px-5 py-3 text-stone-500">{i + 1}</td>
                    <td className="px-2 py-3">
                      <p className="font-medium text-ink-900">{s.name}</p>
                      <p className="text-[12px] text-stone-500">{s.registration}</p>
                    </td>
                    <td className="tnum px-2 py-3 text-ink-800">{s.count}</td>
                    <td className="tnum px-2 py-3 text-ink-800">+{s.bonus}</td>
                    <td className="px-5 py-3 text-stone-600">{s.categories.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 rounded-xl bg-white/60 p-1 ring-1 ring-white">
          {[false, true].map((all) => (
            <button
              key={String(all)}
              onClick={() => setShowAll(all)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-[13px] font-medium",
                showAll === all ? "bg-ink-800 text-white" : "text-stone-600 hover:text-ink-800",
              )}
            >
              {all ? `All (${data.length})` : `Approved (${approved.length})`}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className="h-9 rounded-lg bg-white/70 px-3 text-[13px] text-stone-700 ring-1 ring-white"
        >
          <option value="all">All categories</option>
          {ACHIEVEMENT_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      <Card>
        {listed.length === 0 ? (
          <EmptyState icon={<Trophy className="size-5" />} title="Nothing to show" scene="achievements" />
        ) : (
          <div className="divide-y divide-sand-200/70">
            {listed.map((a) => (
              <AchievementCard
                key={a.id}
                achievement={a}
                viewer="admin"
                onChanged={() => void reload()}
                onPreview={() => setPreview({ id: a.id })}
                onApproveWithPreview={(approval) => setPreview({ id: a.id, approval })}
              />
            ))}
          </div>
        )}
      </Card>
      {previewed ? (
        <LinkedInPreview
          achievement={previewed}
          approval={preview?.approval}
          onClose={() => setPreview(null)}
          onChanged={() => void reload()}
        />
      ) : null}
    </div>
  );
}

function rankStudents(approved: Achievement[]) {
  const byStudent = new Map<
    string,
    { studentId: string; name: string; registration: string; count: number; bonus: number; categories: string[] }
  >();
  for (const a of approved) {
    const row = byStudent.get(a.studentId) ?? {
      studentId: a.studentId,
      name: a.student?.fullName ?? "Student",
      registration: a.student?.registrationNumber ?? "",
      count: 0,
      bonus: 0,
      categories: [],
    };
    row.count += 1;
    row.bonus += a.bonusMarks ?? 0;
    const label = ACHIEVEMENT_CATEGORIES.find((c) => c.key === a.category)?.label ?? a.category;
    if (!row.categories.includes(label)) row.categories.push(label);
    byStudent.set(a.studentId, row);
  }
  return [...byStudent.values()].sort((x, y) => y.count - x.count || y.bonus - x.bonus || x.name.localeCompare(y.name));
}
