# Explore Screens + Games Q&A Agent (Barcelona)

Two parts built on **one** small GraphQL API:

| Folder | What | Stack |
|---|---|---|
| [`api/`](api) | Games GraphQL API over the mock data | Node 20+, TypeScript, graphql-yoga; the JSON file, or PostgreSQL 17 (optional) |
| [`app/`](app) | Explore home + Pick-up games list | Flutter 3.44.8, `graphql` client |
| [`agent/`](agent) | Minimal chat agent with the API exposed as tools | Node 20+, Google Gemini (`@google/genai`) |

The Flutter screens and the agent both read from the same API, which serves the mock data file `api/data/games.json`, as the brief allows.
**PostgreSQL is optional.** With `DATABASE_URL` set, the API serves the same games from a local database instead, and a parity test checks that both answer every query identically.

> **Reference "today" in the mock data: Tuesday 25 August 2026, Europe/Madrid.**
> The API exposes it as `referenceDate { today }`. The app labels "Today"/"Tomorrow" from it,
> and the agent resolves "tomorrow", "this weekend" and "on Thursday" against it.
> Tomorrow is Wed 26 Aug. This weekend is Sat 29 to Sun 30 Aug. "On Thursday" is 27 Aug.

| | Explore home | Pick-up games |
|---|---|---|
| **iOS simulator** | <img src="docs/screenshots/explore-home.png" width="260"> | <img src="docs/screenshots/pickup-games.png" width="260"> |
| **Chrome, web build** | <img src="docs/screenshots/web-explore-home.png" width="260"> | <img src="docs/screenshots/web-pickup-games.png" width="260"> |
| **Android emulator, release build** | <img src="docs/screenshots/android-explore-home.png" width="260"> | |

Every screenshot reads live from the local API. The iOS ones come from an iPhone 16 Pro simulator.
The Chrome ones come from `flutter build web` in a phone-sized window.

**Web pages**

| Agent chat at `localhost:3001` | API explorer (GraphiQL) at `localhost:4000/graphql` |
|---|---|
| <img src="docs/screenshots/agent-chat.png" width="420"> | <img src="docs/screenshots/graphiql.png" width="420"> |

The chat page is shown before any question, because a real conversation needs a Gemini key.
The API explorer is running the same "tomorrow morning" query the agent sends.

---

## How to run

No database is needed. The API serves the mock data file `api/data/games.json`, as the brief allows.
Start the API first, then the app and the agent, which both call it.
Each block starts from this folder (`barcelona/`). The last command in each step keeps running, so give each step its own terminal.

### 1. API

```bash
cd api
npm install
npm test                      # filtering, validation and GraphiQL examples
npm start                     # keeps running: http://localhost:4000/graphql  (GraphiQL opens with example queries)
```

