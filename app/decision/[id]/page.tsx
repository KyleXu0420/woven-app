import { notFound } from "next/navigation";
import { DecisionDetail } from "@/components/decision-detail";
import { SystemState } from "@/components/system-state";
import { VIEWER, canView, decisionById, decisionRecord, listDecisionRecords } from "@/lib/api";

export function generateStaticParams() {
  return listDecisionRecords().map((record) => ({ id: record.decision.id }));
}

export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!decisionById(id)) notFound();
  if (!canView(id, VIEWER)) {
    return <SystemState variant="no-access" scope="reader" action={{ href: "/inbox", label: "Back to Inbox" }} />;
  }
  // A visible Decision may still depend on evidence unavailable to this viewer. Keep that failure
  // closed without exposing the missing evidence; individual Activation observations degrade in api.ts.
  if (!decisionRecord(id)) notFound();
  return <DecisionDetail decisionId={id} />;
}
