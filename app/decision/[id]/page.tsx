import { notFound } from "next/navigation";
import { DecisionDetail } from "@/components/decision-detail";
import { decisionRecord, listDecisionRecords } from "@/lib/api";

export function generateStaticParams() {
  return listDecisionRecords().map((record) => ({ id: record.decision.id }));
}

export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!decisionRecord(id)) notFound();
  return <DecisionDetail decisionId={id} />;
}