The startup log names the source: `Games API (source: data/games.json)`.
To serve the same games from PostgreSQL instead, see [Optional: PostgreSQL instead of the JSON file](#optional-postgresql-instead-of-the-json-file).

### 2. Flutter app

Install Flutter 3.44.8 first if you don't have it. A shallow clone of the release tag is the fastest route:

```bash
git clone --depth 1 --branch 3.44.8 https://github.com/flutter/flutter.git ~/development/flutter
```

```bash
export PATH="$HOME/development/flutter/bin:$PATH"
```

Then run the app:

```bash
cd app
flutter pub get
flutter test         # widget + unit tests (no API needed, uses an in-memory fake)
flutter build web    # static site in build/web, which any static file server can serve
flutter devices      # lists the iOS simulators, Android emulators, Chrome and macOS you can run on
flutter run -d chrome   # keeps running; swap chrome for any device id from flutter devices
```

Pass `-d`: with several devices connected, a bare `flutter run` stops to ask which one to use.

The app calls `http://localhost:4000/graphql`, or `http://10.0.2.2:4000/graphql` on the Android emulator.
Override it with `--dart-define=GAMES_API_URL=http://<host>:4000/graphql`, for example on a physical device.

### 3. Agent

```bash
cd agent
npm install
cp .env.example .env # then paste a free key from https://aistudio.google.com/apikey into GEMINI_API_KEY
npm test             # date-resolution + agent-loop tests (no key needed)
npm run eval -- --report eval.md   # runs the 5 required conversations (6 cases) against Gemini, checks them and writes eval.md
npm start            # keeps running: chat UI at http://localhost:3001
```

The eval needs the API from step 1 but not the chat server. Run it once: each run spends about 12 free requests.
Leave out `-- --report eval.md` to print the results without writing the file.

The chat server starts without a key too. The chat then replies with setup instructions instead of calling the model.

`GEMINI_MODEL` defaults to `gemini-flash-lite-latest`, the alias Google keeps pointed at its current Flash Lite model.
On 13 Sep 2026 it served Gemini 3.5 Flash Lite. Flash Lite is the default because the free tier gives it far more room:

| Free-tier model | Requests per minute | Requests per day |
|---|---|---|
| Gemini 3.5 Flash Lite, the default | 15 | 500 |
| Gemini 3.8 Flash | 5 | 20 |

These limits come from AI Studio's rate-limit page for this project on 13 Sep 2026, and they can differ per account.
Each question costs about two requests, and one eval run about 12, so Flash's daily limit is used up after one or two runs.
Set `GEMINI_MODEL=gemini-flash-latest` for the stronger model. The Gemini 2.5 models are already closed to new keys.
[Free tier and request limits](#free-tier-and-request-limits) explains how the agent stays within these numbers.

### Optional: PostgreSQL instead of the JSON file

You can skip this. It serves the same 19 games from a local PostgreSQL database, and needs Docker.
Stop the API from step 1, then:

```bash
cd api
docker compose up -d --wait   # creates PostgreSQL 17 on 127.0.0.1:5433; database, user and password are all "games"
docker compose exec db psql -U games -d games -c 'select count(*) from games'   # prints 19
cp .env.example .env          # sets DATABASE_URL to that database
npm test                      # now also runs the 2 PostgreSQL parity tests
npm start                     # keeps running: same URL, same answers
```

The startup log then reads `Games API (source: PostgreSQL at localhost:5433/games)` followed by `PostgreSQL connected: 19 games`.
The app and the agent need no change. Both sources return identical data, and the parity tests check that.

On the first start, Postgres runs the two files in `api/db/migrations` in order:

- `0001_games_schema.sql` creates the `venues`, `organizers` and `games` tables and enables the `unaccent` extension.
- `0002_seed_games.sql` loads 5 venues, 6 organizers and 19 games.

To go back to the JSON file, delete `api/.env` or leave `DATABASE_URL` empty in it, then restart the API.
`docker compose down -v` deletes the database, so the next `up` creates it again.
Any other PostgreSQL 14 or newer also works. Create an empty database, then run
`psql "$DATABASE_URL" -f db/migrations/0001_games_schema.sql -f db/migrations/0002_seed_games.sql`.

---

## Part 1: screens

- **Explore home**: the title with its city, the promo carousel, the Pick-up games intro, and the next day that still has joinable games (up to 4 rows). Then "See all", the start of Tournaments, and the bottom bar.
  Today's games in the data are all full, so the preview shows **Tomorrow, Wed 26 August, 2026**, exactly like the screenshot.
- **Pick-up games**: back button with a centered title, then the filter chips, the date selector, the Flex Pass banner, and games grouped under day headers.
  - **1+ spots** re-queries the API with `minSpotsAvailable: 1`, which hides full games. Filters, Lowest price and YEGO are inert, as allowed.
  - **Date selector**: tapping a day scrolls its section to the top. Scrolling the list updates the selected day. Days without games still get a header with an empty-state line, so every tile has a target.
- **Shared game row** (`app/lib/widgets/game_row.dart`): the time sits left of a thin divider. The venue name truncates with an ellipsis. Below it are the format and "Recorded" tags, then the organizer chip and a color-coded availability chip. The whole row is tappable.
  - Urgent means 1 or 2 spots left and uses an amber fill ("Last 2 spots").
  - Available means 3 or more spots and uses a green outline ("4 spots").
  - Full uses neutral gray ("Full").
- The **bottom bar** stays visible on pushed screens because each tab owns a nested `Navigator`. Fields, Messages and Profile are placeholders.
- Tapping a row opens a **placeholder detail screen**, which loads through the API's `game(id)` query.

---

## Part 2a: API design decisions

The API is meant to be consumed by a language model, so it favors being **unambiguous, self-describing and hard to misuse**.

1. **Every type, field and argument has a description.** An agent that introspects the schema learns units, formats and semantics, such as "0 means the game is full" and "morning = 06:00 to 12:00".
2. **No ambiguous dates or times.**
   - `date` is an ISO calendar date (`YYYY-MM-DD`) in the venue's local timezone.
   - `startTime` and `endTime` are 24h `HH:mm` local times, and `timezone` names the IANA zone.
   - `startsAt` keeps the explicit UTC offset.
   - Relative words like "tomorrow" are **rejected**. The client has to resolve them, and `referenceDate` gives it the anchor to do so deterministically.
3. **Strict validation with actionable errors.** A malformed date, an inverted range, a negative spot count, or `date` combined with `dateFrom`/`dateTo` all fail with a `BAD_USER_INPUT` error. The message states the expected format. Nothing silently falls back to "return everything".
4. **The server echoes what it applied.** `games` returns `{ totalCount, games, appliedFilter }`, so the caller can check that the server understood its intent.
5. **Empty is a normal answer.** Unknown venues or empty days return `totalCount: 0` and `games: []`, never null and never an error. `game(id)` returns null for a missing id.
6. **Derived state lives on the server.** `availability` is a closed enum of `URGENT`, `AVAILABLE` and `FULL`, computed from `spotsAvailable`, so the app and the agent can't disagree on the thresholds.
7. **Forgiving where it is safe.** `venueName` matching ignores case and accents, so "aliga" finds "L'Àliga". `venueId` gives an exact match. Filters combine with AND.
8. **Bounded and ordered.** Results are sorted by kick-off, and games that kick off together keep their listing order, as in the design screenshots. The `first` argument defaults to 100, capped at 500.
9. **Read-only.** There are no mutations, and with PostgreSQL the database sessions are read-only, so a model driving the API cannot change anything.

```graphql
type Query {
  games(filter: GamesFilter, first: Int = 100): GamesResult!
  game(id: ID!): Game
  venues: [Venue!]!
  referenceDate: ReferenceDate!
}
input GamesFilter {
  date: Date  dateFrom: Date  dateTo: Date          # one day OR an inclusive range
  venueId: ID  venueName: String                    # exact id or fuzzy name
  minSpotsAvailable: Int                            # 1 = hide full games
  availability: [Availability!]
  startTimeFrom: String  startTimeTo: String        # HH:mm window, e.g. "morning"
}
```

Example:

```graphql
{ games(filter: { date: "2026-08-26", startTimeFrom: "06:00", startTimeTo: "12:00" }) {
    totalCount appliedFilter { dateFrom dateTo startTimeFrom startTimeTo }
    games { startTime venue { name } format spotsAvailable availability } } }
```

**Data source.** By default the API serves `api/data/games.json`, the mock data file the brief allows. PostgreSQL is optional: the API reads it when `DATABASE_URL` is set. Both hold the same 19 games, from 25 to 31 August, at 5 venues.

- **Schema and seed** live in `api/db/migrations`. `docker compose up -d` applies them to PostgreSQL 17, and `npm run seed:sql` regenerates the seed from the JSON.
- **Filters run in SQL** with bound parameters.
  - The date and time-of-day filters compare two indexed generated columns, `local_date` and `local_start_time`.
  - Venue names match accent-insensitively through the `unaccent` extension.
- **A parity test** runs 16 filters, every game id and the calendar against both sources, and requires identical results.
- **API sessions are read-only** (`default_transaction_read_only`), so not even a bug can write.

---

## Part 2b: agent design

The agent lives in `agent/src`: `agent.ts` runs the loop, `tools.ts` holds the tools, and `calendar.ts` resolves dates.

- **Tools**: `search_games`, `get_game_details` and `list_venues`. Each is a thin, typed wrapper over one GraphQL query.
- **Deterministic dates.** Models are unreliable at weekday arithmetic. Every turn, the system prompt gets a 14-day calendar built from the API's `referenceDate`, plus the pre-resolved meanings of today, tomorrow, this weekend, next weekend and "on <weekday>". Time-of-day words map to explicit `HH:mm` windows that the API filters server-side.
- **Grounding.**
  - The prompt requires a tool call before any claim about games.
  - Tool results come back grouped by date, and each carries a `note`. An empty result says "NO games match… say so plainly". A multi-day result says "Results span N dates… break down per day or ask".
  - API errors return to the model as structured data with a hint to fix the arguments. They never crash the loop, so the model never has to fall back to memory.
- **Honest limits.** The prompt lists exactly which fields exist, which also tells the model what is missing: player skill, ratings, weather, facilities, booking. Questions about those get "that isn't available" instead of a guess.
- **Quota-aware retries.** Per-minute rate limits and "high demand" errors are retried. The daily limit fails at once with a clear message, and a failed turn is rolled back. See [Free tier and request limits](#free-tier-and-request-limits).
- **Bounded loop.** A turn allows at most 6 tool rounds. Chat sessions are kept in memory, and the UI shows each tool call and its raw result under the answer, so grounding can be audited.

The required conversations and what the data makes them test:

| # | Question | Expected behavior with this data |
|---|---|---|
| 1 | "What games are there tomorrow morning?" | Calls `search_games(date 2026-08-26, 06:00 to 12:00)`. Lists 7:15, 8:15 and 9:15 at La Catalana (Full), 9:15 at Agapito Fernández (Last 2 spots), and 10:15 at Agapito Fernández (4 spots). |
| 2 | "this weekend" / "on Thursday" | Resolves to 2026-08-29 to 2026-08-30 and to 2026-08-27. |
| 3 | A day with no games, such as 5 September | Says plainly that there are none. |
| 4 | "Any spots at La Catalana?" | La Catalana has games on 26, 27, 29 and 31 Aug, so the answer is broken down per day or asks which day. |
| 5 | "Which game has the best players?" | States that the data has no player or skill information. |

`npm run eval` runs these conversations against the real model and asserts on both the tool arguments and the reply.
It also checks every reply against the tool results of its conversation:

- Every time, match format, price and spot count in the reply must appear in a tool result.
- A real venue can only be named after a tool returned it.
- General claims the data can't support fail the case, such as "games are open to all levels".

The check lives in `agent/src/grounding.ts` and has its own unit tests.
It was added after a run on Gemini 3.8 Flash answered the "best players" question correctly, then claimed that games are open to all skill levels and gave 7v7 as an example format.
Neither comes from the data. Rule 4 of the system prompt now forbids both, and the eval would fail such an answer.

### Free tier and request limits

The agent runs on a free AI Studio key, so it can be tried without billing. The free tier limits it in three ways, and each has its own handling in `agent/src/agent.ts`.

- **Requests per day: 500 on Flash Lite, 20 on Flash.**
  - The quota belongs to the key's Google Cloud project, so everyone using the key shares it.
  - A question usually costs two requests: one to choose the tool call and one to write the answer from its result. A turn is capped at 7 requests (6 tool rounds), so a runaway loop can't drain the day.
  - This is why Flash Lite is the default: 500 requests a day is about 250 questions, while Flash's 20 is about 10.
  - Once the daily quota is spent, the agent stops at once. The chat says the quota is used up and resets at midnight Pacific time, since retrying before then only wastes time.
- **Requests per minute: 15 on Flash Lite, 5 on Flash.**
  - A per-minute 429 tells the caller how long to wait (`retryDelay`). The agent waits that long and retries, up to 3 attempts, so a burst makes an answer slower instead of failing it.
  - The eval pauses 5 seconds between cases (`EVAL_PAUSE_MS`) to stay under the limit.
- **"High demand" errors.** Gemini sometimes answers 503 for a few seconds when it's busy. The SDK retries 408 and 5xx errors with backoff (2s, 4s, 8s, 16s). If they keep failing, the chat says Gemini is overloaded.

Two rules keep a failure contained:

- **A failed turn is rolled back.** Otherwise a 429 on a turn's second request would leave a question without an answer, or a tool call without its result, in the history sent with the next message.
- **Only the user's question and public game data go to Gemini.** On the free tier Google may use prompts and responses to improve its products, so real user data should only go through a paid key.

Still missing: there is no per-user limit, so one busy user can spend everyone's daily quota. Each request also resends the whole conversation, so long chats use more of the tokens-per-minute limit. [Stretching the free Gemini quota](#stretching-the-free-gemini-quota) covers both.

### Test conversations and the responses we got

The transcript below is the latest run, word for word. Expand a conversation to see the tool call and the answer.

Recorded on 2026-09-13 with `gemini-flash-lite-latest`, answered by `gemini-3.5-flash-lite`. 6/6 cases passed.

<details>
<summary><b>1. Simple question (tomorrow morning)</b>: passed</summary>

**User:** What games are there tomorrow morning?

**Tool call:** `search_games({"date":"2026-08-26","start_time_to":"12:00","start_time_from":"06:00"})`, 5 games returned

**Agent:**

> Here are the games for tomorrow morning (Wednesday, 26 August 2026):
>
> * 07:15 — La Catalana (8v8) — Full
> * 08:15 — La Catalana (8v8) — Full
> * 09:15 — Agapito Fernández (8v8) — 2 spots left
> * 09:15 — La Catalana (8v8) — Full
> * 10:15 — Agapito Fernández (8v8) — 4 spots left

</details>

<details>
<summary><b>2a. Relative date: this weekend</b>: passed</summary>

**User:** Anything this weekend?

**Tool call:** `search_games({"date_from":"2026-08-29","date_to":"2026-08-30"})`, 4 games returned

**Agent:**

> Here are the games available this weekend:
>
> **Saturday 29 August 2026**
> - 10:00 — La Catalana (8v8) — 7 spots left
> - 18:00 — Camp Municipal de Futbol Can Dragó (11v11) — 8 spots left
>
> **Sunday 30 August 2026**
> - 11:00 — El Carmel (8v8) — 2 spots left
> - 19:00 — L'Àliga (9v9) — 5 spots left

</details>

<details>
<summary><b>2b. Relative date: on Thursday</b>: passed</summary>

**User:** What about on Thursday?

**Tool call:** `search_games({"date":"2026-08-27"})`, 2 games returned

**Agent:**

> Here are the games for Thursday, 27 August 2026:
>
> * 19:30 — La Catalana (8v8) — 6 spots left
> * 21:00 — L'Àliga (9v9) — 1 spot left

</details>

<details>
<summary><b>3. Grounded: empty result</b>: passed</summary>

**User:** Are there any games on 5 September?

**Tool call:** `search_games({"date":"2026-09-05"})`, 0 games returned

**Agent:**

> There are no games scheduled for Saturday 5 September 2026. Games are currently scheduled through Monday 31 August 2026.

</details>

<details>
<summary><b>4. Ambiguity: La Catalana across several days</b>: passed</summary>

**User:** Any spots at La Catalana?

**Tool call:** `search_games({"min_spots_available":1,"venue_name":"La Catalana"})`, 3 games returned

**Agent:**

> Yes, there are available spots at La Catalana across several days:
>
> **Thursday, 2026-08-27**
> * 19:30 — La Catalana (8v8) — 6 spots left
>
> **Saturday, 2026-08-29**
> * 10:00 — La Catalana (8v8) — 7 spots left
>
> **Monday, 2026-08-31**
> * 20:30 — La Catalana (8v8) — 10 spots left

</details>

<details>
<summary><b>5. Honest about limits</b>: passed</summary>

**User:** Which game has the best players?

**Tool calls:** none

**Agent:**

> I don't have information about player skill levels, ratings, or player quality. I can only provide details on game dates, kick-off times, venues, formats, spots available, prices, and organizers. 
>
> If you'd like to check available games for a specific day, time, or venue, let me know!

</details>

---

## What has been verified

| Check | Result |
|---|---|
| API tests: filtering, validation, GraphiQL examples, PostgreSQL parity (`api`, `npm test`) | 11 passing on the JSON file, with the 2 PostgreSQL tests skipped. 13 passing with `DATABASE_URL` set |
| Agent tests: date resolution, tool loop with a scripted model, quota handling, grounding check (`agent`, `npm test`) | 15 passing |
| Flutter analyzer and tests (`app`, `flutter analyze`, `flutter test`) | 0 issues, 10 passing |
| App on the iOS simulator against the live API | Both screens, "1+ spots", date jump, row detail and tab bar all work |
| App as a web build in headless Chrome against the live API | Both screens render with live data, and "See all" opens the list |
| Android release build (`flutter build apk`) on a Pixel 5 emulator, API 36 | Explore home loads live data through `10.0.2.2`, and the installed app holds only the INTERNET permission |
| Agent tools called directly against the live API | Morning window, empty day, bad date and unknown id all return the expected structured data |
| PostgreSQL 17 in Docker (`docker compose up -d --wait`) | Schema, `unaccent` and seed apply on first start. The seed re-runs safely, the counts match the JSON (5 venues, 6 organizers, 19 games), and date filters use `games_local_date_idx` |
| API against PostgreSQL | 16 filters, all 19 games, the venues and the calendar match the JSON source exactly, and API sessions can't write. The app, GraphiQL and the agent also ran against it |
| API in both modes from a fresh clone: the JSON file with no database, then PostgreSQL | The same queries return identical data, and both reject a relative date such as "tomorrow" with the same `BAD_USER_INPUT` error |
| Agent against Gemini (`npm run eval`) | All 6 conversations pass on Gemini 3.5 Flash Lite, with every time, format, price, spot count and venue checked against the tool results. The transcript is in Part 2b |

---

## What I cut, and what I'd do with more time

- **Promo images**: the carousel cards use gradients and glyphs instead of photos, to avoid shipping third-party imagery. Swapping in `Image.asset` is a one-line change per card.
- **Availability colors**: the screenshot shows "5 spots" with a gray outline, but the spec defines only three states, so every available game gets the green outline. With a design answer, a fourth "plenty" state is easy to add as another enum value.
- **Only "1+ spots" works.** Filters, Lowest price and YEGO are visual only. The API already supports price data and more filters, so wiring them is mostly UI work.
- **No pagination.** `first` bounds the result size. A real API would use cursor pagination.
- **Agent quality.** With more time I'd:
  - turn the eval's grounding check into a runtime guard that regenerates or blocks a reply that fails it,
  - add a golden-set eval in CI with a pinned model,
  - consider exposing the schema to other agents through MCP.
- **Deployment** is deliberately left out until the hosting target is decided. The PostgreSQL schema and its compose file are ready, and the Flutter web build is a static site that any static host can serve. A serverless entry point for the API is a small addition once the platform is chosen.

The five areas below each start with what already exists, checked against the code, and then list what I'd add.

### Async processing

**In place:** all I/O is non-blocking. The app loads data with futures and shows loading and error states. Each agent call to the API times out after 10 seconds, and a turn stops after 6 tool rounds. There are no background jobs, queues or scheduled tasks, and the chat request waits for the whole answer.

**Next:**
- **Stream the agent's reply** over server-sent events, so text and tool calls appear as they happen.
- **Queue booking writes** once bookings exist, for example with a jobs table read with `FOR UPDATE SKIP LOCKED`, or the pgmq extension. Idempotency keys make retries safe, so a retry never books twice.
- **Scheduled jobs with pg_cron** to close games at kick-off, send reminders two hours before, and clear expired chat sessions.
- **An outbox table**: a trigger records each change as an event in the same transaction, and a worker turns events into notifications and cache invalidations. Nothing is lost while a worker is down.
- **Run the Gemini eval on a schedule** in CI, so a model update that breaks grounding is caught early.

### Push notifications and live updates

**In place:** nothing yet. The app fetches when a screen opens or when "1+ spots" is toggled. There is no pull-to-refresh and no live update.

**Next:**
- **Push through Firebase Cloud Messaging**, which reaches iOS through APNs. A `device_tokens` table holds one row per user and device.
- **Events worth a notification**: a spot opens in a full game you're waitlisted for, a game you joined starts in two hours, a saved game drops to its last two spots, or an organizer changes or cancels a game.
- **Deep links** from each notification to the game's detail screen.
- **Live availability** through GraphQL subscriptions, which graphql-yoga serves over server-sent events. A trigger on the games table would feed them through Postgres `LISTEN/NOTIFY`. The availability chip would update without a refresh.
- **Pull-to-refresh** on both screens as a simple fallback.
- **User control**: opt-outs per notification type, quiet hours, and a daily cap per user.

### Database: triggers, functions, procedures and views

**In place:**
- Three tables with foreign keys and check constraints. The checks cover spot ranges, non-negative prices, the local time format, and agreement between the UTC and local kick-off times.
- Two generated columns, `local_date` and `local_start_time`, carry the local date and kick-off time. They are indexed, along with the venue and organizer keys.
- A `list_position` column keeps the listing order for games that kick off at the same time.
- The `unaccent` extension handles the accent-insensitive venue search.
- Filtering runs in SQL, API sessions are read-only, and the seed can be re-run safely.

There are no triggers, functions, procedures or views yet.

**Next:**
- **A `games_with_availability` view** that joins venue and organizer and computes the urgent, available or full state in SQL, so the thresholds live in one place.
- **A trigram index** (`pg_trgm`) on venue names, so fuzzy matches such as typos work beyond today's substring match.
- **A bookings table and a `join_game` function** that locks the game row, checks spots and inserts the booking in one transaction, so two players can never take the last spot at once. It is a function rather than a procedure because it returns the booking.
- **An `archive_past_games` procedure** that pg_cron runs nightly. It moves finished games to an archive table in batches and commits between batches.
- **Triggers** that keep `spots_available` in step with bookings, maintain `updated_at`, reject bookings for full or started games, and write the outbox events.
- **A materialized view of games per day**, refreshed by pg_cron, to put cheap counts on the date selector.
- **Database tests with pgTAP**, so constraints and functions are checked in CI.

### Caching

**In place:**
- The JSON source loads once at startup.
- The PostgreSQL source queries on every request, with no cache. The indexes keep that cheap.
- The app has an in-memory GraphQL cache but reads network-only, so spot counts are always fresh. That is deliberate, since stale availability is worse than a slower screen.
- The agent fetches the reference date on every turn.

**Next:**
- **Response caching in the API** with graphql-yoga's response-cache plugin, keyed by query and variables and invalidated by game id when spots change.
- **A shared cache such as Redis** once there is more than one API instance, because per-instance caches drift apart.
- **CDN caching for list queries** by sending persisted queries as GET with a short `s-maxage` and `stale-while-revalidate`.
- **Event-driven invalidation** from the outbox or `LISTEN/NOTIFY` once a cache exists, instead of a fixed expiry.
- **Cache-and-network in the app** with a persistent store, so screens open instantly from the last result, refresh in the background, and work offline.
- **Never trust a cached spot count for a booking.** The `join_game` function re-checks inside its transaction.
- **Agent**: cache the reference date for the day and reuse identical tool results within a conversation.

### Security

**In place:**
- The API is read-only. It validates every input with clear errors and caps `first` at 500.
- PostgreSQL listens on 127.0.0.1 only, and the API is its only client.
- Every API session is read-only (`default_transaction_read_only=on`, checked by a test).
- Filter values are always bound parameters, never concatenated into SQL.
- `.env` files are gitignored. The committed templates contain only local development values.
- The agent can only call three read-only tools. Messages are capped at 2,000 characters and request bodies at 64 KB. The server issues session IDs as random UUIDs.
- The Android release manifest declares only the INTERNET permission.

**Next:**
- **Authentication** through an identity provider that issues JWTs, plus per-user row-level security policies in Postgres once bookings exist.
- **Least privilege**: the API connects as the database owner and relies on read-only sessions. A dedicated `games_api` role with only SELECT grants should replace it, and the password should come from a secret store, not the compose file.
- **Rate limits** per IP and per session on `/graphql` and `/api/chat`. The chat comes first, because every message spends Gemini quota.
- **GraphQL hardening**: depth and cost limits, a persisted-query allowlist, and masked errors in production. Today raw error messages go back to the caller, and GraphiQL and introspection are always on. Yoga's masking still lets the intentional validation messages through.
- **Tighter CORS**: any origin can call the API today. Only the app's own origins should.
- **Agent sessions**: expire idle sessions and cap history length, since the in-memory map grows without limit. Quota and overload errors already get a clear message, but other error replies still echo raw exception text and should stop.
- **Prompt-injection defense** if venue or organizer names ever become user-generated. Tool output stays data, and the reply guard from the agent section applies.
- **Transport and headers**: HTTPS only, the iOS local-network exception limited to debug builds, and a Content-Security-Policy and HSTS on the chat page.
- **Supply chain**: Dependabot, `npm audit` and GitHub secret scanning.

### Stretching the free Gemini quota

**In place:**
- Flash Lite as the default model.
- Two requests per question.
- Per-minute 429s are waited out.
- The daily limit fails fast.
- Failed turns are rolled back.

[Free tier and request limits](#free-tier-and-request-limits) has the details.

**Next:** most questions are the same few searches, such as "tomorrow morning", "this weekend" or "spots at La Catalana", and they don't need a model to answer. The plan is to put cheaper layers in front of Gemini, so the quota goes to the questions that need it.

```mermaid
flowchart LR
  Q[Question] --> C{Answer cache}
  C -- hit --> A[Answer]
  C -- miss --> R{Intent router}
  R -- parsed --> T[search_games + template] --> A
  R -- open-ended --> G[LLM gateway]
  G -- within budget --> M1[Flash Lite] --> A
  G -- Flash Lite spent --> M2[Second free model] --> A
  G -- every quota spent --> J[Queued job] -. after the reset .-> P[Push or inbox]
  O[Outbox: a game changed] -. invalidates .-> C
```

- **An answer cache shared by all users.**
  - The key is the normalized question plus a data version, the newest `updated_at` among the games. Normalizing means lowercasing and replacing relative dates with the dates they resolve to.
  - The first "games tomorrow morning" of the day costs two requests, and every repeat costs none.
  - The outbox from the async section bumps the data version whenever spots change, so a cached answer never shows stale availability.
- **An intent router in front of the model.**
  - A small deterministic parser recognizes the common shapes: a day word, a time of day, or a venue name from `list_venues`. It calls `search_games` directly and formats the reply from a template.
  - Only questions it can't parse reach Gemini.
  - `calendar.ts` already does the hardest part, resolving the dates.
- **One request instead of two for plain searches.** The model chooses the tool call, and the server formats the list instead of sending the results back for a second call. That alone doubles the daily capacity, from about 250 questions to about 500.
- **An LLM gateway that owns the quota.**
  - It tracks the project's budget of 15 requests a minute and 500 a day before calling Gemini, instead of learning about it from 429s.
  - It gives each session a fair share, so one user can't spend the whole day.
  - It puts live questions ahead of background work.
  - The per-IP and per-session limits under Security are the first step toward it.
- **A model cascade.**
  - Each free model has its own quota. When Flash Lite's daily limit runs out, the gateway falls back to another free model that supports function calling.
  - A model has to pass the eval before it joins the cascade.
  - When every quota is spent, the cache and the router keep answering the common questions.
- **Automatic retries after a reset, with answers delivered later.**
  - *Per-minute limits:* done. The wait is a few seconds, so the answer still comes back in the same request.
  - *Daily limit:* the question becomes a job in the queue from the async section, storing the dates it resolved to when it was asked.
    - After midnight Pacific a worker runs it again against fresh data, since spot counts will have changed. If the game day has already passed, the job is dropped.
    - The answer arrives as a push notification or in an in-app inbox.
    - The replay is throttled behind live traffic, so the backlog doesn't spend the new day's quota in its first minute.
    - This needs user accounts and a delivery channel, which the demo doesn't have yet.
- **The eval on its own budget.** It should run in CI on a separate paid key, so testing never uses up the users' daily quota.
- **Not an option: multiple free keys or projects.** Spreading traffic across them gets around the limits instead of working within them, and Google's API terms forbid circumventing usage limits. Once there is real traffic, the answer is a paid key, whose limits rise with each usage tier.
