# Bow and Arrow

Turn a prompt, or your own PDFs, into a study map with a 30-minute timer on every topic. Next.js (App Router) + FastAPI + Supabase (PostgreSQL, pgvector, RLS) + Gemini.

```
supabase/migrations/0001_knowledge.sql   tables, RLS, match_user_knowledge()
supabase/migrations/0002_study_maps.sql   persistent study maps with RLS
backend/                                 FastAPI: app/ (core, api, services, models)
frontend/                                Next.js: src/components/mindmap/MindMapCanvas.jsx
```

## Set up

1. **Database.** In the Supabase SQL editor run `supabase/migrations/0001_knowledge.sql`.
2. **Backend.**
   ```bash
   cd backend && cp .env.example .env     # SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY
   pip install -r requirements.txt
   set -a; source .env; set +a
   uvicorn main:app --reload              # http://localhost:8000/docs
   ```
3. **Frontend.**
   ```bash
   cd frontend && cp .env.example .env.local   # Supabase URL + anon key, NEXT_PUBLIC_API_URL
   npm install && npm run dev                  # http://localhost:3000
   ```

## How it works

**`POST /api/mindmap/generate`** (multipart: `prompt`, optional `files[]` PDFs, optional `folderId`)

| Input | Engine |
|---|---|
| PDFs uploaded | `pypdf` extracts text, sentence-aware chunks (~1200 chars, never across pages) are embedded with Gemini (768 dims), saved to `knowledge_chunks`, the chunks most relevant to the prompt are passed to Gemini, and each node records which PDF pages it came from. |
| No PDFs, folder chosen | The folder's saved notes are searched with `match_user_knowledge`. Matches ground the roadmap; no matches falls back to the prompt alone, with a warning. |
| No PDFs, no folder | Pure prompt generation. |

Every node is created server-side with `totalSeconds = remainingSeconds = 1800`. The model never chooses durations, and its output is repaired before use (unknown parents, cycles, depth over 3, over 20 nodes, duplicate keys).

**`POST /api/mindmap/command`** sends the command and the live node states. Gemini is constrained with `response_schema` to one of `COMPLETE`, `ADD_TIME`, `RESTART`, `EXPAND`, `GENERATE_NEW_MAP`. The server validates it (hallucinated node ids fall back to a fuzzy title match, so speech-to-text "tarzan" still finds Tarjan), clamps `ADD_TIME` to 1 minute to 8 hours, and for `EXPAND` / `GENERATE_NEW_MAP` also returns the new nodes / map with 30-minute timers.

**Security.** The backend forwards the user's own Supabase JWT to PostgREST, so Row-Level Security decides what a user can read or write. There is no service-role key. `user_id` is never accepted from a client. A user cannot insert chunks into someone else's folder (policy-checked), and `match_user_knowledge` is `security invoker`, filtered on `auth.uid()`, and not callable by `anon`.

## Canvas behaviour

- Countdown is timestamp-based, so a throttled background tab doesn't drift. One node runs at a time: starting one pauses the other.
- At zero the node stops, shows "Time's up", and beeps. Add time or mark it complete.
- Checkbox completes a node. `+15m` / `+1hr` extend it. **Scratch** resets to a fresh 30 minutes and clears completion; the `RESTART` command does the same.
- The map is saved in the browser. On reload nothing keeps running; running nodes come back paused.
- Voice uses the browser's speech recognition (Chrome/Edge/Safari). Spoken commands are answered aloud.

## Tests

```bash
cd backend && pytest                                  # 20 tests
cd frontend && npm test                               # 16 tests (countdown, reducer, layout)
# SQL: needs Postgres + pgvector; see supabase/tests/ (a small stub provides auth.uid() and roles)
```

Not covered by automated tests: live Gemini calls, live Supabase/PostgREST calls, and the rendered UI in a browser.
