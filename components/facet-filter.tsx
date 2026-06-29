"use client";

import * as React from "react";
import { SlidersHorizontal, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// A facet the filter can drill into. `defaultValue` is the "no filter" option (All / Any / the default sort).
export type FacetDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  options: string[];
  defaultValue: string;
};

// The 2-step filter (Mem-style): the popover lists facet rows; clicking a row expands its value pills in
// place (accordion — one open at a time). The selected value reflects back onto the row; a count rides the
// trigger. Categorical only — values are plain pills, so it stays one calm surface, no nested flyouts.
export function FacetFilter({
  defs,
  values,
  onChange,
  onClear,
}: {
  defs: FacetDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}) {
  const [openKey, setOpenKey] = React.useState<string | null>(defs[0]?.key ?? null);
  const activeCount = defs.filter((d) => values[d.key] !== d.defaultValue).length;

  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.8rem] font-medium outline-none transition-colors hover:bg-muted data-[popup-open]:bg-secondary data-[popup-open]:text-foreground">
        <SlidersHorizontal className="size-3.5" /> Filter
        {activeCount > 0 ? (
          <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[10px] font-semibold tabular-nums">
            {activeCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1.5">
        <div className="flex items-center justify-between px-1.5 pt-1 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Filter
          </span>
          {activeCount > 0 ? (
            <button
              onClick={onClear}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          ) : null}
        </div>

        <div className="flex flex-col">
          {defs.map((d) => {
            const open = openKey === d.key;
            const val = values[d.key];
            const active = val !== d.defaultValue;
            return (
              <div key={d.key}>
                {/* step 1 — the facet row */}
                <button
                  onClick={() => setOpenKey(open ? null : d.key)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-foreground/[0.04]"
                >
                  <d.icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-[13px] font-medium">{d.label}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[12px]">
                    <span className={active ? "font-medium text-foreground" : "text-muted-foreground"}>{val}</span>
                    <ChevronDown
                      className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
                    />
                  </span>
                </button>

                {/* step 2 — the value pills, called out in place */}
                {open ? (
                  <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2.5 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                    {d.options.map((o) => (
                      <button
                        key={o}
                        onClick={() => onChange(d.key, o)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                          val === o
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-foreground/[0.04]",
                        )}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
