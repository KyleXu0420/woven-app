"use client";

import * as React from "react";
import { Share2, Copy, Check, Mail, Globe, Users2, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { notify } from "@/lib/notifications";
import { publishArtifact, getArtifact } from "@/lib/api";

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

// SharePanel — the app's one "access" surface, patterned on a web editor's Share dialog: a **Share** tab
// (who in the org can open it + the link) and a **Publish** tab (turn it into a public web page, with a real
// Publish button). Given an `artifactId` it shows the tabs; without one it stays the light "spread the link"
// panel, so ShareMenu / collection callers keep working unchanged.
export function SharePanel({ title, url, artifactId }: { title: string; url: string; artifactId?: string }) {
  const art = artifactId ? getArtifact(artifactId) : undefined;
  const [tab, setTab] = React.useState<"share" | "publish">("share");
  const [published, setPublished] = React.useState(() => !!art?.public);
  const [copied, setCopied] = React.useState<"share" | "publish" | null>(null);

  const publicUrl = art ? `woven.dev/a/${art.hub_slug ?? art.id}` : url;
  const internalUrl = art ? `woven.dev/artifact/${art.id}` : url;

  function copyUrl(which: "share" | "publish", u: string) {
    navigator.clipboard?.writeText(u.startsWith("http") ? u : `https://${u}`).catch(() => {});
    setCopied(which);
    notify.success("Link copied", { description: u });
    window.setTimeout(() => setCopied(null), 1500);
  }
  function publish() {
    if (artifactId) publishArtifact(artifactId, "public");
    setPublished(true);
    notify.success("Published to web", { description: publicUrl });
  }
  function unpublish() {
    if (artifactId) publishArtifact(artifactId, "workspace");
    setPublished(false);
    notify.success("Unpublished", { description: "It's a private artifact again." });
  }

  const linkRow = (which: "share" | "publish", u: string) => (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pr-1.5 pl-2.5">
      <Globe className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate font-mono text-[13px]">{u}</span>
      <button
        onClick={() => copyUrl(which, u)}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[13px] font-medium transition-colors hover:bg-foreground/[0.06]"
      >
        {copied === which ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied === which ? "Copied" : "Copy"}
      </button>
    </div>
  );

  const channelsRow = (u: string) => {
    const full = u.startsWith("http") ? u : `https://${u}`;
    const channels = [
      { label: "Email", Icon: Mail, href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(full)}` },
      { label: "X", Icon: XMark, href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(full)}&text=${encodeURIComponent(title)}` },
      { label: "LinkedIn", Icon: LinkedInMark, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(full)}` },
    ];
    return (
      <div className="grid grid-cols-3 gap-2">
        {channels.map(({ label, Icon, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 rounded-lg border py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.03] hover:text-foreground"
          >
            <Icon className="size-4" /> {label}
          </a>
        ))}
      </div>
    );
  };

  // callers without an artifact (ShareMenu / collections) → the light "spread the link" panel, unchanged
  if (!artifactId) {
    return (
      <>
        <p className="text-[15px] font-medium">Share &ldquo;{title}&rdquo;</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Anyone with the link can view.</p>
        <div className="mt-3">{linkRow("share", url)}</div>
        <div className="mt-3">{channelsRow(url)}</div>
      </>
    );
  }

  return (
    <div>
      <p className="text-[15px] font-medium">Share &ldquo;{title}&rdquo;</p>

      {/* tabs — Share (who can open it) vs Publish (a public web page). No Tabs primitive in the app; inline. */}
      <div className="mt-3 flex rounded-lg bg-muted p-0.5">
        {(["share", "publish"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 rounded-md py-1 text-[14px] font-medium capitalize transition-colors ${
              tab === t ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "share" ? (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">
              People with access
            </p>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Users2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">
                <span className="block text-[15px] font-medium">Acme · Product</span>
                <span className="block text-[13px] text-muted-foreground">Everyone in the space</span>
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">Can view</span>
            </div>
          </div>
          {linkRow("share", internalUrl)}
          <p className="text-[12px] leading-snug text-muted-foreground">
            Only people in Acme · Product can open this link. To share outside the org, publish it to the web.
          </p>
        </div>
      ) : (
        <div className="mt-3">
          {published ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[13px] font-medium text-primary">
                  <span className="size-1.5 rounded-full bg-primary" /> Live
                </span>
                <span className="text-[13px] text-muted-foreground">Discoverable · read-tracked</span>
              </div>
              {linkRow("publish", publicUrl)}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`/a/${art?.hub_slug ?? artifactId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[14px] font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.03]"
                >
                  <ExternalLink className="size-3.5" /> Visit site
                </a>
                <button
                  onClick={unpublish}
                  className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[14px] font-medium text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/[0.06]"
                >
                  Unpublish
                </button>
              </div>
              {channelsRow(publicUrl)}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <Globe className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-[14px] leading-snug text-foreground/80">
                  Turn this into a living public page — anyone with the link can read it, and every read flows
                  back into the graph. Privacy-friendly, no cookies.
                </p>
              </div>
              <Button onClick={publish} className="w-full">
                <Globe className="size-4" /> Publish to web
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ShareMenu — the light Share popover for callers with no publish concept (collections): copy the link +
// a few channels. Reusable; the artifact reader drops SharePanel behind its own trigger with an artifactId.
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
