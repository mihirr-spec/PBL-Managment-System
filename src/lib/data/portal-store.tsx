"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useSession } from "@/lib/auth/session";
import * as repo from "@/lib/data/repository";
import type { Faculty, Group, GroupInvitation, Notification, Student, SupervisorChange } from "@/lib/types";

/**
 * Loads what every page of the signed-in user's portal shares - the student
 * record, their group and mentor, and notifications - once, and exposes the
 * mutations that write back through the repository. Pages fetch anything
 * page-specific themselves and call `refresh()` after actions that change
 * the shared data (forming a group, for example).
 */

interface PortalData {
  student: Student | null;
  group: Group | null;
  mentor: Faculty | null;
  /** The group's most recent change of supervisor, if it ever had one. */
  supervisorChange: SupervisorChange | null;
  /** Classmates' invitations to join their group, waiting for an answer. */
  invitations: GroupInvitation[];
  notifications: Notification[];
}

interface PortalContextValue extends PortalData {
  loading: boolean;
  unreadCount: number;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<repo.EditableStudentFields>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const empty: PortalData = {
  student: null,
  group: null,
  mentor: null,
  supervisorChange: null,
  invitations: [],
  notifications: [],
};

const PortalContext = createContext<PortalContextValue | null>(null);

async function loadPortal(userId: string): Promise<PortalData> {
  const [student, notifications] = await Promise.all([
    repo.getStudentByUserId(userId),
    repo.getNotifications(userId),
  ]);
  if (!student) return { ...empty, notifications };
  const group = await repo.getGroupForStudent(student.id);
  const [mentor, changes, invitations] = await Promise.all([
    repo.getFaculty(group?.mentorId ?? null),
    group ? repo.listSupervisorChanges(group.id) : Promise.resolve([]),
    group ? Promise.resolve([]) : repo.listMyInvitations(),
  ]);
  return { student, group, mentor, supervisorChange: changes[0] ?? null, invitations, notifications };
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();

  /**
   * Holds the loaded payload together with the user it belongs to, so the
   * data for a signed-out (or newly switched) user is derived away rather
   * than cleared in an effect.
   */
  const [loaded, setLoaded] = useState<{ userId: string; data: PortalData } | null>(null);

  const fresh = user != null && loaded?.userId === user.id;
  const data = fresh ? loaded.data : empty;
  const loading = user != null && !fresh;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadPortal(user.id).then((next) => {
      if (!cancelled) setLoaded({ userId: user.id, data: next });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoaded({ userId: user.id, data: await loadPortal(user.id) });
  }, [user]);

  const patchData = useCallback((patch: (previous: PortalData) => PortalData) => {
    setLoaded((previous) => (previous ? { ...previous, data: patch(previous.data) } : previous));
  }, []);

  const updateProfile = useCallback<PortalContextValue["updateProfile"]>(
    async (patch) => {
      if (!data.student) return;
      const updated = await repo.updateStudent(data.student.id, patch);
      patchData((previous) => ({ ...previous, student: updated }));
    },
    [data.student, patchData],
  );

  const uploadAvatar = useCallback<PortalContextValue["uploadAvatar"]>(
    async (file) => {
      if (!user || !data.student) return;
      const url = await repo.uploadAvatar(user.id, file);
      const updated = await repo.updateStudent(data.student.id, { avatarUrl: url });
      patchData((previous) => ({ ...previous, student: updated }));
    },
    [user, data.student, patchData],
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      await repo.setNotificationRead(id, true);
      patchData((previous) => ({
        ...previous,
        notifications: previous.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    },
    [patchData],
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await repo.markAllNotificationsRead(user.id);
    patchData((previous) => ({
      ...previous,
      notifications: previous.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, [user, patchData]);

  const unreadCount = useMemo(
    () => data.notifications.filter((n) => !n.read).length,
    [data.notifications],
  );

  const value = useMemo<PortalContextValue>(
    () => ({
      ...data,
      loading,
      unreadCount,
      refresh,
      updateProfile,
      uploadAvatar,
      markNotificationRead,
      markAllRead,
    }),
    [data, loading, unreadCount, refresh, updateProfile, uploadAvatar, markNotificationRead, markAllRead],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext);
  if (!context) throw new Error("usePortal must be used inside a <PortalProvider>.");
  return context;
}
