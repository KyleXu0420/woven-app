import Link from "next/link";
import { PAGE_FRAME } from "@/lib/frame";

// A missing route keeps the shell: sidebar intact, one sentence, one way back. Next's stock 404 dropped the
// viewer out of the product with no navigation.
export default function NotFound() {
  return (
    <div className={PAGE_FRAME.focused}>
      <h1 className="text-2xl font-medium">Nothing here</h1>
      <p className="mt-2 text-base text-muted-foreground">This page has moved or never existed.</p>
      <Link href="/today" className="mt-6 inline-flex min-h-11 items-center rounded-md px-2 py-1 text-sm text-foreground underline-offset-4 hover:underline md:min-h-0">
        Back to Today
      </Link>
    </div>
  );
}
