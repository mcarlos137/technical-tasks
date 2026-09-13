# technical-tasks

My workspace for take-home tasks. The deliverable is `barcelona/`, and its [README](barcelona/README.md) is the document the evaluator reads. This file is just my notes.

| Path | What it is |
|---|---|
| `barcelona/` | The Explore screens + games QA agent task: Flutter app, GraphQL API, Gemini agent |
| `docs/` | The task brief (PDF) |

## Sharing `barcelona/` with the evaluator

The repo is public, so send this link. GitHub renders `barcelona/README.md` below the file list:

https://github.com/mcarlos137/technical-tasks/tree/main/barcelona

If they want a file instead, export a zip. Don't zip the folder straight from disk. `barcelona/agent/.env` holds my Gemini API key, and the `node_modules` and Flutter build folders add hundreds of MB. Export only the committed files instead. Commit first, because this exports `HEAD`, not the working copy:

```bash
git archive --format=zip --prefix=barcelona/ -o ~/Desktop/barcelona.zip HEAD:barcelona
```

Then confirm that no secrets or dependencies slipped in. This should print nothing:

```bash
unzip -Z1 ~/Desktop/barcelona.zip | grep -E '(^|/)\.env$|node_modules|/build/'
```

The evaluator runs `npm install` and `flutter pub get` themselves, as described in `barcelona/README.md`.

## Local notes

- **Gemini key**: this lives in `barcelona/agent/.env`, which is gitignored. The default model is `gemini-flash-lite-latest`, whose free tier allows 15 requests a minute and 500 a day. `gemini-flash-latest` allows only 20 a day.
- **Ports**:
  - API: `:4000`, with GraphiQL at `/graphql`.
  - PostgreSQL (optional): `:5433`, database `games`, user `games`.
  - Agent chat: `:3001`.
  - Web build: `:8080`, served with `python3 -m http.server` from `barcelona/app/build/web`.
- **Eval**: `cd barcelona/agent && npm run eval -- --report eval.md` needs the API running. It uses about 15 Gemini requests.
- **Database**: optional. By default the API serves `barcelona/api/data/games.json`, the mock data file the brief allows. PostgreSQL 17 in Docker (`cd barcelona/api && docker compose up -d`, port 5433) serves the same games when `DATABASE_URL` is set. No Supabase.
- **Deployment** is not decided yet. Use personal accounts only.
- **Access**: the repo has been public since 2026-09-13, including `docs/` and this file. Anything committed here is public, so keys stay in the gitignored `.env` files.
