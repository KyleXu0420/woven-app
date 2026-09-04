// One place owns the page frame. ONE width for every (app) page, CENTERED (mx-auto) — equal, constant L/R
// margins on every route (the Vercel model). This replaces the earlier left-anchor, which left a large dead
// gutter on the right; uniform-width + centered keeps the margins symmetric and identical page-to-page, which
// was the real ask. The focused/browse split is retired (kept as aliases so callers don't churn). `full` stays
// for a graph canvas that genuinely wants the whole well. One hinge = md (768px).
const PAGE = "mx-auto w-full max-w-[1040px] px-5 py-6 md:px-8 md:py-10";
export const PAGE_FRAME = {
  focused: PAGE,
  browse: PAGE,
  full: "w-full px-5 py-6 md:px-8 md:py-10",
} as const;
