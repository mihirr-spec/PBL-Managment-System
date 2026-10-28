"use client";

import Link from "next/link";
import { useState } from "react";
import { BellOff, CheckCheck, ChevronRight } from "lucide-react";

import { NotificationIcon } from "@/components/notifications/notification-icon";
import { AnnouncementFeed } from "@/components/shared/announcements";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { listAnnouncements } from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import { useLoad } from "@/lib/use-load";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

type Tab = "announcements" | "activity";

export default function NotificationsPage() {
  const { loading, notifications, unreadCount, markNotificationRead, markAllRead } = usePortal();
  const announcements = useLoad(listAnnouncements, "announcements");
  const [tab, setTab] = useState<Tab>("announcements");

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="What's"
        emphasis="new for you."
        description="Announcements and files from your supervisor and the administrator, plus updates on your reports, grades and queries."
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

      <div role="tablist" className="inline-flex gap-1 rounded-xl bg-white/60 p-1 ring-1 ring-white backdrop-blur-md">
        {(
          [
            ["announcements", "Announcements & files"],
            ["activity", `Activity${unreadCount > 0 ? ` (${unreadCount})` : ""}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              tab === key ? "bg-ink-800 text-white" : "text-stone-600 hover:text-ink-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "announcements" ? (
        announcements.data ? (
          <AnnouncementFeed items={announcements.data} />
        ) : (
          <PageSkeleton />
        )
      ) : (
        <Card>
          {notifications.length === 0 ? (
            <EmptyState
              icon={<BellOff className="size-5" />}
              title="No activity yet"
              description="Grades, report feedback, query replies and supervisor changes appear here."
            />
          ) : (
            <ul className="divide-y divide-sand-200/70">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href ?? "/student/dashboard"}
                    onClick={() => void markNotificationRead(n.id)}
                    className={cn(
                      "group flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-white/70",
                      !n.read && "bg-azure-50/60",
                    )}
                  >
                    <NotificationIcon kind={n.kind} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[13.5px] text-ink-900", !n.read ? "font-semibold" : "font-medium")}>
                        {n.title}
                      </p>
                      {n.body ? <p className="mt-0.5 text-[12.5px] text-stone-500">{n.body}</p> : null}
                      <p className="tnum mt-1.5 text-[11.5px] text-stone-400" title={formatDateTime(n.createdAt)}>
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-azure-600" aria-label="Unread" /> : null}
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-sand-300 group-hover:text-stone-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
