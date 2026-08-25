import { useEffect } from "react";
import { useLocation, Navigate } from "react-router-dom";

import { useCurrentUser, hasAuthIndicator, setAuthCookie } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const hasAuth = hasAuthIndicator();
  const { data: user, isLoading, isError } = useCurrentUser();

  const next = encodeURIComponent(location.pathname + location.search);

  useEffect(() => {
    if (isError || (!isLoading && hasAuth && !user)) {
      setAuthCookie(false);
    }
  }, [isError, isLoading, hasAuth, user]);

  // If there's no auth indicator at all, immediately redirect to login
  if (!hasAuth) {
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Spinner className="size-6" />
          <p className="text-sm">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
