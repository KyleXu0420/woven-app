"use client";

import * as React from "react";
import { SlidersHorizontal, ChevronDown, Search, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { PersonAvatar } from "./identity";

// A facet the filter can drill into. `defaultValue` is the "no filter" option (All / Any / the default
// sort). `variant` picks how the callout renders its values — plain pills, a searchable people list
// (avatars, Mem-style), or date presets + a custom range.
export type FacetDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  options: string[];
  defaultValue: string;
  variant?: "pills" | "people" | "date";
  people?: { id: string; name: string }[]; // variant "people"
};

function Pill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04]",
      )}
    >
      {label}
    </button>
  );
}

// The 2-step filter (Mem-style): the popover lists facet rows; clicking a row calls out its values in
// place (accordion — one open at a time). The selected value reflects back onto the row; a count rides
// the trigger. Values render by variant — pills, a people search, or date presets + a custom range.
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
  const [pQuery, setPQuery] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
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
                  <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[12px]">
                    <span className={cn("max-w-[7.5rem] truncate", active ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {val}
                    </span>
                    <ChevronDown
                      className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                    />
                  </span>
                </button>

                {/* step 2 — the values, called out in place, by variant */}
                {open ? (
                  <div className="animate-in fade-in-0 slide-in-from-top-1 duration-150">
                    {d.variant === "people" ? (
                      <div className="px-2 pt-1 pb-2.5">
                        <div className="mb-1.5 flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5">
                          <Search className="size-3.5 shrink-0 text-muted-foreground" />
                          <input
                            value={pQuery}
                            onChange={(e) => setPQuery(e.target.value)}
                            placeholder="Filter people…"
                            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                        <div className="scrollbar-subtle flex max-h-52 flex-col overflow-y-auto">
                          {[{ id: "__any", name: d.defaultValue }, ...(d.people ?? [])]
                            .filter((p) => p.id === "__any" || p.name.toLowerCase().includes(pQuery.toLowerCase()))
                            .map((p) => {
                              const isAny = p.id === "__any";
                              const sel = val === p.name;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => onChange(d.key, p.name)}
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-foreground/[0.04]",
                                    sel && "bg-foreground/[0.04]",
                                  )}
                                >
                                  {isAny ? (
                                    <span className="flex size-5 items-center justify-center text-muted-foreground">·</span>
                                  ) : (
                                    <PersonAvatar seed={p.id} name={p.name} size="xs" />
                                  )}
                                  <span className="min-w-0 flex-1 truncate">{isAny ? "Anyone" : p.name}</span>
                                  {sel ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ) : d.variant === "date" ? (
                      <div className="px-2 pt-1 pb-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {d.options.map((o) => (
                            <Pill key={o} active={val === o} label={o} onClick={() => onChange(d.key, o)} />
                          ))}
                        </div>
                        <div className="mt-2.5 border-t pt-2.5">
                          <p className="mb-1.5 px-1 text-[11px] text-muted-foreground">Custom range</p>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              value={from}
                              onChange={(e) => {
                                setFrom(e.target.value);
                                if (e.target.value && to) onChange(d.key, "Custom");
                              }}
                              className="min-w-0 flex-1 rounded-md border bg-card px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            />
                            <span className="shrink-0 text-muted-foreground">–</span>
                            <input
                              type="date"
                              value={to}
                              onChange={(e) => {
                                setTo(e.target.value);
                                if (from && e.target.value) onChange(d.key, "Custom");
                              }}
                              className="min-w-0 flex-1 rounded-md border bg-card px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2.5">
                        {d.options.map((o) => (
                          <Pill key={o} active={val === o} label={o} onClick={() => onChange(d.key, o)} />
                        ))}
                      </div>
                    )}
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
