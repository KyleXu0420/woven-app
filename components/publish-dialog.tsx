"use client";

import * as React from "react";
import { Globe, Check, Copy, Users2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toasts } from "@/lib/notifications";
import { publishArtifact, getArtifact, type Visibility } from "@/lib/api";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PUBLIC_URL = "woven.dev/a/notification-strategy-v3";

const visibilities = [
  { id: "workspace", icon: Users2, label: "Acme · Product", sub: "Everyone in the space can read" },
  { id: "link", icon: LinkIcon, label: "Anyone with the link", sub: "Unlisted · read-tracked" },
  { id: "public", icon: Globe, label: "Public", sub: "Discoverable · read-tracked" },
];

export function PublishDialog({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger,
  url = PUBLIC_URL,
  artifactId,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  url?: string;
  artifactId?: string;
} = {}) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChangeProp ?? setOpenState;
  const [vis, setVis] = React.useState("link");
  const [published, setPublished] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    setPublished(false);
    setCopied(false);
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }
  function copy() {
    navigator.clipboard?.writeText(`https://${url}`).catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {hideTrigger ? null : (
        <DialogTrigger render={<Button size="sm" />}>
          <Globe /> Publish
        </DialogTrigger>
      )}

      <DialogContent className="max-w-md">
        {!published ? (
          <>
            <DialogHeader>
              <DialogTitle>Publish artifact</DialogTitle>
              <DialogDescription>
                Turn this node into a living webpage. Reads are tracked — privacy-friendly, no cookies.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              {visibilities.map((v) => {
                const active = vis === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setVis(v.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? "border-primary/40 bg-primary/[0.05]"
                        : "hover:bg-foreground/[0.03]"
                    }`}
                  >
                    <v.icon className={`size-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="flex-1">
                      <span className="block text-[15px] font-medium">{v.label}</span>
                      <span className="block text-[13px] text-muted-foreground">{v.sub}</span>
                    </span>
                    {active ? <Check className="size-4 text-primary" /> : null}
                  </button>
                );
              })}
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Cancel</Button>} />
              <Button
                onClick={() => {
                  if (artifactId) publishArtifact(artifactId, vis as Visibility);
                  setPublished(true);
                  toasts.published(url);
                }}
              >
                <Globe /> Publish
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" />
                </span>
                <DialogTitle>Live</DialogTitle>
              </div>
              <DialogDescription>
                It’s a living webpage now — and every read flows back into the graph.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 pl-3">
              <Globe className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-mono text-[13px]">{url}</span>
              <Button size="xs" variant={copied ? "outline" : "secondary"} onClick={copy}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Done</Button>} />
              {artifactId ? (
                <a
                  href={`/a/${getArtifact(artifactId)?.hub_slug ?? artifactId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button>
                    <Globe /> View
                  </Button>
                </a>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
