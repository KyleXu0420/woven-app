import { Section, SectionAction } from "@/components/today-ui";
import { DayLine } from "@/components/home/day-line";
import { ContinueHero } from "@/components/home/continue-hero";
import { Orient } from "@/components/home/orient";
import { NeedsYou } from "@/components/home/needs-you";
import { AskSuggestions } from "@/components/ask-suggestions";
import { PAGE_FRAME } from "@/lib/frame";
import { HOME_MEASURE } from "@/lib/home";

// The home, rebuilt as four client islands on the recorded spine — RESUME → ORIENT → DECIDE → ASK — so every
// number on it is live and sourced once. A parallel route while /today (line A) stays as it is; the review is
// in claude-woven-visual-review-2026-08-14/home-2026-09-03/HOME-SPEC.md.
//
// Air: ONE value above every section, 32px — Section's mt-8, and NeedsYou's written-out header uses the same
// class. Measured box to box (the previous section's last box, then the next header): 32 above Continue, Since
// you were away, Needs you and Ask Woven. A section is parted from the one before it by this space and from its
// own rows by the header's 10px (mb-2.5), never by a size of its own. Where the section above ends in a row,
// the row's own 10px padding sits inside that row's box (its hover wash fills it), so the ink-to-ink gap there
// reads 42; that is the row, not a second section value.
//
// Measure: every prose line on the page is capped at 75ch (HOME_MEASURE, lib/home.ts). The rows' hairlines
// still run to the column's edge; the text stops short of it.
export default function HomePage() {
  return (
    <div className={PAGE_FRAME.focused}>
      <h1 className="text-2xl font-medium">Today</h1>
      <p className={`mt-2 text-base text-muted-foreground ${HOME_MEASURE}`}>
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
