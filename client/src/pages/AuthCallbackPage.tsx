import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { useCurrentUser } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { data: user, isLoading, isFetched, refetch } = useCurrentUser();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      navigate("/dashboard", { replace: true });
      return;
    }

    if (isFetched && !user) {
      if (retryCount < 3) {
        const timer = setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          void refetch();
        }, 800);
        return () => clearTimeout(timer);
      } else {
        navigate("/login?error=session", { replace: true });
      }
    }
  }, [user, isLoading, isFetched, retryCount, refetch, navigate]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <Spinner className="size-6" />
      <p className="text-sm text-muted-foreground">Finishing GitHub sign-in…</p>
    </div>
  );
}
