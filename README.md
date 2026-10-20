# SprachRaum — German AI Voice Tutor

Production-oriented German AI voice tutor with LiveKit realtime audio, lip-synced avatars, CEFR-aware prompting (A1–C1), persistent mistake memory in SQLite, safety guardrails, and multi-provider AI (Gemini / OpenAI).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, Prisma, SQLite |
| Realtime audio | LiveKit Server + WebRTC |
| Voice agent | Python LiveKit Agents |
| AI | Google Gemini Live (default) or OpenAI Realtime |
| Tunnel | Cloudflare `cloudflared` (HTTPS/WSS URL on startup) |

## Quick start (Docker)

1. Copy environment file and add API keys:

```bash
cp .env.example .env
# Edit .env — set GOOGLE_API_KEY (or OPENAI_API_KEY) and AI_PROVIDER
```

2. Launch everything:

```bash
docker compose up --build
```

3. Watch the `cloudflared` service logs for a public HTTPS URL:

```text
https://xxxx.trycloudflare.com
```

Local UI is also available at [http://localhost:3000](http://localhost:3000).

> **Voice over the tunnel:** the free `cloudflared` service exposes the Next.js UI. For WebRTC voice from remote browsers, LiveKit must also be reachable (set `NEXT_PUBLIC_LIVEKIT_URL` to a public `wss://` LiveKit host). On the same machine, `localhost:3000` + `ws://localhost:7880` works out of the box.

### Login

Users create their own account at `/signup` (email, username, password) and log in with
either their email or username. Set `ALLOW_SIGNUP=false` in `.env` to close sign-up.

`AUTH_SECRET` is required (32+ random characters, e.g. `openssl rand -base64 48`).
To also seed an admin account, set `ADMIN_USERNAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`
in `.env`; with no `ADMIN_PASSWORD`, no admin is created.

## Local development (without Docker)

### Frontend

```bash
cd frontend
cp ../.env.example ../.env
npm install
export DATABASE_URL="file:./prisma/dev.db"
npx prisma db push
npm run db:seed
npm run dev
```

### LiveKit

Run LiveKit server with `./livekit.yaml` (or use the `livekit` Compose service).

### Python agent

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export LIVEKIT_URL=ws://localhost:7880
export LIVEKIT_API_KEY=devkey
export LIVEKIT_API_SECRET=secretsecretsecret
export AI_PROVIDER=gemini
export GOOGLE_API_KEY=your_key
export DATABASE_PATH=../frontend/prisma/dev.db
python agent.py start
```

## Features

1. **Profiles** — up to 10 per account; each stores name, CEFR level, avatar (Hannah / Lukas), and memory.
2. **Adaptive memory** — `ProfileMemory` + `SessionLog` in SQLite; agent injects top mistakes into the system prompt.
3. **Safety guardrails** — tutor-only system instructions + input filters for abusive / illicit content.
4. **Lip-sync** — Web Audio `AnalyserNode` drives canvas mouth visemes at ~60 FPS.
5. **Provider switch** — `AI_PROVIDER=gemini|openai` with optional `GEMINI_MODEL` / `OPENAI_MODEL`.

## Project layout

```text
frontend/          Next.js app + Prisma schema
backend/           LiveKit Python agent (prompts, memory, provider switch)
livekit.yaml       LiveKit server config
docker-compose.yml Frontend + agent + LiveKit + cloudflared
```

## Environment

See `.env.example` for all variables. Minimum required for voice sessions:

- `AI_PROVIDER=gemini`
- `GOOGLE_API_KEY=...`

Or:

- `AI_PROVIDER=openai`
- `OPENAI_API_KEY=...`
