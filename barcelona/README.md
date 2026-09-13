# Explore Screens + Games Q&A Agent (Barcelona)

Two parts built on **one** small GraphQL API:

| Folder | What | Stack |
|---|---|---|
| [`api/`](api) | Games GraphQL API (mock data behind it) | Node 20+, TypeScript, graphql-yoga |
| [`app/`](app) | Explore home + Pick-up games list | Flutter 3.44.8, `graphql` client |
| [`agent/`](agent) | Minimal chat agent with the API exposed as tools | Node 20+, Google Gemini (`@google/genai`) |

The Flutter screens and the agent both read from the same API, which serves `api/data/games.json`.

> **Reference "today" in the mock data: Tuesday 25 August 2026, Europe/Madrid.**
> The API exposes it as `referenceDate { today }`. The app labels "Today"/"Tomorrow" from it,
> and the agent resolves "tomorrow", "this weekend" and "on Thursday" against it.
> Tomorrow is Wed 26 Aug. This weekend is Sat 29 to Sun 30 Aug. "On Thursday" is 27 Aug.

| Explore home | Pick-up games |
|---|---|
| <img src="docs/screenshots/explore-home.png" width="280"> | <img src="docs/screenshots/pickup-games.png" width="280"> |

The screenshots come from the iOS simulator on an iPhone 16 Pro, reading live from the local API.

---

## How to run

### 1. API (start this first)

```bash
cd api
npm install
npm start            # http://localhost:4000/graphql  (GraphiQL in the browser)
npm test             # unit tests for filtering/validation
```

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
flutter run          # iOS simulator, Android emulator, Chrome or macOS
flutter test         # widget + unit tests (no API needed, uses an in-memory fake)
```

The app calls `http://localhost:4000/graphql`, or `http://10.0.2.2:4000/graphql` on the Android emulator.
Override it with `--dart-define=GAMES_API_URL=http://<host>:4000/graphql`, for example on a physical device.

### 3. Agent

```bash
cd agent
npm install
cp .env.example .env # then paste a free key from https://aistudio.google.com/apikey into GEMINI_API_KEY
npm start            # chat UI at http://localhost:3001
npm test             # date-resolution + agent-loop tests (no key needed)
npm run eval         # runs the 5 required conversations against Gemini and checks them
```

The server starts without a key too. The chat then replies with setup instructions instead of calling the model.

`GEMINI_MODEL` defaults to `gemini-flash-latest`, the alias Google keeps pointed at the current free Flash model.
Set it to pin a specific version.

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
8. **Bounded and ordered.** Results are sorted by kick-off. The `first` argument defaults to 100, capped at 500.
9. **Read-only.** There are no mutations, so a model driving the API cannot change anything.

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

**Data source.** By default the API serves `api/data/games.json`, which holds 19 games across 25 to 31 August at 5 venues. The repository layer also has an optional Supabase backend, used only when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Its schema and seed are in `api/supabase/migrations`, and `npm run seed:sql` regenerates the seed from the JSON. Both sources share the same pure filter code, so they answer identically.

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

---

## What has been verified

| Check | Result |
|---|---|
| API unit tests (`api`, `npm test`) | 8 passing |
| Agent tests: date resolution and tool loop with a scripted model (`agent`, `npm test`) | 8 passing |
| Flutter analyzer and tests (`app`, `flutter analyze`, `flutter test`) | 0 issues, 10 passing |
| App on the iOS simulator against the live API | Both screens, "1+ spots", date jump, row detail and tab bar all work |
| Agent tools called directly against the live API | Morning window, empty day, bad date and unknown id all return the expected structured data |
| Supabase migrations on a throwaway Postgres 17 | Schema and seed apply, the seed re-runs safely, counts match the JSON |
| Supabase read path in the API | Not run, because it needs a Supabase project |
| Agent against Gemini (`npm run eval`) | Not run yet, because it needs a `GEMINI_API_KEY` |

---

## What I cut, and what I'd do with more time

- **Promo images**: the carousel cards use gradients and glyphs instead of photos, to avoid shipping third-party imagery. Swapping in `Image.asset` is a one-line change per card.
- **Availability colors**: the screenshot shows "5 spots" with a gray outline, but the spec defines only three states, so every available game gets the green outline. With a design answer, a fourth "plenty" state is easy to add as another enum value.
- **Only "1+ spots" works.** Filters, Lowest price and YEGO are visual only. The API already supports price data and more filters, so wiring them is mostly UI work.
- **No pagination or subscriptions.** `first` bounds the result size. A real API would use cursor pagination and push spot changes live.
- **Agent**: sessions live in memory and there is no streaming. With more time I'd:
  - stream tokens,
  - add a server-side guard that checks every time and venue in the reply against the tool results,
  - add a golden-set eval in CI with a pinned model,
  - consider exposing the schema to other agents through MCP.
- **Auth and rate limiting** are omitted because the API is local and read-only. Before any public deployment it needs rate limits, and it needs auth if write operations ever arrive.
- **Deployment** is deliberately left out until the hosting target is decided. The Supabase schema is ready. A serverless entry point for the API is a small addition once the platform is chosen.
