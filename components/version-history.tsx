"use client";

import { RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentAvatar, PersonAvatar } from "./identity";
import { artifactVersions } from "@/lib/api";
import { notify } from "@/lib/notifications";

// Versioning-as-dialogue — the artifact's history read as a conversation: each version is a turn (who
// moved it, and what changed), threaded newest-first. Older turns can be restored.
export function VersionHistory({
  artifactId,
  open,
  onOpenChange,
}: {
  artifactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const versions = artifactVersions(artifactId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every change is a turn in the document&rsquo;s dialogue — who touched it, and what moved.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-4">
          {versions.map((v, i) => (
            <li key={v.id} className="relative flex gap-3">
              {/* the thread line joining turns */}
              {i < versions.length - 1 ? (
                <span className="absolute top-9 bottom-[-16px] left-[15px] w-px bg-border" />
              ) : null}
              {v.by === "agent" ? (
                <AgentAvatar size="sm" className="mt-0.5" />
              ) : (
                <PersonAvatar seed={v.by} name={v.byName} size="sm" className="mt-0.5" />
              )}
              <div className="min-w-0 flex-1 rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-[11px] font-medium text-primary">{v.label}</span>
                  {v.current ? (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Current
                    </span>
                  ) : null}
                  <span className="text-sm font-medium">{v.byName}</span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">{v.at}</span>
                </div>
                <p className="mt-1 text-[13px] text-foreground/85">{v.summary}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {v.changes.map((c, j) => (
                    <li key={j} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/50" /> {c}
                    </li>
                  ))}
                </ul>
                {!v.current ? (
                  <button
                    onClick={() => {
                      notify.success(`Restored ${v.label}`, {
                        description: "The document rolled back to this version.",
                      });
                      onOpenChange(false);
                    }}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5" /> Restore this version
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
