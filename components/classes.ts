// Shared class strings, in a module with NO "use client". A string constant exported from a client module
// becomes a client-reference proxy when a SERVER component imports it — cn() drops it, and the class silently
// never renders on that side. today-ui.tsx (a shared module) rendered SectionAction without its focus ring on
// every server-rendered page while the client islands beside it had one. Keep plain strings here.

// The house focus ring — the one focus language for rows, links, buttons and the hero.
export const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-focus";

// The one INSET row-divider: a hairline above every child except the first, inset L/R so the line floats inside
// the content column (a list inside a contained surface).
export const DIVIDED =
  "[&>*+*]:relative [&>*+*]:before:pointer-events-none [&>*+*]:before:absolute [&>*+*]:before:inset-x-3 [&>*+*]:before:top-0 [&>*+*]:before:h-px [&>*+*]:before:bg-border";

// The FLUSH variant, for a list that sits directly in the page column and shares its edges.
export const DIVIDED_FLUSH =
  "[&>*+*]:relative [&>*+*]:before:pointer-events-none [&>*+*]:before:absolute [&>*+*]:before:inset-x-0 [&>*+*]:before:top-0 [&>*+*]:before:h-px [&>*+*]:before:bg-border";
