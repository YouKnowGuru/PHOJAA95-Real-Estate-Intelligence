import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

export type UnifiedUser = {
  id: number;
  fullName: string;
  name: string;
  email: string | null;
  role: string;
  avatar?: string | null;
  profileImage?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: string;
  authType: "oauth" | "local";
  lastLoginAt?: Date | null;
  pfNumber?: string | null;
  pfPercentage?: string | null;
  employeeId?: string | null;
  sessionExpiresAt?: number | null;
};

export function useAuth() {
  const utils = trpc.useUtils();

  const {
    data: oauthUser,
    isLoading: oauthLoading,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const {
    data: localUser,
    isLoading: localLoading,
  } = trpc.localAuth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const refreshSessionMutation = trpc.localAuth.refreshSession.useMutation({
    onSuccess: () => {
      utils.localAuth.me.invalidate();
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      window.location.reload();
    },
  });

  const localLogoutMutation = trpc.localAuth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      window.location.reload();
    },
  });

  const logout = useCallback(() => {
    if (oauthUser) {
      logoutMutation.mutate();
    } else if (localUser) {
      localLogoutMutation.mutate();
    }
    // Clear any residual state (match common cookie attributes)
    document.cookie = "local_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;";
  }, [oauthUser, localUser, logoutMutation, localLogoutMutation]);

  const user: UnifiedUser | null = useMemo(() => {
    if (oauthUser) {
      return {
        id: oauthUser.id,
        fullName: oauthUser.name || "User",
        name: oauthUser.name || "User",
        email: oauthUser.email,
        role: oauthUser.role,
        avatar: oauthUser.avatar,
        status: "active",
        authType: "oauth" as const,
      };
    }
    if (localUser) {
      return {
        id: localUser.id,
        fullName: localUser.fullName,
        name: localUser.fullName,
        email: localUser.email,
        role: localUser.role,
        phone: localUser.phone,
        address: localUser.address,
        profileImage: localUser.profileImage,
        status: localUser.status,
        authType: "local" as const,
        lastLoginAt: localUser.lastLoginAt,
        pfNumber: localUser.pfNumber,
        pfPercentage: localUser.pfPercentage,
        employeeId: localUser.employeeId,
      };
    }
    return null;
  }, [oauthUser, localUser]);

  const isLoading = oauthLoading || localLoading;
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";

  // Session expiration for local auth users
  const sessionExpiresAt = localUser?.sessionExpiresAt;

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin,
    isStaff,
    logout,
    refresh: () => utils.invalidate(),
    sessionExpiresAt,
    refreshSession: () => refreshSessionMutation.mutate(),
    isRefreshingSession: refreshSessionMutation.isPending,
  };
}
