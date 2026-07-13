"use client";

import * as React from "react";

// One control vocabulary, shared across pages — each role has a distinct look so they
// never blend on the same page:
//   ① ViewTabs    — page-level view switch (underline, forest accent) = PRIMARY
//   ② SegToggle   — in-view secondary switch (segmented pill, neutral)  = SECONDARY
//   ③ FilterChips — facet filter (free rounded-full pills, neutral)

type Opt = { id: string; label: string };

// ① page-level view tabs — underline indicator, the brand accent marks the primary level
export function ViewTabs({
  options,
  value,
  onChange,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-5 border-b">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`relative py-2.5 text-[15px] font-medium transition-colors ${
            value === o.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
          {value === o.id ? (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

// ② in-view secondary toggle — segmented pill, neutral active (subordinate to the tabs)
export function SegToggle({
  options,
  value,
  onChange,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
            value === o.id
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ③ facet filter — free rounded-full chips, neutral active
export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((x) => (
        <button
          key={x}
          onClick={() => onChange(x)}
          className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
            value === x
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.04]"
          }`}
        >
          {x}
        </button>
      ))}
    </div>
  );
}
