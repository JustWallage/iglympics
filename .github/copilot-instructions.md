# Project Context: Iglympics

Iglympics is a competition dashboard for tracking game scores and player ratings among a fixed group of 14 friends. It provides a real-time scoreboard, user profiles with peer ratings, and an admin panel for match management.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Shadcn UI, React Router
- **Backend**: Cloudflare Pages Functions (serverless API)
- **Database**: Cloudflare D1 (SQLite-compatible, Staging + Production)
- **Realtime**: Cloudflare Durable Objects with WebSockets (separate Worker)
- **IaC**: Terraform (state in R2 bucket) managing D1, Pages Project, Custom Domains
- **CI/CD**: GitHub Actions — Trunk-Based Development
- **E2E Testing**: Playwright
- **Package Manager**: pnpm

## Architecture

```
┌─────────────────────────────────────┐
│           Cloudflare Pages          │
│  ┌──────────┐   ┌────────────────┐  │
│  │  Static  │   │ Pages Functions│  │
│  │  (React) │   │  (API routes)  │  │
│  └──────────┘   └───────┬────────┘  │
│                         │           │
│  ┌───────────┐  ┌───────▼────────┐  │
│  │ Durable   │  │    D1 (SQLite) │  │
│  │ Objects   │◄─┤  Staging/Prod  │  │
│  │ WebSocket │  └────────────────┘  │
│  └───────────┘                      │
└─────────────────────────────────────┘
```

## Key Directories

- `src/` — React frontend code
- `src/components/ui/` — Shadcn-style UI primitives (Card, Button, Input, etc.)
- `functions/` — Cloudflare Pages Functions (file-based API routes)
- `functions/api/_middleware.ts` — Auth middleware (scoped to /api/ routes)
- `functions/_lib/` — Shared backend utilities (auth, crypto)
- `worker/do/` — Durable Object Worker (separate deployment)
- `migrations/` — D1 SQL migration files
- `iac/` — Terraform infrastructure definitions
- `e2e/` — Playwright E2E tests
- `.github/workflows/` — CI/CD pipeline

## Design System: Cyber-Brutalist

A "Cyber-Brutalist" aesthetic—dark mode baseline with neon accents, neobrutalist hard borders and shadows, retro arcade typography.

### Typography

- **Headings**: `Press Start 2P` (Google Fonts) — for all h1-h6, large numbers, titles
- **Body**: `Space Mono` (Google Fonts) — for body text, labels, UI elements

### Color Palette (CSS custom properties in `src/index.css`)

- `--color-bg`: #0a0a0a (pure black background)
- `--color-bg-card`: #141414, `--color-bg-elevated`: #1a1a1a
- `--color-neon-pink`: #ff2d78, `--color-neon-green`: #39ff14
- `--color-neon-cyan`: #00f0ff, `--color-neon-yellow`: #ffe600
- `--color-win`/`--color-loss`/`--color-tie` map to green/pink/yellow

### Neobrutalist Rules

- Border radius: subtle rounding (`rounded-lg` for cards, `rounded-md` for buttons/inputs, `rounded-sm` for badges)
- Thick borders: 2px solid white or neon
- Hard shadows (unblurred): `4px 4px 0px 0px var(--color-neon-*)`
- Button active state: `translate(2px, 2px)` + remove shadow ("press into")

### Architecture Rule

Styles are centralized in Shadcn UI components (`src/components/ui/`) and `src/index.css`. Do NOT litter React pages with massive utility class strings. Use the UI primitives: `Card`, `Button`, `Input`, `Textarea`, `Select`, `Badge`.

### Layout

- Mobile-first with bottom tab navigation (`sm:hidden` for mobile tabs)
- Desktop: top nav bar with links
- Scoreboard and profiles are public (no login required)
- Login via modal overlay, triggered from nav "Login" button or "Login to rate" on profiles

## Authentication

Custom JWT-based auth with D1-stored users. Passwords hashed via WebCrypto API (PBKDF2). Admin determined by `ADMIN_NAME` env var.

## Deployment Pipeline

1. Terraform provisions D1 databases and Pages project
2. DB IDs injected into `wrangler.toml` via template substitution
3. Staging migrations → Staging deploy → E2E tests → Prod migrations → Prod deploy

## API Conventions

- All API routes under `/api/*`
- Auth via HttpOnly JWT cookie
- JSON request/response bodies
- Admin routes check JWT name against `ADMIN_NAME`

## Environment Bindings

- `DB` — D1 database binding
- `SCOREBOARD_DO` — Durable Object namespace binding
- `JWT_SECRET` — Secret for signing JWTs
- `ADMIN_NAME` — Name of the admin user

Your goal is to get enough context from the user before implementation, nothing can be still unclear. If anything is unclear or yet undecided you must use the `askQuestions` tool to confirm the missing pieces.

Additional rules:

- You must keep this document up to date, but only with the broad context of the project. Do not include specific implementation details. Only when significant changes/additions to the project context/stack occur, you must update this document.
- Any change that involves added/changed funcionality/logic must include e2e tests

YOU MUST END ALL RESPONSES WITH EXECUTING THE FOLLOWING COMMAND:

```sh
pnpm check && echo Done
```
