"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { NotificationBell } from "@/components/layout/notification-bell";
import { NAV_BY_ROLE } from "@/components/layout/nav-config";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { useSession } from "@/lib/auth/session";
import { usePortal } from "@/lib/data/portal-store";

/** Derives the current page name from the role's nav config. */
function useCurrentPageLabel() {
  const pathname = usePathname();
  const { user } = useSession();
  if (!user) return "";
  return (
    NAV_BY_ROLE[user.role]
      .flatMap((section) => section.items)
      .find((item) => item.href === pathname)?.label ?? ""
  );
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useSession();
  const { student } = usePortal();
  const pageLabel = useCurrentPageLabel();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/60 bg-white/45 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-stone-500 hover:bg-white/70 hover:text-ink-800 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[16px] tracking-tight text-ink-900">
          {pageLabel}
        </p>
        <p className="truncate text-[11.5px] text-ink-400">
          {user?.role === "student"
            ? student
              ? `Semester ${student.semester} · ${student.batch}`
              : "Student Portal"
            : user?.role === "admin"
              ? "Administrator Portal"
              : "Team Supervisor Portal"}
        </p>
      </div>

      <NotificationBell />
      <ProfileMenu />
    </header>
  );
}
