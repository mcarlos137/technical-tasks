import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import {
  applyFilter, normalizeFilter, resolveGame, toGame, URGENT_THRESHOLD,
  type Dataset, type Game, type GamesFilter, type Venue,
} from './domain.js';

/** The fixed "today" the mock data is built around, plus the first and last dates that have games. */
export interface Calendar {
  referenceDate: string;
  timezone: string;
  city: string;
  firstGameDate: string | null;
  lastGameDate: string | null;
}

export interface GamesRepository {
  readonly source: 'json' | 'postgres';
  calendar(): Promise<Calendar>;
  listGames(filter?: GamesFilter | null): Promise<{ games: Game[]; filter: Required<GamesFilter> }>;
  getGame(id: string): Promise<Game | null>;
  listVenues(): Promise<Venue[]>;
}

const here = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(here, '..', 'data', 'games.json');

export function loadSeed(): Dataset {
  return JSON.parse(readFileSync(SEED_PATH, 'utf8')) as Dataset;
}

/** In-memory repository backed by data/games.json. */
export class JsonGamesRepository implements GamesRepository {
  readonly source = 'json' as const;
  private readonly resolved: Game[];
  constructor(private readonly data: Dataset = loadSeed()) {
    this.resolved = data.games.map((g) => resolveGame(g, data));
  }
  async calendar(): Promise<Calendar> {
    const dates = this.resolved.map((g) => g.date).sort();
    const { referenceDate, timezone, city } = this.data;
    return { referenceDate, timezone, city, firstGameDate: dates[0] ?? null, lastGameDate: dates.at(-1) ?? null };
  }
  async listGames(filter?: GamesFilter | null) {
    const f = normalizeFilter(filter);
    return { games: applyFilter(this.resolved, f), filter: f };
  }
  async getGame(id: string) { return this.resolved.find((g) => g.id === id) ?? null; }
  async listVenues() { return this.data.venues; }
}

/** Every API session is read-only: the API never writes, so a bug or an injection can't either. */
export const READ_ONLY_SESSION = '-c default_transaction_read_only=on';

interface GameRow {
  id: string;
  starts_at_local: string;
  duration_minutes: number;
  venue_id: string;
  format: string;
  organizer_id: string;
  spots_total: number;
  spots_available: number;
  is_recorded: boolean;
  price_eur: string; // numeric arrives as a string
  venue_name: string;
  venue_address: string | null;
  organizer_name: string;
  organizer_avatar_url: string | null;
}

const SELECT_GAMES = `
  select g.id, g.starts_at_local, g.duration_minutes, g.venue_id, g.format, g.organizer_id,
         g.spots_total, g.spots_available, g.is_recorded, g.price_eur,
         v.name as venue_name, v.address as venue_address,
         o.display_name as organizer_name, o.avatar_url as organizer_avatar_url
  from games g
  join venues v on v.id = g.venue_id
  join organizers o on o.id = g.organizer_id`;

/**
 * PostgreSQL repository (schema in db/migrations). Filters run in SQL with bound parameters,
 * and postgres.test.ts checks that every filter returns exactly what the JSON repository does.
 * The reference "today", timezone and city are properties of the mock dataset, so they still
 * come from data/games.json; a live system would use the current date in Europe/Madrid.
 */
export class PostgresGamesRepository implements GamesRepository {
  readonly source = 'postgres' as const;
  /** host:port/database, for logs. Never includes the password. */
  readonly target: string;
  private readonly pool: pg.Pool;

  constructor(connectionString: string, private readonly seed: Dataset = loadSeed()) {
    const url = new URL(connectionString);
    this.target = `${url.hostname}:${url.port || 5432}${url.pathname}`;
    this.pool = new pg.Pool({ connectionString, max: 5, options: READ_ONLY_SESSION });
  }

  private toGame(r: GameRow): Game {
    return toGame(
      {
        id: r.id,
        startsAt: r.starts_at_local,
        durationMinutes: r.duration_minutes,
        venueId: r.venue_id,
        format: r.format,
        organizerId: r.organizer_id,
        spotsTotal: r.spots_total,
        spotsAvailable: r.spots_available,
        isRecorded: r.is_recorded,
        priceEur: Number(r.price_eur),
      },
      { id: r.venue_id, name: r.venue_name, address: r.venue_address },
      { id: r.organizer_id, displayName: r.organizer_name, avatarUrl: r.organizer_avatar_url },
      this.seed.timezone,
    );
  }

  async calendar(): Promise<Calendar> {
    const { rows } = await this.pool.query<{ first: string | null; last: string | null }>(
      'select min(local_date) as first, max(local_date) as last from games',
    );
    const { referenceDate, timezone, city } = this.seed;
    return { referenceDate, timezone, city, firstGameDate: rows[0].first, lastGameDate: rows[0].last };
  }

  async listGames(filter?: GamesFilter | null) {
    const f = normalizeFilter(filter);
    const { rows } = await this.pool.query<GameRow>(
      `${SELECT_GAMES}
       where ($1::text is null or g.local_date >= $1)
         and ($2::text is null or g.local_date <= $2)
         and ($3::text is null or g.venue_id = $3)
         and ($4::text is null or strpos(unaccent(lower(v.name)), unaccent(lower($4))) > 0)
         and ($5::int is null or g.spots_available >= $5)
         and ($6::text[] is null or (case when g.spots_available <= 0 then 'FULL'
                                          when g.spots_available <= $9::int then 'URGENT'
                                          else 'AVAILABLE' end) = any($6))
         and ($7::text is null or g.local_start_time >= $7)
         and ($8::text is null or g.local_start_time < $8)
       order by g.starts_at_local collate "C", g.id collate "C"`,
      [f.dateFrom, f.dateTo, f.venueId, f.venueName, f.minSpotsAvailable, f.availability,
        f.startTimeFrom, f.startTimeTo, URGENT_THRESHOLD],
    );
    return { games: rows.map((r) => this.toGame(r)), filter: f };
  }

  async getGame(id: string) {
    const { rows } = await this.pool.query<GameRow>(`${SELECT_GAMES} where g.id = $1`, [id]);
    return rows[0] ? this.toGame(rows[0]) : null;
  }

  async listVenues(): Promise<Venue[]> {
    const { rows } = await this.pool.query<Venue>('select id, name, address from venues order by id');
    return rows;
  }

  /** Number of games in the database; the server logs it at startup to show the connection works. */
  async countGames(): Promise<number> {
    const { rows } = await this.pool.query<{ n: number }>('select count(*)::int as n from games');
    return rows[0].n;
  }

  async close() { await this.pool.end(); }
}

export function createRepository(env: NodeJS.ProcessEnv = process.env): GamesRepository {
  return env.DATABASE_URL ? new PostgresGamesRepository(env.DATABASE_URL) : new JsonGamesRepository();
}
