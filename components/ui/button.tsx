import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// The house has ONE rule about hover: it deepens, it never pales. This primitive broke it in the one
// place it matters most. Measured in light: the solid confirm rests at #365e33 (6.61:1 against paper,
// oat label 6.74:1) and hovered at #41693e — +28% luminance, contrast down to 5.60:1, label down to
// 5.71:1. The button faded, and its label got harder to read, exactly as you reached to click it.
// AGENTS.md Appendix B even annotates that pair "(deepens)"; it never did. Dark was always right,
// because on charcoal lighter IS more contrast. Fixed in the token (globals.css), which six other
// hand-rolled solids read too.
//
// Two more things this base was doing that nothing else in the app does:
//   · hover:-translate-y-px + active:translate-y-px — a 2px physical press on every button, in a
//     system where ViewTabs, SegToggle, FilterChips, Row and SectionAction are all transition-colors
//     and hold still. In a list row it fired at the same instant as the row's own wash: two motions
//     and a colour change for one hover. The tells that it was already regretted are in the file —
//     the link variant cancels it with hover:translate-y-0, and DropButton re-declares it on top of
//     a base that already had it. Depth here is carried by tone; it does not need a second language.
//   · transition-all, which animated the focus ring in over 150ms. transition-colors is the list
//     every other control already uses, so buttons and rows now share one clock.
//
// Removed as dead plumbing, zero call sites between them: has-data-[icon=inline-start|end] padding
// (8 classes), in-data-[slot=button-group] (4 classes, and there is no button group), the size lg
// rung (no text button uses it), and the aria-invalid chain (a button is never aria-invalid; the
// app's three uses are on inputs).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover",
        // alpha ink rather than --muted. bg-muted is DARKER than the ground in both themes, which
        // deepens correctly on paper and sinks on charcoal, where raised is lighter — hence the
        // dark:* overrides that were papering over it. Ink at a percentage flips by construction.
        outline:
          "border-border bg-background hover:bg-foreground/[0.05] hover:text-foreground active:bg-foreground/[0.08] aria-expanded:bg-foreground/[0.05] aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-foreground/[0.05] hover:text-foreground active:bg-foreground/[0.08] aria-expanded:bg-foreground/[0.05] aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-4 text-base",
        // px-3, not px-2.5: it was the one rung whose padding (10) was less than its radius (12), so
        // its label ends sat inside the curve. The other two run padding >= radius.
        xs: "h-6 gap-1 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-7 gap-1.5 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
