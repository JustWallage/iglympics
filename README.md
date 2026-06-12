# 🏔️ Iglympics

A real-time competition dashboard built for a friends trip: 14 friends, one weekend, an unreasonable number of games, and exactly one way to settle who's the best — a live scoreboard with peer ratings, match voting, a public chat, and an arcade.

It started as a fun way to keep score. It ended as a full serverless production system with its own CI/CD pipeline, infrastructure-as-code, real-time WebSocket layer, and an AI narrator that roasts everyone's performance in a daily audio briefing.

## The part I'm most proud of

From the Friday the trip started, **every single change was made from my phone** — written by GitHub Copilot cloud agents, reviewed and merged from the GitHub mobile app, somewhere between activities. You can see it in the git history: the weekend commits are authored by `copilot-swe-agent[bot]`.

That only works if you trust your safety net. Every push to `main` deploys to a real staging environment, runs the full Playwright end-to-end suite (33 tests across 7 suites) against that **live deployment**, and only then promotes to production. So while I was making effectively blind edits from a phone, the pipeline kept proving the app still worked before any user-facing change went out. No green pipeline, no production deploy. That's the whole trick.

## Features

- 📊 **Live scoreboard** — match results and standings, updated in real time over WebSockets
- ⚔️ **Match submissions with peer voting** — anyone can submit a result; it's confirmed or rejected by configurable vote thresholds, with an admin panel as backstop
- ⭐ **Peer ratings** — rate your friends, leave notes, regret nothing
- 📅 **Schedule with time-gated reveals** — upcoming activities stay blurred behind a countdown and auto-reveal at their release time (enforced server-side, not just visually)
- 💬 **Public chat** — with cursor-based pagination and realtime delivery
- 🕹️ **Minigames arcade** — Snake and Flappy Bird with per-game leaderboards
- 🎵 **Music player** — a persistent mini-player, because every event needs a theme song
- 🤖 **AI daily summary** — Workers AI generates a sardonic recap of the day's results with Llama 3.1 8B, then turns it into an audio briefing with Deepgram Aura-2 text-to-speech
- 🔑 **Login links** — personal magic-link-style URLs for frictionless login, with credentials stripped from the URL immediately after use

The whole UI is strictly mobile-first (no breakpoints — desktop just gets a centered phone-width column) in a dark glassmorphism theme, since it was built to be used on phones around a campfire.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, shadcn-style components, React Router |
| API | Cloudflare Pages Functions (file-based routes, TypeScript strict) |
| Database | Cloudflare D1 (SQLite) — separate staging and production databases, SQL migrations |
| Realtime | Cloudflare Durable Object in a separate Worker, broadcasting over WebSockets |
| AI | Cloudflare Workers AI (Llama 3.1 8B + Deepgram Aura-2 TTS) |
| IaC | Terraform with remote state in Cloudflare R2 (S3-compatible backend) |
| CI/CD | GitHub Actions, trunk-based development |
| Testing | Playwright E2E against live staging deploys |

```
┌─────────────────────────────────────┐
│           Cloudflare Pages          │
│  ┌──────────┐   ┌────────────────┐  │
│  │  Static  │   │ Pages Functions│  │
│  │  (React) │   │  (API routes)  │  │
│  └──────────┘   └───────┬────────┘  │
│                         │           │
│  ┌───────────┐  ┌───────▼────────┐  │
│  │ Durable   │  │   D1 (SQLite)  │  │
│  │ Objects   │◄─┤  Staging/Prod  │  │
│  │ WebSocket │  └────────────────┘  │
│  └───────────┘                      │
└─────────────────────────────────────┘
```

## The pipeline

One workflow, triggered on every push to `main`, takes a commit all the way to production:

1. **Terraform apply** — provisions the D1 databases, the Pages project, and the custom domain. State lives in an R2 bucket via the S3-compatible backend, so the whole thing is reproducible from scratch with zero AWS involvement.
2. **Config templating** — the freshly provisioned database IDs are read from Terraform outputs and substituted into `wrangler.toml` from a template, so no environment IDs are ever committed.
3. **Durable Object Worker deploy** — the realtime Worker ships independently of the Pages app.
4. **Staging** — migrations run against the staging D1, the app deploys to a staging branch, and the database is seeded with test users.
5. **E2E gate** — Playwright runs the full suite against the actual staging URL. Real network, real D1, real Durable Object, real auth cookies. Not a mock in sight.
6. **Production** — only if the suite passes: prod migrations, prod deploy, prod seed.

Secrets (JWT signing key, user credentials, admin list) live exclusively in GitHub Actions secrets and are pushed to Cloudflare as encrypted environment secrets at deploy time. Staging gets a separate set of test credentials, and the destructive `/api/test/reset` endpoint used by the test suite is enabled by an environment flag that only ever gets set on staging.

## Realtime with Durable Objects

D1 has no change feeds, so realtime comes from a single Durable Object (`ScoreboardDO`) running in its own Worker. Clients open a WebSocket through the Pages API, which forwards the upgrade to the DO; API routes that mutate state (a new match, a chat message, a vote) ping the DO, which broadcasts a typed event to every connected socket. The React side wraps this in a `WebSocketContext` with automatic reconnection, and pages subscribe to just the event types they care about. The DO binding is deliberately optional — local dev and the app itself work fine without it, realtime just degrades to refresh.

## Auth

No auth provider — it's a 14-user app, so auth is hand-rolled on the Web Crypto API and small enough to audit in one sitting: PBKDF2 password hashing (100k iterations, per-user salt), HS256 JWTs minted and verified with `crypto.subtle`, delivered as `HttpOnly` / `Secure` / `SameSite` cookies. A middleware guards all API routes, with an explicit allowlist of public read-only endpoints, and admin-only routes check the JWT identity against an `ADMIN_NAMES` environment variable.

## Running it locally

```bash
pnpm install
cp .dev.vars.example .dev.vars   # local-only secrets, gitignored
pnpm dev:pages                   # applies D1 migrations locally + serves app & API
pnpm test:e2e                    # Playwright suite (or point E2E_BASE_URL at any deploy)
```

## Repo archaeology

- `stories/` is a lightweight kanban of markdown stories (`1_todo` → `4_done`) that doubled as prompts for AI agents.
- `.github/copilot-instructions.md` is the project brief the Copilot cloud agents worked from during the trip — the architecture and design-system constraints that kept phone-driven changes coherent.
- `.agents/skills/` are vendored agent skills, pinned in `skills-lock.json`.

Built in evenings over a few weeks, finished from a tent. The friends are still arguing about the ratings.
