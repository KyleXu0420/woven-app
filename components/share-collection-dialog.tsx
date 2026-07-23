"use client";

import * as React from "react";
import { Globe, Check, Copy, Link as LinkIcon, Search, ChevronDown, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypeBadge } from "@/components/artifact-ui";
import { PersonAvatar } from "@/components/identity";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { publishCollection, listPeople, type Visibility } from "@/lib/api";
import type { ArtifactType } from "@/lib/types";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ── One access ladder (see the permission-share model): sharing and publishing are the same spectrum.
// "People & access" is the internal half of the ladder (invite + role); "Publish to web" is the top rung.
// Members are mock for now — later they lift into Space.members[{personId, role}]. ──
type Role = "viewer" | "commenter" | "editor";
const ROLE_LABEL: Record<Role, string> = {
  viewer: "Can view",
  commenter: "Can comment",
  editor: "Can edit",
};
const ROLES: Role[] = ["viewer", "commenter", "editor"];

type General = "none" | Role;
const GENERAL_LABEL: Record<General, string> = { none: "No access", ...ROLE_LABEL };
const GENERALS: General[] = ["none", "viewer", "commenter", "editor"];

type Grantee = { personId: string; role: Role };
const VIEWER_ID = "pe_maya"; // the signed-in account (mock)
const ORG_NAME = "Acme · Product";

type Member = { id: string; title: string; type: ArtifactType; pub: boolean };

// a small toggle — no Switch primitive in the kit yet
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
        on ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// a role picker used for both grantees and general access
