"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";

import { Art } from "@/components/layout/art";
import { Brand } from "@/components/layout/brand";
import { NAV_BY_ROLE } from "@/components/layout/nav-config";
import { Avatar, STUDENT_AVATAR } from "@/components/ui/avatar";
import { HOME_BY_ROLE, useSession } from "@/lib/auth/session";
import { usePortal } from "@/lib/data/portal-store";
import { cn } from "@/lib/utils";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const { student, unreadCount, invitations } = usePortal();

  if (!user) return null;

  const sections = NAV_BY_ROLE[user.role];
  const counts = { notifications: unreadCount, invitations: invitations.length };

  return (
    <>
      {/* Scrim - mobile only */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-ink-900/25 backdrop-blur-[2px] transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col overflow-hidden border-r border-white/60 bg-white/80 shadow-[12px_0_40px_-30px_rgba(61,78,92,0.45)] backdrop-blur-xl transition-transform lg:bg-white/55 duration-300 ease-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/60 px-5">
          <Brand href={HOME_BY_ROLE[user.role]} height={50} />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-400 hover:bg-white/70 hover:text-ink-800 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="scroll-soft relative z-10 flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section, index) => (
            <div key={section.heading ?? index} className={index > 0 ? "mt-6" : ""}>
              {section.heading ? (
                <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-ink-400 uppercase">
                  {section.heading}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.matchPrefix != null && pathname.startsWith(item.matchPrefix));
                  const count = item.badge ? counts[item.badge] : 0;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                          active
                            ? "bg-azure-50 text-azure-600 ring-1 ring-azure-100 shadow-[0_6px_18px_-12px_rgba(21,80,200,0.45)]"
                            : "text-stone-600 hover:bg-white/60 hover:text-ink-800",
                        )}
                      >
                        {active ? (
                          <span className="absolute inset-y-1.5 -left-3 w-1 rounded-r-full bg-azure-600" />
                        ) : null}
                        <item.icon
                          className={cn(
                            "size-[18px] shrink-0",
                            active
                              ? "text-azure-600"
                              : "text-stone-400 group-hover:text-ink-700",
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {count > 0 ? (
                          <span className="tnum rounded-full bg-clay-100 px-1.5 py-0.5 text-[10px] font-bold text-clay-500">
                            {count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sketch of the campus avenue, rising out of the profile block */}
        <Art
          name="boulevard"
          sizes="264px"
          className="pointer-events-none absolute right-0 bottom-24 h-64 w-auto opacity-55 [mask-image:radial-gradient(ellipse_at_bottom_right,black_35%,transparent_75%)]"
        />

        <div className="relative z-10 border-t border-white/60 bg-white/50 p-3 backdrop-blur-md">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar
              name={student?.fullName ?? user.displayName}
              src={student ? (student.avatarUrl ?? STUDENT_AVATAR) : undefined}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-stone-800">
                {student?.fullName ?? user.displayName}
              </p>
              <p className="tnum truncate text-[11px] text-stone-400">
                {student?.registrationNumber ?? user.email}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-stone-500 transition-colors hover:bg-clay-100/60 hover:text-clay-500"
          >
            <LogOut className="size-[18px]" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
