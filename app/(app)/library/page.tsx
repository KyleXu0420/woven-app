"use client";

import * as React from "react";
import Link from "next/link";
import { SlidersHorizontal, MoreHorizontal, ArrowUpRight, Link2, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterChips } from "@/components/controls";
import { TypeBadge, StatusPill } from "@/components/artifact-ui";
import { notify } from "@/lib/notifications";
import { listArtifacts, listCollections, primaryCollection, relationCount } from "@/lib/api";
import type { Artifact } from "@/lib/types";

const TYPE = ["All", "HTML", "MD", "DOC"];
const STATE = ["All", "Living", "Processing"];
const SORT = ["Recent", "Name", "Most linked"];

type Facets = { type: string; state: string; collection: string };
const EMPTY: Facets = { type: "All", state: "All", collection: "All" };

// an applied filter — neutral, removable; sits right above the list so filter ↔ list stay one piece
function Applied({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-1 pl-2.5 text-xs font-medium">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

// a labelled facet group inside the filter popover
function Group({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <FilterChips options={options} value={value} onChange={onChange} />
    </div>
  );
}

function Row({ a }: { a: Artifact }) {
  const co = primaryCollection(a.id);
  function copyLink() {
    navigator.clipboard?.writeText(`woven.dev/a/${a.id}`).catch(() => {});
    notify.success("Link copied", { description: a.title });
  }
  return (
    <div className="group relative border-t transition-colors first:border-t-0 hover:bg-foreground/[0.025]">
      <Link
        href={`/artifact/${a.id}`}
        className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[3.5rem_1fr_7rem_4.5rem]"
      >
        <TypeBadge type={a.type} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{a.title}</div>
          {co ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: co.color }} />
              <span className="truncate">{co.name}</span>
            </div>
          ) : null}
        </div>
        <div className="hidden sm:block">
          <StatusPill state={a.state} />
        </div>
        <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground transition-opacity group-hover:opacity-0">
          {a.updated}
        </span>
      </Link>

      <div className="absolute top-1/2 right-2.5 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground data-[popup-open]:bg-foreground/[0.06] data-[popup-open]:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="w-44">
            <DropdownMenuItem render={<Link href={`/artifact/${a.id}`} />} className="gap-2">
              <ArrowUpRight className="size-4 text-muted-foreground" /> Open artifact
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={copyLink}>
              <Link2 className="size-4 text-muted-foreground" /> Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [facets, setFacets] = React.useState<Facets>(EMPTY);
  const [sort, setSort] = React.useState("Recent");

  const all = listArtifacts();
  const collections = listCollections();
  const collectionOpts = ["All", ...collections.map((c) => c.name)];
  const set = (k: keyof Facets) => (v: string) => setFacets((f) => ({ ...f, [k]: v }));

  const filtered = all.filter((a) => {
    if (facets.type !== "All" && a.type !== facets.type) return false;
    if (facets.state !== "All" && a.state !== facets.state.toLowerCase()) return false;
    if (facets.collection !== "All") {
      const co = collections.find((c) => c.name === facets.collection);
      if (!co || !a.collection_ids.includes(co.id)) return false;
    }
    return true;
  });
  const shown = [...filtered];
  if (sort === "Name") shown.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "Most linked") shown.sort((a, b) => relationCount(b.id) - relationCount(a.id));

  // applied = the facets beyond Type (Type stays visible as the persistent row, so it isn't a pill)
  const applied: { k: keyof Facets; label: string; value: string }[] = [];
  if (facets.collection !== "All") applied.push({ k: "collection", label: "Collection", value: facets.collection });
  if (facets.state !== "All") applied.push({ k: "state", label: "State", value: facets.state });
  const advancedCount = applied.length + (sort !== "Recent" ? 1 : 0);
  const hidden = all.length - shown.length;

  return (
    <div className="mx-auto w-full max-w-5xl p-8 sm:p-10">
      <h1 className="font-serif text-3xl font-medium tracking-[-0.01em]">Library</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{all.length}</span> artifacts ·{" "}
        {collections.length} collections
      </p>

      {/* L1 — persistent Type chips (high-frequency) + the call-out Filter button */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <FilterChips options={TYPE} value={facets.type} onChange={set("type")} />
        <Popover>
          <PopoverTrigger className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.8rem] font-medium outline-none transition-colors hover:bg-muted data-[popup-open]:bg-secondary data-[popup-open]:text-foreground">
            <SlidersHorizontal className="size-3.5" /> Filter
            {advancedCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[10px] font-semibold tabular-nums">
                {advancedCount}
              </span>
            ) : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-72 flex-col gap-3">
            <Group label="Collection" options={collectionOpts} value={facets.collection} onChange={set("collection")} />
            <Group label="State" options={STATE} value={facets.state} onChange={set("state")} />
            <Group label="Sort by" options={SORT} value={sort} onChange={setSort} />
          </PopoverContent>
        </Popover>
      </div>

      {/* L2 — applied filter pills, glued to the top of the list (the filter ↔ list link) */}
      {applied.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {applied.map((f) => (
            <Applied key={f.k} label={f.label} value={f.value} onRemove={() => set(f.k)("All")} />
          ))}
          <span className="ml-0.5 text-xs tabular-nums text-muted-foreground">{hidden} hidden</span>
          <button
            onClick={() => setFacets(EMPTY)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        {shown.length > 0 ? (
          shown.map((a) => <Row key={a.id} a={a} />)
        ) : (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No artifacts match these filters.
          </p>
        )}
      </div>
    </div>
  );
}
