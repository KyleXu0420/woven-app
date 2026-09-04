import { notFound } from "next/navigation";

// Any path nothing else claims lands here, inside the (app) shell, and renders app/(app)/not-found.tsx —
// so a stale link keeps the sidebar and a way back instead of Next's bare 404 outside the product.
export default function Missing() {
  notFound();
}
