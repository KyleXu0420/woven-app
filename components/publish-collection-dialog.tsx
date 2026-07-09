"use client";

import * as React from "react";
import { Globe, Check, Copy, Users2, Link as LinkIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypeBadge } from "@/components/artifact-ui";
import { publishCollection, type Visibility } from "@/lib/api";
import type { ArtifactType } from "@/lib/types";
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

// the collection's real artifacts — each can be included in the public hub or kept private
type Member = { id: string; title: string; type: ArtifactType; pub: boolean };

export function PublishCollectionDialog({
  name = "Q4 Roadmap",
  slug = "q4-roadmap",
  members = [],
  onPublished,
}: { name?: string; slug?: string; members?: Member[]; onPublished?: () => void } = {}) {
  const hubUrl = `woven.dev/c/${slug}`;
  const [open, setOpen] = React.useState(false);
  const [vis, setVis] = React.useState("public");
  // first publish → everything's in by default (so the primary action is immediately enabled); once some
  // are public, preserve the existing choice on re-publish
  const [pub, setPub] = React.useState<Record<string, boolean>>(() => {
    const anyPublic = members.some((m) => m.pub);
    return Object.fromEntries(members.map((m) => [m.id, anyPublic ? m.pub : true]));
  });
  const [published, setPublished] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function doPublish() {
    publishCollection(slug, members.filter((m) => pub[m.id]).map((m) => m.id), vis as Visibility);
    onPublished?.();
    setPublished(true);
  }

  const liveCount = Object.values(pub).filter(Boolean).length;
  const privateCount = members.length - liveCount;

  // select-all + filter — so the list stays usable when a collection has many artifacts
  const [query, setQuery] = React.useState("");
  const allSelected = members.length > 0 && liveCount === members.length;
  const q = query.trim().toLowerCase();
  const shown = q ? members.filter((m) => m.title.toLowerCase().includes(q)) : members;
  function toggleAll() {
    const next = !allSelected;
    setPub(Object.fromEntries(members.map((m) => [m.id, next])));
  }

  function reset() {
    setPublished(false);
    setCopied(false);
    setQuery("");
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
            {members.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">In the public hub</p>
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="font-mono text-muted-foreground">
                      {liveCount} of {members.length}
                    </span>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="font-medium text-primary transition-opacity hover:opacity-80"
                    >
                      {allSelected ? "Clear all" : "Select all"}
                    </button>
                  </div>
                </div>

                {/* filter — only when the list is long enough to warrant it */}
                {members.length > 8 ? (
                  <div className="relative mb-1.5">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter artifacts…"
                      className="w-full rounded-lg border bg-card py-1.5 pr-2.5 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                  </div>
                ) : null}

                {/* bounded + scrollable so a large collection can't blow up the dialog height */}
                <div className="scrollbar-subtle -mr-1 flex max-h-56 flex-col overflow-y-auto pr-1">
                  {shown.map((m) => {
                    const on = pub[m.id];
                    return (
                      <button
                        key={m.id}
                        onClick={() => setPub((p) => ({ ...p, [m.id]: !p[m.id] }))}
                        className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.03]"
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
                  {shown.length === 0 ? (
                    <p className="px-1.5 py-6 text-center text-xs text-muted-foreground">
                      No artifacts match “{query}”.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Cancel</Button>} />
              <Button onClick={doPublish} disabled={liveCount === 0}>
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
