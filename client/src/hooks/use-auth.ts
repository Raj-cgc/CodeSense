import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const AUTH_COOKIE = "codesense_auth";
export const AUTH_STORAGE_KEY = "codesense_auth";

export function hasAuthIndicator(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const fromStorage = localStorage.getItem(AUTH_STORAGE_KEY) === "1";
    const fromCookie = document.cookie.includes(`${AUTH_COOKIE}=1`) || document.cookie.includes("devpilot_auth=1");
    return fromStorage || fromCookie;
  } catch {
    return false;
  }
}

export function setAuthCookie(authed: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (authed) {
      localStorage.setItem(AUTH_STORAGE_KEY, "1");
      document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
      document.cookie = "devpilot_auth=; path=/; max-age=0; SameSite=Lax";
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function useCurrentUser(forceEnable = false) {
  const hasAuth = hasAuthIndicator();
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      try {
        const user = await api.me();
        setAuthCookie(true);
        return user;
      } catch (error) {
        setAuthCookie(false);
        throw error;
      }
    },
    enabled: hasAuth || forceEnable,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => api.logout(),
    onSettled: async () => {
      setAuthCookie(false);
      queryClient.setQueryData(queryKeys.auth.me(), null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      navigate("/login");
    },
  });
}
