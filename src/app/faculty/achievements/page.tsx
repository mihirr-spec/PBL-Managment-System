"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";

import { AchievementCard } from "@/components/achievements/achievement-card";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { MAX_BONUS_MARKS } from "@/lib/achievements";
import { listAchievements } from "@/lib/data/repository";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "review", label: "Needs you" },
  { key: "waiting", label: "Waiting on student" },
  { key: "decided", label: "Decided" },
] as const;

export default function FacultyAchievementsPage() {
  const { data, error, reload } = useLoad(() => listAchievements(), "achievements");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("review");

  if (error) return <p role="alert" className="text-[13px] text-clay-500">{error}</p>;
  if (!data) return <PageSkeleton />;

  const groups = {
    review: data.filter((a) => a.status === "submitted"),
    waiting: data.filter((a) => a.status === "needs_info"),
    decided: data.filter((a) => a.status === "approved" || a.status === "rejected"),
  };
  const visible = groups[tab];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Achievements"
        title="Student"
        emphasis="achievements."
        description={`Achievements filed by students in your groups, with their proof. Approve (with up to ${MAX_BONUS_MARKS} bonus marks), ask for more details, comment, or reject - the student is notified each time. Approved ones go to the Student Excellence Award shortlist.`}
        scene="achievements"
      />
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-white/60 p-1 ring-1 ring-white">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-[13px] font-medium",
              tab === t.key ? "bg-ink-800 text-white" : "text-stone-600 hover:text-ink-800",
            )}
          >
            {t.label} ({groups[t.key].length})
          </button>
        ))}
      </div>
      <Card>
        {visible.length === 0 ? (
          <EmptyState icon={<Trophy className="size-5" />} title="Nothing here" scene="achievements" />
        ) : (
          <div className="divide-y divide-sand-200/70">
            {visible.map((a) => (
              <AchievementCard key={a.id} achievement={a} viewer="reviewer" onChanged={() => void reload()} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
