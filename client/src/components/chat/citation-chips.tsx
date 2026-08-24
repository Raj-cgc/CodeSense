"use client";

import { FileCode, ExternalLink } from "lucide-react";
import type { Citation, Repository } from "@/lib/api";

export function citationHref(repo: Repository, citation: Citation) {
  const line =
    citation.startLine != null
      ? `#L${citation.startLine}${
          citation.endLine && citation.endLine !== citation.startLine
            ? `-L${citation.endLine}`
            : ""
        }`
      : "";
  return `https://github.com/${repo.fullName}/blob/${repo.defaultBranch}/${citation.filePath}${line}`;
}

export function CitationChips({
  repo,
  citations,
}: {
  repo: Repository;
  citations: Citation[];
}) {
  if (!citations.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Sources:
      </span>
      {citations.map((citation, index) => (
        <a
          key={`${citation.filePath}-${index}`}
          href={citationHref(repo, citation)}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex max-w-xs items-center gap-1.5 rounded-lg border border-border/80 bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground shadow-2xs"
          title={`View ${citation.filePath} on GitHub`}
        >
          <FileCode className="size-3.5 text-primary/70 group-hover:text-primary shrink-0" />
          <span className="truncate font-mono text-[11.5px]">
            {citation.filePath.split("/").pop()}
            {citation.startLine != null ? `:${citation.startLine}` : ""}
          </span>
          <ExternalLink className="size-3 shrink-0 opacity-40 group-hover:opacity-100" />
        </a>
      ))}
    </div>
  );
}
