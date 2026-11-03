"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, History } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { PAGE_FRAME } from "@/lib/frame";
import type { Artifact, ArtifactVersion } from "@/lib/types";

// A hex run this long is an identifier (a content hash, a commit SHA, a digest), never words.
const HASH_LIKE = /^[0-9a-f]{13,}$/i;
export const isHashLike = (value: string) => HASH_LIKE.test(value);

// A content hash is a real value, so it may wear mono; it is not a sentence, so it never runs as body text.
// The Decision page printed all 64 characters of a SHA-256 inside a meta line, where it wrapped onto a line
// of its own and read as generated noise, and this page set it as an 11px paragraph in a box. Seven
// characters name it the way a short commit SHA does; the whole value is one click away on the copy button
// and in the chip's title on hover. The chip is a mark (tint-1, rounded-sm); the button is the house icon
// button on the icon-xs rung, its word in the tooltip.
export function HashChip({ value, label = "Copy full hash" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      <code title={value} className="rounded-sm bg-tint-1 px-1.5 font-mono text-xs text-foreground">
        {value.slice(0, 7)}
      </code>
      <IconButton
        size="icon-xs"
        label={copied ? "Copied" : label}
        side="top"
        className="text-muted-foreground"
        onClick={() => {
          navigator.clipboard
            ?.writeText(value)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
      >
        {copied ? <Check /> : <Copy />}
      </IconButton>
    </span>
  );
}

const SNAPSHOT_CSP = [
  "default-src 'none'",
  "img-src data: blob:",
  "style-src 'unsafe-inline' data: blob:",
  "font-src data: blob:",
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

const SNAPSHOT_PROBE = "woven:exact-snapshot:probe";
const SNAPSHOT_READY = "woven:exact-snapshot:ready";

function navigationGuard(token: string): string {
  return `(() => {
  const token = ${JSON.stringify(token)};
  const navigationElement = (target) =>
    target instanceof Element ? target.closest("a, area") : null;
  const blockNavigation = (event) => {
    if (navigationElement(event.target)) event.preventDefault();
  };
  window.addEventListener("click", blockNavigation, true);
  window.addEventListener("auxclick", blockNavigation, true);
  window.addEventListener("submit", (event) => event.preventDefault(), true);
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (
      message &&
      message.type === ${JSON.stringify(SNAPSHOT_PROBE)} &&
      message.token === token &&
      Number.isInteger(message.probe)
    ) {
      event.source?.postMessage(
        { type: ${JSON.stringify(SNAPSHOT_READY)}, token, probe: message.probe },
        "*",
      );
    }
  }, true);
})();`;
}

function snapshotDocument(raw: string, navigationToken: string): string {
  const parsed = new DOMParser().parseFromString(raw, "text/html");
  parsed.querySelectorAll("base").forEach((node) => node.remove());
  parsed.querySelectorAll("meta[http-equiv]").forEach((node) => {
    const directive = node.getAttribute("http-equiv")?.trim().toLowerCase();
    if (directive === "content-security-policy" || directive === "refresh") {
      node.remove();
    }
  });

  parsed.querySelectorAll("a, area").forEach((node) => {
    node.removeAttribute("href");
    node.removeAttribute("xlink:href");
    node.removeAttribute("target");
    node.removeAttribute("ping");
    node.removeAttribute("download");
    node.setAttribute("aria-disabled", "true");
  });
  parsed.querySelectorAll("form").forEach((node) => {
    node.removeAttribute("action");
    node.removeAttribute("target");
  });
  parsed.querySelectorAll("[formaction], [formtarget]").forEach((node) => {
    node.removeAttribute("formaction");
    node.removeAttribute("formtarget");
  });

  const csp = parsed.createElement("meta");
  csp.httpEquiv = "Content-Security-Policy";
  csp.content = SNAPSHOT_CSP;
  parsed.head.prepend(csp);

  const guard = parsed.createElement("script");
  guard.textContent = navigationGuard(navigationToken);
  csp.after(guard);

  if (!parsed.querySelector('meta[name="viewport" i]')) {
    const viewport = parsed.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1";
    guard.before(viewport);
  }

  return `<!doctype html>\n${parsed.documentElement.outerHTML}`;
}

export function ExactEvidenceSnapshot({
  artifact,
  version,
}: {
  artifact: Artifact;
  version: ArtifactVersion;
}) {
  const [srcDoc, setSrcDoc] = React.useState("");
  const [frameKey, setFrameKey] = React.useState(0);
  const [navigationBlocked, setNavigationBlocked] = React.useState(false);
  const navigationToken = `woven-snapshot-${React.useId()}`;
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const probeSequence = React.useRef(0);
  const readyProbe = React.useRef(0);
  const navigationCheck = React.useRef<number | null>(null);
  const snapshot = version.snapshot;

  React.useEffect(() => {
    if (snapshot?.format !== "html") return;
    const next = snapshotDocument(snapshot.raw, navigationToken);
    readyProbe.current = 0;
    queueMicrotask(() => {
      setNavigationBlocked(false);
      setSrcDoc(next);
    });
  }, [navigationToken, snapshot]);

  React.useEffect(() => {
    function handleSnapshotReady(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data as { type?: unknown; token?: unknown; probe?: unknown } | null;
      if (
        message?.type === SNAPSHOT_READY &&
        message.token === navigationToken &&
        Number.isInteger(message.probe)
      ) {
        readyProbe.current = message.probe as number;
      }
    }

    window.addEventListener("message", handleSnapshotReady);
    return () => {
      window.removeEventListener("message", handleSnapshotReady);
      if (navigationCheck.current !== null) window.clearTimeout(navigationCheck.current);
    };
  }, [navigationToken]);

  function handleFrameLoad() {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;

    const probe = probeSequence.current + 1;
    probeSequence.current = probe;
    readyProbe.current = 0;
    frame.contentWindow.postMessage({ type: SNAPSHOT_PROBE, token: navigationToken, probe }, "*");
    if (navigationCheck.current !== null) window.clearTimeout(navigationCheck.current);

    navigationCheck.current = window.setTimeout(() => {
      navigationCheck.current = null;
      if (frame !== frameRef.current || readyProbe.current === probe) return;
      setNavigationBlocked(true);
      setFrameKey((current) => current + 1);
    }, 100);
  }

  const blocks = snapshot?.blocks ?? [];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-[60px] w-full max-w-[1040px] items-center gap-3 px-5 md:px-8">
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ArrowLeft className="size-4" /> Back to Library
          </Link>
          <span className="h-4 w-px bg-border" />
          <span className="min-w-0 truncate text-sm font-medium">{artifact.title}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">Read only</span>
        </div>
      </header>

      <div className={PAGE_FRAME.browse}>
        <div className="flex flex-col gap-6">
          <section aria-labelledby="snapshot-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <History className="size-4" /> Exact snapshot of version {version.label}
                </p>
                <h1 id="snapshot-title" className="mt-2 text-2xl font-medium">
                  {artifact.title}
                </h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                  {version.summary}
                </p>
              </div>
              {/* The hash used to sit in a boxed panel of its own under the title, all 64 characters at 11px.
                  It is one fact of the capture, so it joins the capture's other facts as a line with its chip. */}
              <div className="flex shrink-0 flex-col gap-1 text-xs text-muted-foreground sm:items-end sm:text-right">
                <p>{snapshot?.format === "html" ? "Self-contained HTML or SVG" : artifact.type}</p>
                <p>Captured by {version.byName}, {version.at}</p>
                <p className="flex items-center gap-1.5">
                  Content hash
                  {version.content_hash ? <HashChip value={version.content_hash} /> : <span className="text-foreground">not recorded</span>}
                </p>
              </div>
            </div>
          </section>

          <section aria-label="Captured interaction" className="overflow-hidden rounded-xl border bg-card">
            {navigationBlocked ? (
              <p
                role="status"
                className="border-b bg-tint-1 px-3.5 py-2.5 text-xs text-muted-foreground"
              >
                Navigation was blocked. The frozen snapshot has been restored.
              </p>
            ) : null}
            {srcDoc ? (
              <iframe
                key={frameKey}
                ref={frameRef}
                title={`Exact ${version.label} interaction of ${artifact.title}`}
                srcDoc={srcDoc}
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                onLoad={handleFrameLoad}
                className="h-[min(72vh,760px)] min-h-[520px] w-full bg-card"
              />
            ) : (
              <div className="flex min-h-[520px] items-center justify-center text-sm text-muted-foreground">
                Preparing the exact snapshot…
              </div>
            )}
          </section>

          {blocks.length ? (
            <section aria-labelledby="extracted-text-title" className="pb-10">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id="extracted-text-title" className="text-xl font-medium">
                  Extracted text
                </h2>
                <span className="text-xs text-muted-foreground">From this exact snapshot</span>
              </div>
              <div className="rounded-xl bg-card px-5 py-2 sm:px-7">
                {blocks.map((block, index) => (
                  <article
                    key={block.id}
                    className={index ? "border-t py-5" : "py-5"}
                  >
                    <h3 className="text-base font-medium">{block.heading}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-base text-foreground-prose">
                      {block.text}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
