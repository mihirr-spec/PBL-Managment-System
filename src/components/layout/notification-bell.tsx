"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import { NotificationIcon } from "@/components/notifications/notification-icon";
import { useSession } from "@/lib/auth/session";
import { usePortal } from "@/lib/data/portal-store";
import { cn, timeAgo } from "@/lib/utils";

/** Where a notification with no link of its own lands, per role. */
const NOTIFICATION_HOME: Record<string, string> = {
  student: "/student/notifications",
  faculty: "/faculty/notifications",
  supervisor: "/faculty/notifications",
  admin: "/admin/notifications",
};

export function NotificationBell() {
  const { user } = useSession();
  const { notifications, unreadCount, markNotificationRead, markAllRead } =
    usePortal();
  const fallbackHref = user ? NOTIFICATION_HOME[user.role] ?? "/student/notifications" : "/";
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isStudent = user?.role === "student";
  const recent = notifications.slice(0, isStudent ? 5 : 10);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        className="relative rounded-lg p-2 text-stone-500 transition-colors hover:bg-white/70 hover:text-ink-800"
      >
        <Bell className="size-[19px]" />
        {unreadCount > 0 ? (
          <span className="tnum absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-clay-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-fade-rise absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[18px] border border-white/70 bg-white/90 shadow-[0_24px_60px_-24px_rgba(61,78,92,0.5)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-sand-200 px-4 py-3">
            <p className="text-[13px] font-semibold text-stone-800">
              Notifications
            </p>
            {unreadCount > 0 ? (
              <button
                onClick={markAllRead}
                className="text-[12px] font-medium text-gold-600 hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-stone-400">
              You&rsquo;re all caught up.
            </p>
          ) : (
            <ul className="scroll-soft max-h-[22rem] divide-y divide-sand-200/70 overflow-y-auto">
              {recent.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href ?? fallbackHref}
                    onClick={() => {
                      void markNotificationRead(n.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-ivory-100",
                      !n.read && "bg-gold-50/50",
                    )}
                  >
                    <NotificationIcon kind={n.kind} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-[13px] text-stone-800",
                          !n.read ? "font-semibold" : "font-medium",
                        )}
                      >
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-stone-500">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[11px] text-stone-400">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.read ? (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-400" />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {user ? (
            <Link
              href={NOTIFICATION_HOME[user.role] ?? "/student/notifications"}
              onClick={() => setOpen(false)}
              className="block border-t border-sand-200 bg-ivory-50 px-4 py-2.5 text-center text-[12.5px] font-medium text-stone-600 hover:bg-ivory-200 hover:text-stone-800"
            >
              View all notifications
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
