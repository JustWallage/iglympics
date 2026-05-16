# Project Context: Iglympics

Iglympics is a competition dashboard for tracking game scores, player ratings, and minigame high scores among a fixed group of 14 friends. It provides a real-time scoreboard, user profiles with peer ratings, an admin panel for match management, and a minigames arcade with per-game leaderboards.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Shadcn-style UI components, React Router, Lucide React icons
- **Backend**: Cloudflare Pages Functions (serverless API)
- **Database**: Cloudflare D1 (SQLite-compatible, Staging + Production)
- **Realtime**: Cloudflare Durable Objects with WebSockets (separate Worker)
- **IaC**: Terraform (state in R2 bucket) managing D1, Pages Project, Custom Domains
- **CI/CD**: GitHub Actions — Trunk-Based Development
- **E2E Testing**: Playwright
- **Package Manager**: pnpm

## Design System: Dark Glassmorphism

- **Theme**: Deep dark mode (`#0b0d17` background) with ambient gradient mesh (indigo/purple/sky radial gradients)
- **Glass Effects**: `backdrop-blur-lg`, semi-transparent backgrounds (`bg-white/[0.04]`), subtle 1px translucent borders (`border-white/[0.08]`)
- **Typography**: Inter font, white text at varying opacities (90%/55%/35%) for hierarchy
- **Accent**: Indigo (`#6366f1`) with glow effects for primary actions
- **Components**: Glassmorphic Card, Button, Input, Textarea, Select, Badge in `src/components/ui/`
- **Styling strategy**: Design baked into CSS theme (`src/index.css`) and UI component files — avoid cluttering page files with excessive utility classes

## Layout Constraints (Strictly Mobile-First)

- **No breakpoints**: Strictly mobile layout only — no `sm:`, `md:`, `lg:` responsive shifts
- **Desktop behavior**: App stays constrained to `max-w-md mx-auto min-h-dvh` centered on screen
- **Navigation**: Fixed glassmorphic **bottom tab navigation** bar — no top nav bar
- **Logout**: Located on the user's own Profile page (not in navigation)
- **Touch targets**: Minimum `h-10`/`h-12` for interactive elements, ample padding

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
- `functions/` — Cloudflare Pages Functions (file-based API routes)
- `functions/_middleware.ts` — Auth middleware
- `functions/_lib/` — Shared backend utilities (auth, crypto)
- `worker/do/` — Durable Object Worker (separate deployment)
- `migrations/` — D1 SQL migration files
- `iac/` — Terraform infrastructure definitions
- `e2e/` — Playwright E2E tests
- `.github/workflows/` — CI/CD pipeline

## Authentication

Custom JWT-based auth with D1-stored users. Passwords hashed via WebCrypto API (PBKDF2). Admin determined by `ADMIN_NAMES` env var (comma-separated list).

## Deployment Pipeline

1. Terraform provisions D1 databases and Pages project
2. DB IDs injected into `wrangler.toml` via template substitution
3. Staging migrations → Staging deploy → E2E tests → Prod migrations → Prod deploy

## API Conventions

- All API routes under `/api/*`
- Auth via HttpOnly JWT cookie
- JSON request/response bodies
- Admin routes check JWT name against `ADMIN_NAMES`

## Environment Bindings

- `DB` — D1 database binding
- `SCOREBOARD_DO` — Durable Object namespace binding
- `JWT_SECRET` — Secret for signing JWTs
- `ADMIN_NAMES` — Comma-separated names of admin users

Personality: Don't flatter me. Be helpful but very honest. Don't agree with mistakes. Call out potential misses using ❗️.

Rules:
First get enough context from the user before implementation, nothing can be unclear. You must use the `askQuestions` tool until all missing info is clear and all decisions are locked in.
Focus on readability. Short simple solution > verbosity. If in doubt about a code decision => use the `askQuestions` tool.
Barely add comments, unless crucial for understanding, preferably inline

After completing every response, you MUST call the `vscode_askQuestions` tool with the following question:

```json
{
  "questions": [
    {
      "header": "",
      "question": "Anything else?",
      "allowFreeformInput": true,
      "multiSelect": false
    }
  ]
}
```

Do this at the end of every response, without exception.
