"use client";

import { useState } from "react";
import { SendHorizontal, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";

export function ChatComposer({
  disabled,
  streaming,
  onSend,
  onStop,
}: {
  disabled?: boolean;
  streaming?: boolean;
  onSend: (content: string) => void | Promise<void>;
  onStop?: () => void;
}) {
  const [value, setValue] = useState("");

  async function submit() {
    const content = value.trim();
    if (!content || disabled || streaming) return;
    setValue("");
    await onSend(content);
  }

  return (
    <div className="border-t border-border/80 bg-background/95 px-6 py-4 md:px-10 md:py-5 backdrop-blur-md">
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex items-end gap-3 rounded-2xl border border-border bg-card p-3 shadow-md transition-all focus-within:border-primary/70 focus-within:ring-3 focus-within:ring-primary/20">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask anything about architecture, functions, models, APIs, or bugs…"
            disabled={disabled}
            rows={1}
            className="min-h-12 max-h-48 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-base text-foreground shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          {streaming ? (
            <Button
              size="icon"
              variant="destructive"
              className="size-11 shrink-0 rounded-xl"
              onClick={onStop}
              aria-label="Stop generating"
            >
              <Square className="size-5" />
            </Button>
          ) : (
            <Button
              size="icon"
              disabled={disabled || !value.trim()}
              onClick={() => void submit()}
              className="size-11 shrink-0 rounded-xl shadow-xs transition-transform active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label="Send message"
            >
              {disabled ? <Spinner /> : <SendHorizontal className="size-5" />}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            Press <Kbd className="rounded-md border border-border/80 bg-muted px-2 py-0.5 font-mono text-[11px]">Enter</Kbd> to send · <Kbd className="rounded-md border border-border/80 bg-muted px-2 py-0.5 font-mono text-[11px]">Shift + Enter</Kbd> for new line
          </p>
          <span className="hidden sm:inline-block font-medium text-[11.5px] text-muted-foreground/80">
            Powered by Google Gemini RAG
          </span>
        </div>
      </div>
    </div>
  );
}
