"use client";

import { formatDistanceToNow } from "date-fns";
import { Plus, RotateCcw, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";

import { IndexStatusBadge } from "@/components/dashboard/repo-status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
} from "@/hooks/use-chat";
import { useStartIndexing } from "@/hooks/use-repos";
import type { Repository } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ChatSidebar({
  repo,
  sessionId,
  onSelectSession,
}: {
  repo: Repository;
  sessionId: string | null;
  onSelectSession: (id: string | null) => void;
}) {
  const ready = repo.indexStatus === "READY";
  const sessionsQuery = useChatSessions(repo.id, ready);
  const createSession = useCreateChatSession(repo.id);
  const deleteSession = useDeleteChatSession(repo.id);
  const reindex = useStartIndexing();

  const [sessionToDelete, setSessionToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  return (
    <>
      <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden border-b border-border/80 bg-sidebar/50 md:w-80 md:border-r md:border-b-0 backdrop-blur-xs">
        <div className="shrink-0 space-y-4 p-4 md:p-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-semibold tracking-tight truncate text-foreground">
                {repo.fullName}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <IndexStatusBadge status={repo.indexStatus} />
              {repo.isPrivate && (
                <span className="rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Private
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="default"
              className="flex-1 rounded-xl font-medium shadow-xs"
              disabled={!ready || createSession.isPending}
              onClick={() =>
                createSession.mutate("New chat", {
                  onSuccess: (session) => onSelectSession(session.id),
                })
              }
            >
              <Plus className="size-4" data-icon="inline-start" />
              New chat
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="size-9 rounded-xl shrink-0"
              disabled={reindex.isPending || repo.indexStatus === "INDEXING"}
              onClick={() => reindex.mutate(repo.id)}
              title="Re-index repository"
              aria-label="Re-index repository"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>

        <Separator className="shrink-0" />

        <div className="shrink-0 flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Chat Sessions</span>
          {sessionsQuery.data && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              {sessionsQuery.data.length}
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-1.5">
          {!ready && (
            <div className="rounded-xl border border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground">
              Sessions unlock after indexing completes.
            </div>
          )}

          {sessionsQuery.isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}

          {sessionsQuery.data?.map((session) => {
            const isSelected = sessionId === session.id;
            return (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(session.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onSelectSession(session.id);
                  }
                }}
                className={cn(
                  "group flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl p-3 text-left transition-all",
                  isSelected
                    ? "bg-primary/10 text-primary border border-primary/30 shadow-xs font-medium"
                    : "hover:bg-muted/80 text-foreground/90 border border-transparent"
                )}
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare
                      className={cn(
                        "size-4 shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <p className="truncate text-sm font-medium leading-tight">
                      {session.title}
                    </p>
                  </div>
                  <p className="pl-6 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(session.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 rounded-lg text-muted-foreground opacity-60 hover:opacity-100 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionToDelete({
                      id: session.id,
                      title: session.title,
                    });
                  }}
                  title="Delete chat session"
                  aria-label="Delete chat session"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}

          {ready &&
            sessionsQuery.isSuccess &&
            sessionsQuery.data.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                No previous chats found. Click "New chat" to begin!
              </div>
            )}
        </div>
      </aside>

      {/* In-App Confirmation Dialog */}
      <AlertDialog
        open={Boolean(sessionToDelete)}
        onOpenChange={(open) => {
          if (!open) setSessionToDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl border border-border/90 bg-card p-6 shadow-2xl sm:max-w-md">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Delete Chat Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                "{sessionToDelete?.title}"
              </span>
              ? All questions and answers in this conversation will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-row items-center justify-end gap-3">
            <AlertDialogCancel
              className="rounded-xl font-medium"
              onClick={() => setSessionToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="rounded-xl font-medium"
              disabled={deleteSession.isPending}
              onClick={() => {
                if (!sessionToDelete) return;
                const targetId = sessionToDelete.id;
                deleteSession.mutate(targetId, {
                  onSuccess: () => {
                    const remaining = sessionsQuery.data?.filter(
                      (s) => s.id !== targetId
                    );
                    if (remaining && remaining.length > 0) {
                      if (sessionId === targetId) {
                        onSelectSession(remaining[0].id);
                      }
                    } else {
                      onSelectSession(null);
                    }
                    setSessionToDelete(null);
                  },
                });
              }}
            >
              {deleteSession.isPending ? "Deleting…" : "Delete Chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
