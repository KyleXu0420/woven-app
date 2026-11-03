# Woven

Woven is trusted operational memory for complex cross-functional work. It keeps the exact evidence behind a decision, who authorized it, whether it took effect, and what later replaced it.

This repo is a prototype. It runs on an in-memory typed graph: `lib/data.ts` is the seed and `lib/api.ts` is the only way to read or change it. There is no backend, database or real auth, and state stays in the browser. Ask answers are deterministic templates.

Live: https://woven-app-phi.vercel.app

## Run

```bash
pnpm install
pnpm dev                                          # http://localhost:3000
npx tsc --noEmit
node --test tests/*.test.mjs scripts/*.test.mjs   # needs Node 23.6 or newer
pnpm build
```

Every push to `main` deploys to production on Vercel.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn on Base UI, lucide-react, Geist.

## Working here

Read `AGENTS.md`. It has the gates, the hard rules and the map. `docs/README.md` indexes the rest.
