import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { artifactByHubSlug, getBlocks, listArtifacts, spaceById } from "@/lib/api";
import { WovenMark } from "@/components/woven-mark";

// The PUBLIC face of a single artifact — no app chrome (this route lives outside the (app) group, so it
// uses the root layout). The read-only microsite a published/shared artifact link resolves to.

export function generateStaticParams() {
  return listArtifacts()
    .filter((a) => a.public)
    .map((a) => ({ slug: a.hub_slug ?? a.id }));
}

export default async function ArtifactHub({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artifact = artifactByHubSlug(slug);
  if (!artifact) notFound();
  const blocks = getBlocks(artifact.id);
  const org = spaceById(artifact.space_id)?.name ?? "Acme · Product";

  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <WovenMark className="h-3.5 w-auto" />
            </span>
            {org}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">published with Woven</span>
      </header>

      <main className="mx-auto max-w-2xl px-6 pt-10 pb-24">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {artifact.type} · living
        </p>
        <h1 className="mt-3 text-[40px] font-medium leading-[1.05] tracking-[-0.02em]">{artifact.title}</h1>
        {artifact.gist ? (
          <p className="mt-5 text-lg leading-relaxed text-foreground/80">{artifact.gist}</p>
        ) : null}

        <article className="mt-10 flex flex-col gap-8 border-t pt-10">
          {blocks.map((b) => (
            <section key={b.id}>
              <h2 className="text-[1.375rem] font-medium leading-snug">{b.heading}</h2>
              <p className="mt-2 whitespace-pre-wrap text-[19px] leading-relaxed text-foreground/85">{b.text}</p>
            </section>
          ))}
        </article>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-2 border-t pt-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <WovenMark className="h-2.5 w-auto" /> Published with Woven
          </span>
          <span>Privacy-friendly · no cookies</span>
        </footer>
      </main>
    </div>
  );
}
