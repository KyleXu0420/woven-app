"use client";

import * as React from "react";
import { Globe, Check, Copy, Users2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypeBadge } from "@/components/artifact-ui";
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

const visibilities = [
  { id: "workspace", icon: Users2, label: "Acme · Product", sub: "Everyone in the space can read" },
  { id: "link", icon: LinkIcon, label: "Anyone with the link", sub: "Unlisted · read-tracked" },
  { id: "public", icon: Globe, label: "Public hub", sub: "Discoverable · read-tracked" },
];

// the collection's artifacts — each can be included in the public hub or kept private
const members = [
  { title: "Notification Strategy v3", type: "HTML", eligible: true },
  { title: "Pricing rework", type: "DOC", eligible: true },
  { title: "Q4 OKRs", type: "HTML", eligible: true },
  { title: "Budget — internal", type: "DOC", eligible: false },
];

export function PublishCollectionDialog({
  name = "Q4 Roadmap",
  slug = "q4-roadmap",
}: { name?: string; slug?: string } = {}) {
  const hubUrl = `woven.dev/c/${slug}`;
  const [open, setOpen] = React.useState(false);
  const [vis, setVis] = React.useState("link");
  const [pub, setPub] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(members.map((m) => [m.title, m.eligible]))
  );
  const [published, setPublished] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveCount = Object.values(pub).filter(Boolean).length;
  const privateCount = members.length - liveCount;

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
    navigator.clipboard?.writeText(`https://${hubUrl}`).catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <Globe /> Publish
      </DialogTrigger>

      <DialogContent className="max-w-md">
        {!published ? (
          <>
            <DialogHeader>
              <DialogTitle>Publish collection</DialogTitle>
              <DialogDescription>
                Share <span className="font-medium text-foreground">{name}</span> as a living
                hub — its artifacts stay live, and every read flows back into the graph.
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
                      active ? "border-primary/40 bg-primary/[0.05]" : "hover:bg-foreground/[0.03]"
                    }`}
                  >
                    <v.icon className={`size-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{v.label}</span>
                      <span className="block text-xs text-muted-foreground">{v.sub}</span>
                    </span>
                    {active ? <Check className="size-4 text-primary" /> : null}
                  </button>
                );
              })}
            </div>

            {/* pick which artifacts go public — collections mix private + shareable */}
            <div>
              <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                In the public hub
                <span className="font-mono text-[11px] font-normal tracking-normal normal-case">
                  {liveCount} of {members.length}
                </span>
              </p>
              <div className="flex flex-col">
                {members.map((m) => {
                  const on = pub[m.title];
                  return (
                    <button
                      key={m.title}
                      onClick={() => setPub((p) => ({ ...p, [m.title]: !p[m.title] }))}
                      className="-mx-1 flex items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-foreground/[0.03]"
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                        }`}
                      >
                        {on ? <Check className="size-3" /> : null}
                      </span>
                      <TypeBadge type={m.type} />
                      <span className={`flex-1 truncate text-sm ${on ? "" : "text-muted-foreground"}`}>
                        {m.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Cancel</Button>} />
              <Button onClick={() => setPublished(true)} disabled={liveCount === 0}>
                <Globe /> Publish hub
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
                <DialogTitle>Hub is live</DialogTitle>
              </div>
              <DialogDescription>
                {liveCount} artifact{liveCount === 1 ? "" : "s"} live
                {privateCount > 0 ? ` · ${privateCount} kept private` : ""} — the hub updates as they change.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 pl-3">
              <Globe className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-mono text-[12px]">{hubUrl}</span>
              <Button size="xs" variant={copied ? "outline" : "secondary"} onClick={copy}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Done</Button>} />
              <a href={`/c/${slug}`} target="_blank" rel="noopener noreferrer">
                <Button>
                  <Globe /> View hub
                </Button>
              </a>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
