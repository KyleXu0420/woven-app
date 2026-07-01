"use client";

import * as React from "react";
import { Share2, Copy, Check, Mail, Globe } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { notify } from "@/lib/notifications";

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

// SharePanel — the popover body (link + channels), extracted so both the ShareMenu button and the
// artifact reader's floating toolbar can drop it behind their own triggers.
export function SharePanel({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = React.useState(false);
  const full = url.startsWith("http") ? url : `https://${url}`;

  function copy() {
    navigator.clipboard?.writeText(full).catch(() => {});
    setCopied(true);
    notify.success("Link copied", { description: url });
    window.setTimeout(() => setCopied(false), 1500);
  }

  const channels = [
    { label: "Email", Icon: Mail, href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(full)}` },
    { label: "X", Icon: XMark, href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(full)}&text=${encodeURIComponent(title)}` },
    { label: "LinkedIn", Icon: LinkedInMark, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(full)}` },
  ];

  return (
    <>
      <p className="text-sm font-medium">Share &ldquo;{title}&rdquo;</p>
      <p className="mt-1 text-xs text-muted-foreground">Anyone with the link can view.</p>

      {/* the link + copy */}
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

      {/* channels */}
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
