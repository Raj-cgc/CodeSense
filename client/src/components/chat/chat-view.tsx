import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageSquarePlus, MessageSquareText, Plus } from "lucide-react";

import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { IndexingState } from "@/components/chat/indexing-state";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useChatMessages,
  useChatSessions,
  useCreateChatSession,
  useStreamChat,
} from "@/hooks/use-chat";
import { useIndexStatus, useRepository } from "@/hooks/use-repos";

export function ChatView({ repoId }: { repoId: string }) {
  const repoQuery = useRepository(repoId);
  const isIndexing = repoQuery.data?.indexStatus === "INDEXING";
  const statusQuery = useIndexStatus(
    repoId,
    isIndexing || repoQuery.data?.indexStatus === "PENDING"
  );

  const indexStatus =
    statusQuery.data?.indexStatus ?? repoQuery.data?.indexStatus;
  const ready = indexStatus === "READY";

  const sessionsQuery = useChatSessions(repoId, ready);
  const createSession = useCreateChatSession(repoId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const autoCreateRef = useRef(false);

  // If selectedSessionId is explicitly set, check if it still exists in sessionsQuery
  const currentSessionExists = sessionsQuery.data?.some(
    (s) => s.id === selectedSessionId
  );

  const sessionId = currentSessionExists
    ? selectedSessionId
    : sessionsQuery.data && sessionsQuery.data.length > 0
    ? sessionsQuery.data[0].id
    : null;

  const messagesQuery = useChatMessages(sessionId);
  const { send, stop, streaming, streamText } = useStreamChat(sessionId);

  useEffect(() => {
    if (!ready || sessionsQuery.isLoading) return;
    if (sessionsQuery.data && sessionsQuery.data.length > 0) return;
    if (
      !sessionsQuery.isSuccess ||
      (sessionsQuery.data?.length ?? 0) > 0 ||
      autoCreateRef.current
    ) {
      return;
    }

    autoCreateRef.current = true;
    createSession.mutate(undefined, {
      onSuccess: (session) => setSelectedSessionId(session.id),
      onError: () => {
        autoCreateRef.current = false;
      },
    });
  }, [
    ready,
    sessionsQuery.isLoading,
    sessionsQuery.isSuccess,
    sessionsQuery.data,
    createSession,
  ]);

  if (repoQuery.isLoading) {
    return (
      <AppShell title="Loading chat…">
        <div className="grid flex-1 gap-6 p-6 md:grid-cols-[20rem_1fr]">
          <Skeleton className="min-h-96 rounded-2xl" />
          <Skeleton className="min-h-96 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (repoQuery.isError || !repoQuery.data) {
    return (
      <AppShell title="Repository unavailable">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12">
          <p className="text-base text-muted-foreground">
            {(repoQuery.error as Error)?.message ?? "Repository not found"}
          </p>
          <Button size="lg" className="rounded-xl" render={<Link to="/dashboard" />}>Back to dashboard</Button>
        </div>
      </AppShell>
    );
  }

  const repo = repoQuery.data;

  const sidebarProps = {
    repo: {
      ...repo,
      indexStatus: indexStatus ?? repo.indexStatus,
      filesProcessed:
        statusQuery.data?.filesProcessed ?? repo.filesProcessed,
      filesTotal: statusQuery.data?.filesTotal ?? repo.filesTotal,
      chunkCount: statusQuery.data?.chunkCount ?? repo.chunkCount,
      errorMessage: statusQuery.data?.errorMessage ?? repo.errorMessage,
    },
    sessionId,
    onSelectSession: (id: string | null) => {
      setSelectedSessionId(id);
      setMobileSidebarOpen(false);
    },
  };

  return (
    <AppShell
      title={repo.fullName}
      description={
        ready
          ? "Ask questions grounded in this repository code"
          : "Waiting for indexing to finish"
      }
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile Sessions Drawer Trigger (like ChatGPT) */}
          <Button
            variant="outline"
            size="sm"
            className="flex md:hidden rounded-xl gap-1.5 font-medium px-2.5"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sessions"
          >
            <MessageSquareText className="size-4" />
            <span className="text-xs">Chats</span>
          </Button>

          {/* Mobile New Chat Quick Button */}
          <Button
            size="sm"
            className="flex md:hidden rounded-xl size-8 p-0"
            disabled={!ready || createSession.isPending}
            onClick={() =>
              createSession.mutate("New chat", {
                onSuccess: (session) => {
                  setSelectedSessionId(session.id);
                  setMobileSidebarOpen(false);
                },
              })
            }
            aria-label="New chat"
          >
            <Plus className="size-4" />
          </Button>

          <Button variant="outline" size="sm" className="rounded-xl gap-2 font-medium" render={<Link to="/dashboard" />}>
            <ArrowLeft className="size-4" data-icon="inline-start" />
            <span className="hidden sm:inline">All Repositories</span>
            <span className="sm:hidden">Repos</span>
          </Button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-background">
        {/* Desktop Sidebar (visible on md screens and larger) */}
        <div className="hidden md:flex h-full shrink-0">
          <ChatSidebar {...sidebarProps} />
        </div>

        {/* Mobile Slide-out Drawer (ChatGPT mobile style) */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="p-0 w-80 max-w-[85vw] border-r border-border">
            <SheetHeader className="sr-only">
              <SheetTitle>Chat Sessions</SheetTitle>
            </SheetHeader>
            <div className="h-full">
              <ChatSidebar {...sidebarProps} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Chat View (takes full screen on mobile, right pane on desktop) */}
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {!ready ? (
            <IndexingState repo={repo} status={statusQuery.data} />
          ) : !sessionId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center animate-in fade-in duration-300">
              <div className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xs border border-primary/20">
                <MessageSquarePlus className="size-8" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                  No Active Conversation
                </h3>
                <p className="text-base text-muted-foreground">
                  Start a new chat to begin exploring {repo.fullName}.
                </p>
              </div>
              <Button
                size="lg"
                className="rounded-2xl gap-2 font-medium shadow-md hover:shadow-lg transition-all"
                disabled={createSession.isPending}
                onClick={() =>
                  createSession.mutate("New chat", {
                    onSuccess: (session) => setSelectedSessionId(session.id),
                  })
                }
              >
                <Plus className="size-5" />
                Start a New Conversation
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ChatMessages
                  repo={repo}
                  messages={messagesQuery.data ?? []}
                  streamText={streamText}
                  isThinking={streaming && !streamText}
                  isLoading={messagesQuery.isLoading}
                  onSendSuggestion={send}
                />
              </div>
              <ChatComposer
                disabled={!sessionId}
                streaming={streaming}
                onSend={send}
                onStop={stop}
              />
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
