"use client";

import { useState } from "react";
import { Activity, Megaphone } from "lucide-react";

import { ActivityFeed } from "@/components/notifications/activity-feed";
import { AnnouncementFeed } from "@/components/shared/announcements";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PillTabs } from "@/components/ui/toolbar";
import { CheckCheck } from "lucide-react";
import { listAnnouncements } from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import { useLoad } from "@/lib/use-load";

type Tab = "announcements" | "activity";

/** Staff see the same two lanes students do, with their own feed. */
export default function NotificationsPage() {
  const { loading, unreadCount, markAllRead } = usePortal();
  const announcements = useLoad(listAnnouncements, "announcements");
  const [tab, setTab] = useState<Tab>("activity");

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="What's"
        emphasis="new for you."
        description="Announcements from the administrator, plus reports, requests and achievements that need your eye."
        scene="notifications"
        action={
          unreadCount > 0 ? (
            <Button size="sm" onClick={markAllRead}>
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          ) : null
        }
      />

      <PillTabs
        label="Notifications"
        value={tab}
        onChange={setTab}
        items={[
          { key: "activity", label: "Activity", count: unreadCount > 0 ? unreadCount : undefined, icon: Activity },
          { key: "announcements", label: "Announcements & files", icon: Megaphone },
        ]}
      />

      {tab === "activity" ? (
        <ActivityFeed fallbackHref="/faculty/dashboard" />
      ) : announcements.data ? (
        <AnnouncementFeed items={announcements.data} />
      ) : (
        <Card>
          <EmptyState title="Loading announcements" />
        </Card>
      )}
    </div>
  );
}
