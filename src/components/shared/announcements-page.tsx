"use client";

import { AnnouncementComposer, AnnouncementFeed } from "@/components/shared/announcements";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session";
import { listAnnouncements } from "@/lib/data/repository";
import { useLoad } from "@/lib/use-load";

/** Staff announcements page - compose, then see everything posted so far. */
export function StaffAnnouncementsPage() {
  const { user } = useSession();
  const { data, reload } = useLoad(listAnnouncements, "announcements");

  if (!user) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Announcements"
        title="Post to"
        emphasis={user.role === "admin" ? "every student." : "your groups."}
        description="Messages and files land in each student's Notifications tab straight away."
        scene="announcements"
      />
      <AnnouncementComposer user={user} onPosted={() => void reload()} />
      <div>
        <h2 className="mb-3 font-display text-[1.3rem] text-ink-900">Posted so far</h2>
        {data ? <AnnouncementFeed items={data} /> : <PageSkeleton />}
      </div>
    </div>
  );
}
