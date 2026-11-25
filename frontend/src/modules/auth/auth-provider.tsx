"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Session } from "@/types/api";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  /** Display-only permission check. The API enforces every permission again. */
  can: (permission: string | string[]) => boolean;
  login: (input: { email: string; password: string; remember: boolean }) => Promise<Session>;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
export const SESSION_KEY = ["auth", "session"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        return (await api.get<{ data: Session }>("/auth/session")).data;
      } catch (e) {
        if (e instanceof ApiError && [401, 403, 419].includes(e.status)) return null;
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (input: { email: string; password: string; remember: boolean }) =>
      (await api.post<{ data: Session }>("/auth/login", input)).data,
    onSuccess: (session) => queryClient.setQueryData(SESSION_KEY, session),
  });

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      queryClient.clear();
      queryClient.setQueryData(SESSION_KEY, null);
    }
  }, [queryClient]);

  const can = useCallback(
    (permission: string | string[]) => {
      if (!data) return false;
      const wanted = Array.isArray(permission) ? permission : [permission];
      return wanted.some((p) => data.permissions.includes(p));
    },
    [data],
  );

  return (
    <AuthContext.Provider
      value={{
        session: data ?? null,
        loading: isLoading,
        can,
        login: loginMutation.mutateAsync,
        logout,
        refresh: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
