import { SystemState } from "@/components/system-state";

export default function ArtifactNotFound() {
  return (
    <SystemState
      variant="not-found"
      scope="reader"
      title="Artifact not found"
      body="Nothing at this link is saved in this browser."
      action={{ href: "/library", label: "Back to Library" }}
    />
  );
}
