import { SystemState } from "@/components/system-state";

export default function DecisionNotFound() {
  return (
    <SystemState
      variant="not-found"
      scope="reader"
      title="Decision not found"
      body="This decision is not available at this link."
      action={{ href: "/inbox", label: "Back to Inbox" }}
    />
  );
}
