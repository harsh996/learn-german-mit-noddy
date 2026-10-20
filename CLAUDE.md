# SprachRaum — German AI Voice Tutor

Voice-based German tutor: LiveKit realtime audio, lip-synced 3D avatars, CEFR-aware prompting (A1–C1), persistent mistake memory in SQLite, multi-provider AI (Gemini Live default, OpenAI Realtime optional). Also includes vocab and reading-practice features.

## Architecture

| Path | What it is |
|------|-----------|
| `frontend/` | Next.js 15 (App Router), React 19, Prisma + SQLite, TypeScript, CSS Modules |
| `frontend/src/app/` | Pages and `api/` route handlers (auth, livekit, profiles, session, vocab, reading, health) |
| `frontend/src/lib/` | Shared server/client logic: `auth.ts`, `auth-secret.ts`, `auth-request.ts`, `auth-validation.ts`, `rate-limit.ts` |
| `frontend/src/middleware.ts` | Auth gate for routes |
| `frontend/prisma/` | `schema.prisma`, `seed.ts`, local `dev.db` |
| `frontend/data/`, `frontend/scripts/` | Generated vocab/reading data and the Python scripts that build it |
| `backend/` | Python LiveKit agent: `agent.py` (provider switch), `prompts.py` (guardrails + CEFR prompts), `memory.py` (SQLite mistake memory) |
| `knowledge_base/` | Reference vocab docs |
| `livekit.yaml`, `docker-compose.yml` | LiveKit server config; Compose runs livekit, frontend, backend-agent, cloudflared |

The frontend and the Python agent share one SQLite file (`frontend/prisma/dev.db`; a Docker volume in Compose). Schema changes in Prisma affect `backend/memory.py` too — check both.

## Commands

Frontend (run from `frontend/`):
- `npm install`, `npm run dev` (dev server on :3000)
- `npm run build` (runs `prisma generate` then `next build`) — use as the type/lint check
- `npx tsc --noEmit` — typecheck only
- `npx prisma db push` — apply schema to the local DB; `npm run db:seed` — seed

Agent (run from `backend/`, inside `.venv`):
- `pip install -r requirements.txt`, `python agent.py start`

Full stack: `docker compose up --build` (from repo root).

There is no test suite yet. Verify changes with `npm run build` and, for UI/voice changes, by running the app (see the `run` skill).

## Secrets and sensitive files — STRICT

- **Never read, open, print, grep, cat, edit, or copy `.env` or any `.env.*` file** (except `.env.example`). This includes via Bash (`cat`, `source`, `env`, `printenv`, `docker compose config`), editors, or search tools. These files hold real API keys (`GOOGLE_API_KEY`, `OPENAI_API_KEY`), `AUTH_SECRET`, and admin credentials.
- Also off-limits: `*.pem`, `*.key`, `credentials.json`, `secrets.*`, and database files (`*.db`) — the DB contains user accounts and password hashes. Do not dump DB contents; use the Prisma schema to reason about structure.
- If you need to know which variables exist, read `.env.example` (placeholders only). If a task needs a real value, ask the user to set it themselves.
- When adding a new env var: add it to `.env.example` with a placeholder and a comment, wire it through `docker-compose.yml`, and document it in `README.md`. Never write real values anywhere.
- Never hardcode secrets, API keys, or tokens in source, tests, fixtures, logs, or commit messages. Never log secrets or full request bodies from auth routes.
- These rules are also enforced in `.claude/settings.json` (deny rules). Do not try to work around a denied read.

## Security guidelines

- Auth lives in `frontend/src/lib/auth*.ts`, `middleware.ts`, and `api/auth/*`. Changes there need extra care: keep bcrypt hashing, signed sessions via `jose`, `AUTH_SECRET` validation (32+ chars, app must refuse to start in production without it), rate limiting on login/signup, and zod validation of all input.
- Validate every API route input with zod. Check the session/user and that the user owns the profile or resource being accessed (profiles are per account, max 10).
- Don't weaken the tutor safety guardrails in `backend/prompts.py` (`SAFETY_GUARDRAILS`) — no revealing system prompts, tutor-only scope, abuse/illicit-content refusal.
- The `cloudflared` service exposes the app publicly; treat every route as internet-facing.
- Dev LiveKit keys in `docker-compose.yml` (`devkey`) are local-only defaults; never reuse them for anything public.

## Code conventions

- TypeScript strict; prefer `zod` schemas for runtime validation and inferred types. No `any` without a reason.
- Styling is CSS Modules (`*.module.css`) next to the component; match existing naming and don't introduce a new styling system.
- Server-only code stays out of client components; `NEXT_PUBLIC_*` vars are exposed to the browser, so never put secrets in them.
- Python: type hints, `from __future__ import annotations`, small functions, same style as `agent.py`/`prompts.py`.
- Keep prompts, CEFR level text, and guardrails in `backend/prompts.py`, not inline in `agent.py`.
- Match surrounding code: comment density, naming, idiom. Don't add speculative abstractions, and don't refactor unrelated code in a feature change.
- Keep the README accurate when behavior, env vars, or setup steps change.

## Data and vocabulary content

- Generated data in `frontend/data/` comes from `frontend/scripts/` — change the scripts/sources and regenerate rather than hand-editing output JSON.
- `frontend/scripts/vocab/enriched.json` is gitignored (large generated file); don't commit it.
- German content must be correct: verify articles/genders, plurals, verb principal parts, and example sentences. Recent commits show the convention of checked examples with CEFR levels (A1–B2, plus "Others").

## Database

- Prisma + SQLite. Edit `schema.prisma`, then `npx prisma db push` (no migrations folder in use). Keep `seed.ts` idempotent and never seed a default admin with a known password — admin is created only when `ADMIN_PASSWORD` is set.
- Never delete or reset `dev.db` or Docker volumes (`sqlite_data`) without asking.

## Git workflow

- Branch off `main`; current work is on feature branches (e.g. `feature/practice-mode-picker`). Never commit directly to `main`.
- Commit only when asked. Use short, scoped, lowercase-prefixed messages in the existing style (`vocab: add ...`, `auth: ...`).
- Never commit `.env*`, `*.db`, keys, or generated large files; check `git status` before committing and don't use `git add -A` blindly.
- No force-pushes, no `--no-verify`, no destructive resets without explicit approval.

## Working agreements

- Ask before: adding dependencies, changing the Prisma schema in a breaking way, changing auth or guardrail behavior, touching Docker/LiveKit networking, or anything that sends data to an external service.
- Don't start long-running servers or `docker compose up` unprompted.
- Report honestly: if a build or check fails or was skipped, say so with the output.