function RolePicker<T extends string>({
  value,
  options,
  labels,
  onChange,
  onRemove,
}: {
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  onRemove?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group/role flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[14px] text-muted-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40 data-[popup-open]:bg-muted/60">
        {labels[value]}
        <ChevronDown className="size-3.5 transition-transform group-data-[popup-open]/role:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {options.map((o) => (
          <DropdownMenuItem key={o} onClick={() => onChange(o)}>
            <span className="flex-1">{labels[o]}</span>
            {value === o ? <Check className="size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        {onRemove ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              Remove
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ShareCollectionDialog({
  name = "Q4 Roadmap",
  slug = "q4-roadmap",
  members = [],
  onPublished,
}: { name?: string; slug?: string; members?: Member[]; onPublished?: () => void } = {}) {
  const hubUrl = `woven.dev/c/${slug}`;
  const people = React.useMemo(() => listPeople(), []);
  const personById = React.useCallback((id: string) => people.find((p) => p.id === id), [people]);

  const [open, setOpen] = React.useState(false);

  // ── People & access (mock seed) ──
  const [general, setGeneral] = React.useState<General>("viewer");
  const [grantees, setGrantees] = React.useState<Grantee[]>([
    { personId: "pe_dan", role: "editor" },
    { personId: "pe_jordan", role: "viewer" },
  ]);
  const [invite, setInvite] = React.useState("");
  const grantedIds = new Set([VIEWER_ID, ...grantees.map((g) => g.personId)]);
  const iq = invite.trim().toLowerCase();
  const inviteMatches = iq
    ? people.filter((p) => !grantedIds.has(p.id) && p.name.toLowerCase().includes(iq)).slice(0, 4)
    : [];
  function addGrantee(id: string) {
    setGrantees((gs) => [...gs, { personId: id, role: "viewer" }]);
    setInvite("");
  }

  // ── Publish to web (reuses the existing publish flow + the polished per-artifact selector) ──
  const anyPublic = members.some((m) => m.pub);
  const [webOn, setWebOn] = React.useState(anyPublic);
  const [pub, setPub] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(members.map((m) => [m.id, anyPublic ? m.pub : true])),
  );
  const [pquery, setPquery] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveCount = Object.values(pub).filter(Boolean).length;
  const allSelected = members.length > 0 && liveCount === members.length;
  const pq = pquery.trim().toLowerCase();
  const shown = pq ? members.filter((m) => m.title.toLowerCase().includes(pq)) : members;
  function toggleAll() {
    const next = !allSelected;
    setPub(Object.fromEntries(members.map((m) => [m.id, next])));
  }

  function toggleWeb(next: boolean) {
    setWebOn(next);
    if (next) {
      publishCollection(
        slug,
        members.filter((m) => pub[m.id]).map((m) => m.id),
        "public" as Visibility,
      );
      onPublished?.();
    }
    // toggle-off: the prototype keeps the selection; a real backend would unpublish here
  }

  function copy() {
    navigator.clipboard?.writeText(`https://${hubUrl}`).catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setInvite("");
      setPquery("");
      setCopied(false);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        {webOn ? <Globe /> : <Users2 />} Share
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share {name}</DialogTitle>
          <DialogDescription>
            From a private draft to a public hub — one ladder. Invite people, or publish to the web.
          </DialogDescription>
        </DialogHeader>

        {/* ── People & access — the internal half of the ladder ── */}
        <div className="flex flex-col gap-1">
          {/* invite */}
          <div className="relative mb-1">
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="Add people or teams…"
              className="w-full rounded-lg border bg-card px-3 py-2 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {inviteMatches.length ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover p-1 shadow-md">
                {inviteMatches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addGrantee(p.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <PersonAvatar seed={p.id} name={p.name} size="sm" />
                    <span className="flex-1 truncate text-[15px]">{p.name}</span>
                    <span className="text-[12px] text-muted-foreground">{p.role}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* general access — the org / space rung */}
          <div className="flex items-center gap-2.5 px-1 py-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users2 className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Everyone at {ORG_NAME}</span>
              <span className="block text-[13px] text-muted-foreground">
                {general === "none" ? "Only invited people can open it" : "Space members — the default"}
              </span>
            </span>
            <RolePicker value={general} options={GENERALS} labels={GENERAL_LABEL} onChange={setGeneral} />
          </div>

          {/* you + grantees */}
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <PersonAvatar seed={VIEWER_ID} name="Maya Chen" size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">
                {personById(VIEWER_ID)?.name ?? "You"}{" "}
                <span className="font-normal text-muted-foreground">(you)</span>
              </span>
              <span className="block text-[13px] text-muted-foreground">maya@acme.com</span>
            </span>
            <span className="shrink-0 px-2 text-[14px] text-muted-foreground">Owner</span>
          </div>
          {grantees.map((g) => {
            const p = personById(g.personId);
            if (!p) return null;
            return (
              <div key={g.personId} className="flex items-center gap-2.5 px-1 py-1.5">
                <PersonAvatar seed={p.id} name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{p.name}</span>
                  <span className="block text-[13px] text-muted-foreground">{p.role}</span>
                </span>
                <RolePicker
                  value={g.role}
                  options={ROLES}
                  labels={ROLE_LABEL}
                  onChange={(r) =>
                    setGrantees((gs) => gs.map((x) => (x.personId === g.personId ? { ...x, role: r } : x)))
                  }
                  onRemove={() => setGrantees((gs) => gs.filter((x) => x.personId !== g.personId))}
                />
              </div>
            );
          })}
        </div>

        {/* ── Publish to web — the top rung ── */}
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                webOn ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              <Globe className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Publish to web</span>
              <span className="block text-[13px] text-muted-foreground">
                {webOn ? "Discoverable · read-tracked" : "A public, read-tracked hub"}
              </span>
            </span>
            <Switch on={webOn} onChange={toggleWeb} label="Publish to web" />
          </div>

          {webOn ? (
            <div className="mt-3 flex flex-col gap-3">
              {/* url */}
              <div className="flex items-center gap-2 rounded-lg border bg-card p-2 pl-3">
                <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-mono text-[13px]">{hubUrl}</span>
                <Button size="xs" variant={copied ? "outline" : "secondary"} onClick={copy}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              {/* which artifacts go public */}
              {members.length > 0 ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[15px] font-medium">In the public hub</p>
                    <div className="flex items-center gap-2.5 text-[13px]">
                      <span className="text-muted-foreground">
                        {liveCount} of {members.length}
                      </span>
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="font-medium text-primary transition-opacity hover:opacity-80"
                      >
                        {allSelected ? "Clear all" : "Select all"}
                      </button>
                    </div>
                  </div>
                  {members.length > 8 ? (
                    <div className="relative mb-1.5">
                      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={pquery}
                        onChange={(e) => setPquery(e.target.value)}
                        placeholder="Filter artifacts…"
                        className="w-full rounded-lg border bg-card py-1.5 pr-2.5 pl-8 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                      />
                    </div>
                  ) : null}
                  <div className="scrollbar-subtle -mr-1 flex max-h-44 flex-col overflow-y-auto pr-1">
                    {shown.map((m) => {
                      const on = pub[m.id];
                      return (
                        <button
                          key={m.id}
                          onClick={() => setPub((p) => ({ ...p, [m.id]: !p[m.id] }))}
                          className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.03]"
                        >
                          <span
                            className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                              on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                            }`}
                          >
                            {on ? <Check className="size-3" /> : null}
                          </span>
                          <TypeBadge type={m.type} />
                          <span className={`flex-1 truncate text-[15px] ${on ? "" : "text-muted-foreground"}`}>
                            {m.title}
                          </span>
                        </button>
                      );
                    })}
                    {shown.length === 0 ? (
                      <p className="px-1.5 py-6 text-center text-[13px] text-muted-foreground">
                        No artifacts match “{pquery}”.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Done</Button>} />
          {webOn ? (
            <Button nativeButton={false} render={<a href={`/c/${slug}`} target="_blank" rel="noopener noreferrer" />}>
              <Globe /> View hub
            </Button>
          ) : (
            <Button onClick={() => toggleWeb(true)}>
              <Globe /> Publish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
