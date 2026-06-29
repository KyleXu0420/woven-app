import { notFound } from "next/navigation";
import { ArtifactReader } from "@/components/artifact-reader";
import { getArtifact, listArtifacts } from "@/lib/api";

export function generateStaticParams() {
  return listArtifacts().map((a) => ({ id: a.id }));
}

// The artifact reading surface lives OUTSIDE the (app) shell — no sidebar, no app topbar —
// so reading is full-bleed and immersive. Its own minimal chrome (back · floating toolbar)
// lives in <ArtifactReader>. Back returns to wherever the reader was opened from.
export default async function ArtifactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getArtifact(id)) notFound();
  return <ArtifactReader artifactId={id} />;
}
