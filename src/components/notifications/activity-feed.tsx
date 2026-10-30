"use client";

import Link from "next/link";
import { BellOff, ChevronRight } from "lucide-react";

import { NotificationIcon } from "@/components/notifications/notification-icon";
import { Card, EmptyState } from "@/components/ui/card";
import { usePortal } from "@/lib/data/portal-store";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/**
 * The signed-in user's notifications, newest first, on every portal. A row
 * links to where it came from and is marked read the moment it is opened.
 */
export function ActivityFeed({ fallbackHref }: { fallbackHref: string }) {
  const { notifications, markNotificationRead } = usePortal();

  if (notifications.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<BellOff className="size-5" />}
          title="No activity yet"
          description="Grades, report feedback, query replies and supervisor changes appear here."
        />
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y divide-sand-200/70">
        {notifications.map((n) => (
          <li key={n.id}>
            <Link
              href={n.href ?? fallbackHref}
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
    </Card>
  );
}
