"use client";

import * as React from "react";
import { ChevronDown, Search, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { PersonAvatar } from "./identity";

// A facet the filter can drill into. `defaultValue` is the "no filter" option (All / Any / the default
// sort). `variant` picks how its values render — plain pills, a searchable people list (avatars,
// Mem-style), or date presets + a custom range.
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

// The values for one facet, rendered by variant. Self-contained (owns its search / range state) so it
// drops equally into the FacetBar's per-facet popover or the FacetFilter accordion.
function FacetValues({
  def,
  value,
  onChange,
}: {
  def: FacetDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const [pQuery, setPQuery] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  if (def.variant === "people") {
    return (
      <div>
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
          {[{ id: "__any", name: def.defaultValue }, ...(def.people ?? [])]
            .filter((p) => p.id === "__any" || p.name.toLowerCase().includes(pQuery.toLowerCase()))
            .map((p) => {
              const isAny = p.id === "__any";
              const sel = value === p.name;
              return (
                <button
                  key={p.id}
                  onClick={() => onChange(p.name)}
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
    );
  }

  if (def.variant === "date") {
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          {def.options.map((o) => (
            <Pill key={o} active={value === o} label={o} onClick={() => onChange(o)} />
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
                if (e.target.value && to) onChange("Custom");
              }}
              className="min-w-0 flex-1 rounded-md border bg-card px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <span className="shrink-0 text-muted-foreground">–</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                if (from && e.target.value) onChange("Custom");
              }}
              className="min-w-0 flex-1 rounded-md border bg-card px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {def.options.map((o) => (
        <Pill key={o} active={value === o} label={o} onClick={() => onChange(o)} />
      ))}
    </div>
  );
}

// ── FacetBar (Mem-style) — a row of facet pills; each opens its own popover of values ──────────────
function FacetPill({
  def,
  value,
  onChange,
}: {
  def: FacetDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const active = value !== def.defaultValue;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] outline-none transition-colors data-[popup-open]:border-ring/50",
          active ? "border-primary/30 bg-primary/[0.05]" : "text-muted-foreground hover:bg-muted",
        )}
      >
        <def.icon className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
        <span className={cn("font-medium", active && "text-foreground")}>{def.label}</span>
        {active ? <span className="max-w-[7rem] truncate font-medium text-primary">· {value}</span> : null}
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <FacetValues def={def} value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

export function FacetBar({
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
  const activeCount = defs.filter((d) => values[d.key] !== d.defaultValue).length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {defs.map((d) => (
        <FacetPill key={d.key} def={d} value={values[d.key]} onChange={(v) => onChange(d.key, v)} />
      ))}
      {activeCount > 0 ? (
        <button
          onClick={onClear}
          className="ml-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}

