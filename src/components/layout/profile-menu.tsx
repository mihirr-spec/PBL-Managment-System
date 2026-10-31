"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { KeyRound, LogOut, UserRound } from "lucide-react";

import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { Avatar, STUDENT_AVATAR } from "@/components/ui/avatar";
import { useSession } from "@/lib/auth/session";
import { usePortal } from "@/lib/data/portal-store";
import * as repo from "@/lib/data/repository";

const ROLE_LABEL = {
  student: "Student",
  faculty: "Team Supervisor",
  supervisor: "Team Supervisor",
  admin: "Administrator",
} as const;

/**
 * The avatar in the top bar: opens a small menu with the account and sign-out.
 * Supervisors and the administrator change their photo here (students do it on
 * their profile page).
 */
export function ProfileMenu() {
  const { user, signOut, refreshUser } = useSession();
  const { student } = usePortal();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const name = student?.fullName ?? user.displayName;
  const photo = student ? (student.avatarUrl ?? STUDENT_AVATAR) : user.avatarUrl;
  const userId = user.id;

  async function setPhoto(file: File) {
    const url = await repo.uploadAvatar(userId, file);
    await repo.setMyAvatar(url);
    await refreshUser();
  }

  async function clearPhoto() {
    await repo.setMyAvatar(null);
    await refreshUser();
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="rounded-full transition-[opacity,box-shadow] hover:opacity-90 focus-visible:ring-3 focus-visible:ring-azure-100 focus-visible:outline-none"
      >
        <Avatar name={name} src={photo} size="sm" />
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-fade-rise absolute top-full right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-white bg-white/95 shadow-[0_24px_60px_-24px_rgba(13,31,63,0.55)] backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 border-b border-sand-200/70 px-4 py-3.5">
            {student ? (
              <Avatar name={name} src={photo} size="md" />
            ) : (
              <AvatarEditor
                name={name}
                src={photo}
                size="lg"
                onPick={setPhoto}
                onRemove={user.avatarUrl ? clearPhoto : undefined}
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink-900">{name}</p>
              <p className="truncate text-[12px] text-stone-500">{user.email}</p>
              <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-azure-600 uppercase">
                {ROLE_LABEL[user.role]}
              </p>
            </div>
          </div>
          <div className="p-1.5">
            {user.role === "student" ? (
              <>
                <MenuLink href="/student/profile" icon={<UserRound className="size-4" />} onPick={() => setOpen(false)}>
                  My profile
                </MenuLink>
              </>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setChanging(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-ink-800 transition-colors hover:bg-azure-50"
            >
              <KeyRound className="size-4 text-stone-500" />
              Change password
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-clay-500 transition-colors hover:bg-clay-100/60"
            >
              <LogOut className="size-4" />
              Log out
            </button>
          </div>
        </div>
      ) : null}
      {changing ? <ChangePasswordDialog onClose={() => setChanging(false)} /> : null}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  onPick,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onPick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-ink-800 transition-colors hover:bg-azure-50"
    >
      <span className="text-stone-500">{icon}</span>
      {children}
    </Link>
  );
}
