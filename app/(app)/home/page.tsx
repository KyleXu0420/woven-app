import { Section, SectionAction } from "@/components/today-ui";
import { DayLine } from "@/components/home/day-line";
import { ContinueHero } from "@/components/home/continue-hero";
import { Orient } from "@/components/home/orient";
import { NeedsYou } from "@/components/home/needs-you";
import { AskSuggestions } from "@/components/ask-suggestions";
import { PAGE_FRAME } from "@/lib/frame";

// The home, rebuilt as four client islands on the recorded spine — RESUME → ORIENT → DECIDE → ASK — so every
// number on it is live and sourced once. A parallel route while /today (line A) stays as it is; the review is
// in claude-woven-visual-review-2026-08-14/home-2026-09-03/HOME-SPEC.md.
export default function HomePage() {
  return (
    <div className={PAGE_FRAME.focused}>
      <h1 className="text-2xl font-medium">Today</h1>
      <p className="mt-2 text-base text-muted-foreground">
        <DayLine />
      </p>
      <Section label="Continue" action={<SectionAction href="/library">All in Library</SectionAction>}>
        <ContinueHero />
      </Section>
      <Orient />
      <NeedsYou />
      <AskSuggestions flush />
    </div>
  );
}
