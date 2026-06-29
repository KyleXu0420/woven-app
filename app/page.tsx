import { redirect } from "next/navigation";

// The app opens on Today. (The early foundation/showcase page is retired — the live
// app is the proof now; a fresh design-system showcase can be rebuilt under /showcase if needed.)
export default function Home() {
  redirect("/today");
}
