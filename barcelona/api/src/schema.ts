import { createSchema } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import type { GamesRepository } from './repository.js';
import { ValidationError, type GamesFilter } from './domain.js';

export interface Context { repo: GamesRepository }

/**
 * Schema design notes (also in README):
 * - Every field is documented so an LLM reading the introspected schema knows exactly what it means.
 * - Dates are plain ISO calendar dates (YYYY-MM-DD) in the venue's local timezone; times are HH:mm local.
 *   startsAt keeps the explicit UTC offset so nothing is ambiguous.
 * - `games` never returns null or an unbounded list: it returns a GamesResult with totalCount, the
 *   games and an echo of the normalized filter so the caller can verify what was actually applied.
 * - Availability is a closed enum derived server-side from spotsAvailable; clients never compute it.
 * - Invalid filters fail loudly with a descriptive message instead of silently returning everything.
 */
export const typeDefs = /* GraphQL */ `
  """ISO-8601 calendar date in the venue's local timezone, formatted YYYY-MM-DD (e.g. "2026-08-26")."""
  scalar Date

  """Availability state of a game, derived from spotsAvailable. URGENT = 1-2 spots left, AVAILABLE = 3+ spots, FULL = 0 spots."""
  enum Availability { URGENT AVAILABLE FULL }

  type Venue {
    id: ID!
    "Display name of the venue, e.g. \\"La Catalana\\"."
    name: String!
    address: String
  }

  type Organizer {
    id: ID!
    "First name plus last-name initial, e.g. \\"Johnny C\\"."
    displayName: String!
    avatarUrl: String
  }

  type Game {
    id: ID!
    "Kick-off as ISO-8601 datetime with explicit UTC offset, e.g. \\"2026-08-26T09:15:00+02:00\\"."
    startsAt: String!
    "Calendar date of kick-off in the venue's local timezone (YYYY-MM-DD)."
    date: Date!
    "Local kick-off time, 24h HH:mm."
    startTime: String!
    "Local end time, 24h HH:mm."
    endTime: String!
    "IANA timezone the local date/time refer to, e.g. \\"Europe/Madrid\\"."
    timezone: String!
    durationMinutes: Int!
    venue: Venue!
    "Match format such as \\"8v8\\", \\"9v9\\" or \\"11v11\\"."
    format: String!
    organizer: Organizer!
    "Total player capacity of the game."
    spotsTotal: Int!
    "Number of spots still open. 0 means the game is full."
    spotsAvailable: Int!
    spotsTaken: Int!
    availability: Availability!
    "Whether the game is video recorded."
    isRecorded: Boolean!
    "Price per player in euros."
    priceEur: Float!
  }

  """
  Filter for the games query. All fields are optional and combine with AND.
  Use either "date" (a single day) or "dateFrom"/"dateTo" (inclusive range), not both.
  """
  input GamesFilter {
    "Return only games on this calendar date (YYYY-MM-DD)."
    date: Date
    "Inclusive lower bound on the calendar date (YYYY-MM-DD)."
    dateFrom: Date
    "Inclusive upper bound on the calendar date (YYYY-MM-DD)."
    dateTo: Date
    "Exact venue id (see the venues query)."
    venueId: ID
    "Case- and accent-insensitive substring match on the venue name, e.g. \\"catalana\\"."
    venueName: String
    "Only games with at least this many open spots. Use 1 to hide full games."
    minSpotsAvailable: Int
    "Only games in these availability states."
    availability: [Availability!]
    "Only games kicking off at or after this local time (24h HH:mm, inclusive). Morning = 06:00 to 12:00."
    startTimeFrom: String
    "Only games kicking off before this local time (24h HH:mm, exclusive)."
    startTimeTo: String
  }

  """The filter exactly as the server applied it, after normalization. Lets callers verify their intent."""
  type AppliedFilter {
    dateFrom: Date
    dateTo: Date
    venueId: ID
    venueName: String
    minSpotsAvailable: Int
    availability: [Availability!]
    startTimeFrom: String
    startTimeTo: String
  }

  type GamesResult {
    "Number of games matching the filter (before \\"first\\" is applied)."
    totalCount: Int!
    "Matching games ordered by kick-off time ascending; games that kick off together keep their listing order. Empty list when nothing matches."
    games: [Game!]!
    appliedFilter: AppliedFilter!
  }

  """The fixed 'today' the mock data is built around, so relative dates can be resolved deterministically."""
  type ReferenceDate {
    "Today's calendar date in the mock dataset (YYYY-MM-DD)."
    today: Date!
    "Weekday name of today, e.g. \\"Tuesday\\"."
    weekday: String!
    timezone: String!
    city: String!
    "First and last calendar dates that have any game scheduled."
    firstGameDate: Date
    lastGameDate: Date
  }

  type Query {
    "List games, optionally filtered. Never returns null; an empty list means no games matched."
    games(filter: GamesFilter, first: Int = 100): GamesResult!
    "Fetch one game by id. Returns null when the id does not exist."
    game(id: ID!): Game
    "All venues that host games."
    venues: [Venue!]!
    "The dataset's reference 'today'. Call this before resolving relative dates like 'tomorrow'."
    referenceDate: ReferenceDate!
  }
`;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function userError(e: unknown): never {
  const message = e instanceof Error ? e.message : String(e);
  throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

export const resolvers = {
  Query: {
    games: async (_: unknown, args: { filter?: GamesFilter | null; first?: number | null }, ctx: Context) => {
      const first = args.first ?? 100;
      if (first < 1 || first > 500) userError(new Error('first must be between 1 and 500.'));
      let result;
      try { result = await ctx.repo.listGames(args.filter); } catch (e) {
        if (e instanceof ValidationError) userError(e);
        throw e;
      }
      const { date: _d, ...appliedFilter } = result.filter;
      return { totalCount: result.games.length, games: result.games.slice(0, first), appliedFilter };
    },
    game: (_: unknown, args: { id: string }, ctx: Context) => ctx.repo.getGame(args.id),
    venues: (_: unknown, __: unknown, ctx: Context) => ctx.repo.listVenues(),
    referenceDate: async (_: unknown, __: unknown, ctx: Context) => {
      const c = await ctx.repo.calendar();
      return {
        today: c.referenceDate,
        weekday: WEEKDAYS[new Date(`${c.referenceDate}T12:00:00Z`).getUTCDay()],
        timezone: c.timezone,
        city: c.city,
        firstGameDate: c.firstGameDate,
        lastGameDate: c.lastGameDate,
      };
    },
  },
};

export const schema = createSchema<Context>({ typeDefs, resolvers });
