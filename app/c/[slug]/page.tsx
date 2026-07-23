"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { TypeBadge } from "@/components/artifact-ui";
import { EmergentMark } from "@/components/emergent-mark";
import { collectionPublicMembers, hydrateState, listCollections, spaceById } from "@/lib/api";
import { WovenMark } from "@/components/woven-mark";

// The PUBLIC face of a collection — no app chrome (this route lives outside the (app) group, so it uses
// the root layout: no sidebar, no topbar). Client-rendered + localStorage-hydrated so a freshly published
// collection resolves here across reloads and new tabs (same browser), not just the seeded ones.

export default function PublicHub() {
  const { slug } = useParams<{ slug: string }>();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    hydrateState();
    setReady(true);
  }, []);

  // neutral shell during SSR + first paint (before localStorage is applied) — avoids a hydration mismatch
  if (!ready) return <div className="min-h-svh bg-background" />;

  const meta = listCollections().find((c) => c.slug === slug);
  if (!meta || !meta.public) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <WovenMark className="h-4 w-auto" />
        </span>
        <p className="text-[15px] font-medium">This collection isn’t published</p>
        <Link href="/" className="text-[14px] text-primary hover:underline">
          Go to Woven →
        </Link>
      </div>
    );
  }

  const org = spaceById(meta.space_id)?.name ?? "Acme · Product";
  const artifacts = collectionPublicMembers(meta.slug);

  return (
    <div className="min-h-svh bg-background">
      {/* minimal public header */}
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span className="flex items-center gap-2 text-[15px] font-medium">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <WovenMark className="h-3.5 w-auto" />
            </span>
            {org}
          </span>
        </div>
        <span className="text-[12px] text-muted-foreground">published with Woven</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pt-10 pb-20">
        {/* hero — the collection's emergent KG-mark leads as the shareable visual: a recipient grasps
            the body of work's structure at a glance, before reading a word */}
        <EmergentMark slug={meta.slug} className="mb-7 size-28" />
        <p className="text-[13px] font-medium text-muted-foreground">Collection</p>
        <h1 className="mt-3 text-[40px] font-medium leading-[1.05] tracking-[-0.02em]">{meta.name}</h1>
        {meta.intro ? (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/80">{meta.intro}</p>
        ) : null}
        <p className="mt-5 font-mono text-[12px] text-muted-foreground">
          {artifacts.length} artifacts · living · updated weekly
        </p>

        {/* the public artifacts — a clean reading index */}
        <div className="mt-10 flex flex-col gap-px overflow-hidden rounded-2xl border bg-border">
          {artifacts.map((a) => (
            <Link
              key={a.id}
              href={`/artifact/${a.id}`}
              className="group flex items-start gap-4 bg-card p-5 transition-colors hover:bg-foreground/[0.02]"
            >
              <span className="mt-0.5">
                <TypeBadge type={a.type} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl leading-snug">{a.title}</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{a.gist}</p>
              </div>
              <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>

        {/* footer */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-2 border-t pt-6 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <WovenMark className="h-2.5 w-auto" /> Published with Woven
          </span>
          <span>Privacy-friendly · no cookies</span>
        </footer>
      </main>
    </div>
  );
}
