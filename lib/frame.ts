// One place owns the page frame — width + padding + LEFT-ANCHOR — so every (app) page starts at the SAME
// left edge (no mx-auto → the left gutter is constant across route switches; only the RIGHT edge caps by
// register). Three registers: focused reading columns (today · activity · inbox), browse row lists
// (library · people · topics · collection · team), and full-bleed canvases (a graph field opts in with
// `browse`-less full width where it genuinely needs the room). One hinge = md (768px). Import this instead
// of hand-writing `mx-auto max-w-* p-*` per page.
export const PAGE_FRAME = {
  focused: "w-full max-w-[672px] px-5 py-6 md:px-8 md:py-10",
  browse: "w-full max-w-[1000px] px-5 py-6 md:px-8 md:py-10",
  full: "w-full px-5 py-6 md:px-8 md:py-10",
} as const;
