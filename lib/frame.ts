// One place owns the page frame. ONE width for every (app) page, CENTERED (mx-auto) — equal, constant L/R
// margins on every route (the Vercel model). This replaces the earlier left-anchor, which left a large dead
// gutter on the right; uniform-width + centered keeps the margins symmetric and identical page-to-page, which
// was the real ask. The focused/browse split is retired (kept as aliases so callers don't churn). `full` stays
// for a graph canvas that genuinely wants the whole well. One hinge = md (768px).
// `fill`: the same frame as a flex column that takes main's whole height — for a page whose last block is
// a field that runs to the column's bottom inset rather than to its content (the explorer's space field,
// see components/explorer.tsx GraphView). The margins and the width are the same register; only the
// height is passed down, so the page's edges stay where every other page's are.
const PAGE = "mx-auto w-full max-w-[1040px] px-5 py-6 md:px-8 md:py-10";
export const PAGE_FRAME = {
  focused: PAGE,
  browse: PAGE,
  fill: `${PAGE} flex flex-1 flex-col`,
  full: "w-full px-5 py-6 md:px-8 md:py-10",
} as const;
