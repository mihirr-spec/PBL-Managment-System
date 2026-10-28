"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Clock3, FileText, Trophy } from "lucide-react";

import { AchievementDetail, AchievementRow, needsAction } from "@/components/achievements/achievement-card";
import {
  LinkedInPreview,
  pendingLinkedInPreview,
  type PendingApproval,
} from "@/components/achievements/linkedin-preview";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { FilterMenu, PillTabs, SearchBox } from "@/components/ui/toolbar";
import { ACHIEVEMENT_CATEGORIES, achievementMatches, MAX_BONUS_MARKS } from "@/lib/achievements";
import { checkLinkedInPosts, listAchievements } from "@/lib/data/repository";
import { useLoad } from "@/lib/use-load";

const TABS = [
  { key: "review", label: "Action needed", icon: FileText },
  { key: "waiting", label: "Waiting on student", icon: Clock3 },
  { key: "decided", label: "Decided", icon: CircleCheck },
] as const;

const CATEGORY_FILTER = [
  { value: "all", label: "All categories" },
  ...ACHIEVEMENT_CATEGORIES.map((c) => ({ value: c.key, label: c.label })),
];

/** What each tab says when it has nothing in it. */
const EMPTY = {
  review: { title: "Nothing here yet", description: "There are no achievement submissions that need your review right now. Submissions from your students will appear here." },
  waiting: { title: "Nothing waiting", description: "When you ask a student for more details, their achievement waits here until they reply." },
  decided: { title: "No decisions yet", description: "Achievements you approve or reject are kept here, with their LinkedIn posts." },
} as const;

export default function FacultyAchievementsPage() {
  const { data, error, reload } = useLoad(() => listAchievements(), "achievements");
  // Posts deleted on LinkedIn come back to "Action needed".
  useEffect(() => {
    checkLinkedInPosts().then(
      (removed) => removed.length > 0 && void reload(),
      () => {},
    );
  }, [reload]);
  // Reopens the preview after a "Connect LinkedIn" round trip.
  const [preview, setPreview] = useState<{ id: string; approval?: PendingApproval } | null>(() => {
    const id = pendingLinkedInPreview();
    return id ? { id } : null;
  });
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("review");
  const [openId, setOpenId] = useState<string | null>(() => pendingLinkedInPreview());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  if (error) return <p role="alert" className="text-[13px] text-clay-500">{error}</p>;
  if (!data) return <PageSkeleton />;
  // Approving from the preview shows the achievement before it is approved.
  const previewed = data.find((a) => a.id === preview?.id && (preview.approval || a.status === "approved"));
  const opened = data.find((a) => a.id === openId);

  const shown = data.filter((a) => (category === "all" || a.category === category) && achievementMatches(a, query));
  const groups = {
    review: shown.filter(needsAction),
    waiting: shown.filter((a) => a.status === "needs_info"),
    decided: shown.filter((a) => (a.status === "approved" || a.status === "rejected") && !needsAction(a)),
  };
  const visible = groups[tab];
  const searching = query.trim() !== "" || category !== "all";

  const previewModal = previewed ? (
    <LinkedInPreview
      achievement={previewed}
      approval={preview?.approval}
      onClose={() => setPreview(null)}
      onChanged={() => void reload()}
    />
  ) : null;

  if (opened) {
    return (
      <div className="space-y-6">
        <AchievementDetail
          achievement={opened}
          viewer="reviewer"
          onBack={() => setOpenId(null)}
          onChanged={() => void reload()}
          onPreview={() => setPreview({ id: opened.id })}
          onApproveWithPreview={(approval) => setPreview({ id: opened.id, approval })}
        />
        {previewModal}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Achievements"
        title="Student"
        emphasis="achievements."
        description={`Achievements filed by students in your groups, with their proof. Open one to approve it (with up to ${MAX_BONUS_MARKS} bonus marks), ask for more details or reject it. Approving shows the LinkedIn post first, then approves and posts it from the portal's LinkedIn account.`}
        scene="achievements"
      />
      <div className="flex flex-wrap items-center gap-3">
        <PillTabs
          label="Achievements"
          value={tab}
          onChange={setTab}
          items={TABS.map((t) => ({ ...t, count: groups[t.key].length }))}
        />
        <div className="ml-auto flex w-full gap-3 sm:w-auto">
          <SearchBox value={query} onChange={setQuery} placeholder="Search achievements..." className="flex-1 sm:w-72" />
          <FilterMenu value={category} onChange={setCategory} options={CATEGORY_FILTER} />
        </div>
      </div>
      <Card>
        {visible.length === 0 ? (
          searching ? (
            <EmptyState icon={<Trophy />} title="No matches" description="Nothing in this list matches your search or filter." scene="achievements" />
          ) : (
            <EmptyState icon={<Trophy />} title={EMPTY[tab].title} description={EMPTY[tab].description} scene="achievements" />
          )
        ) : (
          <div className="divide-y divide-azure-100/70">
            {visible.map((a) => (
              <AchievementRow key={a.id} achievement={a} viewer="reviewer" onOpen={() => setOpenId(a.id)} />
            ))}
          </div>
        )}
      </Card>
      {previewModal}
    </div>
  );
}
