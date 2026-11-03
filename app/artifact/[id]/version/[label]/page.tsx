import { ArtifactPageClient } from "@/components/artifact-page-client";
import { artifactVersions, listArtifacts } from "@/lib/api";

export function generateStaticParams() {
  return listArtifacts().flatMap((artifact) =>
    artifactVersions(artifact.id).map((version) => ({
      id: artifact.id,
      label: version.label,
    })),
  );
}

export default async function ArtifactVersionPage({
  params,
}: {
  params: Promise<{ id: string; label: string }>;
}) {
  const { id, label } = await params;
  return <ArtifactPageClient artifactId={id} versionLabel={label} />;
}
