import { redirect } from "next/navigation";

// /home was the parallel route the Home was rebuilt on. /today renders it now, so this only keeps old links alive.
export default function HomePage() {
  redirect("/today");
}
