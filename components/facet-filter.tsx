"use client";

import * as React from "react";
import { ChevronDown, Search, Check, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { PersonAvatar } from "./identity";

// A facet the filter can drill into. Every facet renders the SAME searchable, multi-select LIST (the People
// picker's logic, unified) — an option carries an optional leading glyph (a collection colour, a person). The
// `defaultValue` is the "no filter" row (All / Any); an empty selection means that. `date` keeps its own
// preset + custom-range picker. `multi` toggles many; a single-select facet (sort) replaces.
export type FacetOption = { value: string; color?: string; personId?: string };
export type FacetDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  options: FacetOption[];
  defaultValue: string;
  multi?: boolean;
  searchable?: boolean;
  variant?: "date";
};

// one selectable row — leading glyph (collection dot · person avatar · a neutral dot for the All/Any row) +
// label + a check when selected. The same row used by every facet, so the filters read as one system.
function OptionRow({
  option,
  selected,
  onClick,
}: {
  option: { value: string; color?: string; personId?: string; neutral?: boolean };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] transition-colors hover:bg-foreground/[0.04]",
        selected && "bg-foreground/[0.04]",
      )}
    >
      {option.color ? (
        <span className="size-3 shrink-0 rounded-[3px]" style={{ background: option.color }} />
      ) : option.personId ? (
        <PersonAvatar seed={option.personId} name={option.value} size="xs" />
      ) : (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {option.neutral ? "·" : null}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{option.value}</span>
      {selected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
    </button>
  );
}

// the value picker for one facet — a searchable, multi-select LIST; `date` keeps preset rows + a custom range.
function FacetValues({ def, value, onChange }: { def: FacetDef; value: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  if (def.variant === "date") {
    return (
      <div>
        <div className="flex flex-col">
          <OptionRow option={{ value: def.defaultValue, neutral: true }} selected={value.length === 0} onClick={() => onChange([])} />
          {def.options.map((o) => (
            <OptionRow key={o.value} option={{ value: o.value, neutral: true }} selected={value[0] === o.value} onClick={() => onChange([o.value])} />
          ))}
        </div>
        <div className="mt-2 border-t pt-2">
          <p className="mb-1.5 px-1 text-[12px] text-muted-foreground">Custom range</p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); if (e.target.value && to) onChange(["Custom"]); }}
              className="min-w-0 flex-1 rounded-md border bg-card px-2 py-1 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <span className="shrink-0 text-muted-foreground">–</span>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); if (from && e.target.value) onChange(["Custom"]); }}
              className="min-w-0 flex-1 rounded-md border bg-card px-2 py-1 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </div>
      </div>
    );
  }

  const multi = !!def.multi;
  const shown = def.searchable ? def.options.filter((o) => o.value.toLowerCase().includes(query.toLowerCase())) : def.options;

  function pick(v: string) {
    if (!multi) onChange([v]);
    else onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <div>
      {def.searchable ? (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${def.label.toLowerCase()}…`}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      ) : null}
      <div className={cn("flex flex-col", def.searchable && "scrollbar-subtle max-h-52 overflow-y-auto")}>
        <OptionRow option={{ value: def.defaultValue, neutral: true }} selected={value.length === 0} onClick={() => onChange([])} />
        {shown.map((o) => (
          <OptionRow key={o.value} option={o} selected={value.includes(o.value)} onClick={() => pick(o.value)} />
        ))}
      </div>
    </div>
  );
}

// the "no filter" default is never a selection (an empty array); a facet is active when it holds any value that
// isn't just its own default (sort's ["Recent"]).
function isActive(def: FacetDef, value: string[]): boolean {
  return value.length > 0 && !(value.length === 1 && value[0] === def.defaultValue);
}

function FacetPill({ def, value, onChange }: { def: FacetDef; value: string[]; onChange: (v: string[]) => void }) {
  const active = isActive(def, value);
  const summary = !active ? null : value.length === 1 ? `· ${value[0]}` : `· ${value.length}`;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[14px] outline-none transition-colors data-[popup-open]:border-ring/50",
          active ? "border-primary/30 bg-primary/[0.05]" : "text-muted-foreground hover:bg-muted",
        )}
      >
        <def.icon className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
        <span className={cn("font-medium", active && "text-foreground")}>{def.label}</span>
        {summary ? <span className="max-w-[7rem] truncate font-medium text-primary">{summary}</span> : null}
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
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
  values: Record<string, string[]>;
  onChange: (key: string, value: string[]) => void;
  onClear: () => void;
}) {
  const activeCount = defs.filter((d) => isActive(d, values[d.key] ?? [])).length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {defs.map((d) => (
        <FacetPill key={d.key} def={d} value={values[d.key] ?? []} onChange={(v) => onChange(d.key, v)} />
      ))}
      {activeCount > 0 ? (
        <button
          onClick={onClear}
          className="ml-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" /> Clear all
        </button>
      ) : null}
    </div>
  );
}
