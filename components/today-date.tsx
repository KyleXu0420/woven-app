"use client";

// The day anchor. The page is called Today but carried no day at all — this is the orienting first fact.
// Client-side on purpose: /today is statically prerendered, so a server-rendered date would freeze at build
// time and quietly go stale. suppressHydrationWarning covers the one-tick build-date → real-date correction.
export function TodayDate() {
  return (
    <span suppressHydrationWarning className="font-medium text-foreground">
      {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
    </span>
  );
}
