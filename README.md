# Woven

**The agent-first home for AI artifacts.** Drop an artifact — an AI-generated HTML page, a Markdown note, a doc — and Woven weaves it into your team's typed knowledge graph: extracted, linked, and made findable, readable, and trustworthy.

> Prototype. The whole app runs on an in-memory typed graph (`lib/data.ts` → `lib/api.ts`); swap the accessor layer for real `fetch()` calls to go live.

## What's inside

- **Today / Library** — your living artifacts at a glance.
- **Artifact reader** — an immersive reading surface with a `Read · Edit` mode switch. Edit is Google-Docs-style direct editing (with an autosave status) plus a selection-aware *chatdoc* bar that hands scoped edits to the agent; every agent-proposed change is reviewed inline — the trust valve.
- **Unified search** (`⌘K` · `/`) — one bar, two intents: **Ask** (a cited answer synthesized over the graph) and **Find** (focus any entity and re-center its neighborhood).
- **Knowledge graph** — People · Topics · Team, drawn as force-directed neighborhoods (never a global star-map).
- **Collections** — group related artifacts; *smart* collections let the agent propose members into your **Inbox**, where you confirm or dismiss (the same valve as proposed links, duplicates, naming, and archive decisions).

## Stack

Next.js 16 (App Router · Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · shadcn on Base UI · lucide-react.
Type voice: Fraunces (reading) · Geist (UI) · Geist Mono (agent) · Playfair Display (marketing).

## Develop

```bash
pnpm install
pnpm dev      # Next dev server
pnpm build    # production build
```

## Deploy

Hosted on Vercel — every push to `main` auto-deploys to production.
