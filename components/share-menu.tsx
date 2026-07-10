"use client";

import * as React from "react";
import { Share2, Copy, Check, Mail, Globe, Users2, Link as LinkIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { notify } from "@/lib/notifications";
import { publishArtifact, getArtifact, type Visibility } from "@/lib/api";

// lucide dropped brand glyphs, so X / LinkedIn are small inline marks
function XMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function LinkedInMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

// the three access levels — the same visibility ladder PublishDialog offers, folded in here so Share is
// the app's one "access" surface. The prototype persists only a boolean `public`, so "link" and "public"
// both store public=true; the three-way split is UI-level (see selectLevel).
const levels: { id: Visibility; icon: typeof Globe; label: string; sub: string }[] = [
  { id: "workspace", icon: Users2, label: "Acme · Product", sub: "Everyone in the space can read" },
  { id: "link", icon: LinkIcon, label: "Anyone with the link", sub: "Unlisted · read-tracked" },
  { id: "public", icon: Globe, label: "Public on the web", sub: "Discoverable · read-tracked" },
];

// SharePanel — the app's one "access" surface (the popover body). Given an `artifactId` it leads with the
// General access ladder (workspace / link / public, persisted via publishArtifact) and only offers the
// link + channels once the doc is link/public. Without it, it stays the light "spread the link" panel, so
// the ShareMenu button and any existing caller keep working unchanged.
export function SharePanel({ title, url, artifactId }: { title: string; url: string; artifactId?: string }) {
  const [copied, setCopied] = React.useState(false);
  // seed from the artifact's persisted flag — the prototype only knows public vs. not, so a public doc
  // opens on "public" and everything else on "workspace".
  const [level, setLevel] = React.useState<Visibility>(() =>
    artifactId && getArtifact(artifactId)?.public ? "public" : "workspace",
  );
  const full = url.startsWith("http") ? url : `https://${url}`;

  function copy() {
    navigator.clipboard?.writeText(full).catch(() => {});
    setCopied(true);
    notify.success("Link copied", { description: url });
    window.setTimeout(() => setCopied(false), 1500);
  }

  function selectLevel(next: Visibility) {
    setLevel(next);
    // the prototype stores only a boolean `public`, so "link" and "public" both persist public=true.
    if (artifactId) publishArtifact(artifactId, next);
  }

  const channels = [
    { label: "Email", Icon: Mail, href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(full)}` },
    { label: "X", Icon: XMark, href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(full)}&text=${encodeURIComponent(title)}` },
    { label: "LinkedIn", Icon: LinkedInMark, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(full)}` },
  ];

  // nothing to spread when the doc is workspace-only (there's no external link). Callers without an
  // artifactId are the pure "share the link" panel, so they always show it.
  const showSpread = !artifactId || level !== "workspace";

  return (
    <>
      <p className="text-sm font-medium">Share &ldquo;{title}&rdquo;</p>
      {artifactId ? null : (
        <p className="mt-1 text-xs text-muted-foreground">Anyone with the link can view.</p>
      )}

      {/* general access — the visibility ladder, shown only when we have an artifact to publish */}
      {artifactId ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            General access
          </p>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {levels.map((v) => {
              const active = level === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => selectLevel(v.id)}
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
        </div>
      ) : null}

      {/* the link + copy and the share channels — only when there's an external link to spread */}
      {showSpread ? (
        <>
          <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pr-1.5 pl-2.5">
            <Globe className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate font-mono text-xs">{url}</span>
            <button
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium transition-colors hover:bg-foreground/[0.06]"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {channels.map(({ label, Icon, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-lg border py-2.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.03] hover:text-foreground"
              >
                <Icon className="size-4" /> {label}
              </a>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

// ShareMenu — the light Share popover (the heavy visibility/member work lives in Publish, so this is
// just "spread the published link"): copy the hub URL + a few channels. Reusable for collection/artifact.
export function ShareMenu({ title, url }: { title: string; url: string }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="icon" aria-label="Share" />}>
        <Share2 />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <SharePanel title={title} url={url} />
      </PopoverContent>
    </Popover>
  );
}
