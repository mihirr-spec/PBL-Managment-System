"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authenticate, loadUser, signOutEverywhere } from "@/lib/data/repository";
import { supabase } from "@/lib/supabase/client";
import type { Role, User } from "@/lib/types";

/**
 * Client-side session, backed by Supabase Auth.
 *
 * supabase-js keeps the auth session in localStorage and refreshes it; this
 * provider listens for auth changes and resolves the signed-in account to the
 * app's User (role, display name, profile link) from the `profiles` table.
 */

/** Landing route per role. Supervisors share the teacher portal for now. */
export const HOME_BY_ROLE: Record<Role, string> = {
  student: "/student/dashboard",
  faculty: "/faculty/dashboard",
  supervisor: "/faculty/dashboard",
  admin: "/admin/dashboard",
};

interface SessionContextValue {
  user: User | null;
  /** True until the stored session has been checked - prevents a login flash. */
  loading: boolean;
  signIn: (
    email: string,
    password: string,
    roles?: Role[],
  ) => Promise<{ ok: true; user: User } | { ok: false; error: string }>;
  signOut: () => void;
  /** Reloads the signed-in user's profile (after changing their photo, say). */
  refreshUser: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Only the most recent auth event may set the user - a slow profile
    // lookup for an earlier sign-in must not undo a later sign-out.
    let latest = 0;

    // Fires once with the stored session (INITIAL_SESSION), then on every
    // sign-in, sign-out and token refresh.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      const authUser = session?.user;
      const ticket = ++latest;
      // Defer the profile query out of the auth callback, as supabase-js advises.
      setTimeout(async () => {
        const next = authUser
          ? await loadUser(authUser.id, authUser.last_sign_in_at).catch(() => null)
          : null;
        if (!active || ticket !== latest) return;
        setUser(next);
        setLoading(false);
      }, 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback<SessionContextValue["signIn"]>(
    async (email, password, roles) => {
      const result = await authenticate({ email, password, roles });
      if (result.ok) setUser(result.user);
      return result;
    },
    [],
  );

  const signOut = useCallback(() => {
    void signOutEverywhere().finally(() => {
      setUser(null);
      router.replace("/login");
    });
  }, [router]);

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const next = await loadUser(data.user.id, data.user.last_sign_in_at).catch(() => null);
    if (next) setUser(next);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refreshUser }),
    [user, loading, signIn, signOut, refreshUser],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside a <SessionProvider>.");
  }
  return context;
}
