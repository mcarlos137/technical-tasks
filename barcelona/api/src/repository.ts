import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyFilter, normalizeFilter, resolveGame,
  type Dataset, type Game, type GamesFilter, type GameRecord, type Venue,
} from './domain.js';

export interface GamesRepository {
  readonly source: 'json' | 'supabase';
  dataset(): Promise<Dataset>;
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
  private readonly data: Dataset;
  private readonly resolved: Game[];
  constructor(data: Dataset = loadSeed()) {
    this.data = data;
    this.resolved = data.games.map((g) => resolveGame(g, data));
  }
  async dataset() { return this.data; }
  async listGames(filter?: GamesFilter | null) {
    const f = normalizeFilter(filter);
    return { games: applyFilter(this.resolved, f), filter: f };
  }
  async getGame(id: string) { return this.resolved.find((g) => g.id === id) ?? null; }
  async listVenues() { return this.data.venues; }
}

/**
 * Supabase-backed repository. Tables: venues, organizers, games (see supabase/migrations).
 * The dataset is tiny, so rows are loaded and filtered with the same pure functions
 * as the JSON repository; this keeps both sources behaviourally identical.
 */
export class SupabaseGamesRepository implements GamesRepository {
  readonly source = 'supabase' as const;
  private client: SupabaseClient | null = null;
  private cache: { at: number; data: Dataset } | null = null;
  constructor(private readonly url: string, private readonly serviceKey: string, private readonly seed: Dataset = loadSeed()) {}
  /** The SDK is loaded lazily so JSON mode has no Supabase dependency at runtime. */
  private async db(): Promise<SupabaseClient> {
    if (!this.client) {
      const { createClient } = await import('@supabase/supabase-js');
      this.client = createClient(this.url, this.serviceKey, { auth: { persistSession: false } });
    }
    return this.client;
  }
  async dataset(): Promise<Dataset> {
    if (this.cache && Date.now() - this.cache.at < 15_000) return this.cache.data;
    const db = await this.db();
    const [venues, organizers, games] = await Promise.all([
      db.from('venues').select('id,name,address').order('id'),
      db.from('organizers').select('id,display_name,avatar_url').order('id'),
      db.from('games').select('*').order('starts_at'),
    ]);
    for (const r of [venues, organizers, games]) if (r.error) throw new Error(`Supabase: ${r.error.message}`);
    const data: Dataset = {
      referenceDate: this.seed.referenceDate,
      timezone: this.seed.timezone,
      city: this.seed.city,
      venues: (venues.data ?? []) as Venue[],
      organizers: (organizers.data ?? []).map((o) => ({ id: o.id, displayName: o.display_name, avatarUrl: o.avatar_url })),
      games: (games.data ?? []).map((g): GameRecord => ({
        id: g.id,
        startsAt: g.starts_at_local,
        durationMinutes: g.duration_minutes,
        venueId: g.venue_id,
        format: g.format,
        organizerId: g.organizer_id,
        spotsTotal: g.spots_total,
        spotsAvailable: g.spots_available,
        isRecorded: g.is_recorded,
        priceEur: Number(g.price_eur),
      })),
    };
    this.cache = { at: Date.now(), data };
    return data;
  }
  private async resolvedGames() {
    const data = await this.dataset();
    return data.games.map((g) => resolveGame(g, data));
  }
  async listGames(filter?: GamesFilter | null) {
    const f = normalizeFilter(filter);
    return { games: applyFilter(await this.resolvedGames(), f), filter: f };
  }
  async getGame(id: string) { return (await this.resolvedGames()).find((g) => g.id === id) ?? null; }
  async listVenues() { return (await this.dataset()).venues; }
}

export function createRepository(env: NodeJS.ProcessEnv = process.env): GamesRepository {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return new SupabaseGamesRepository(url, key);
  return new JsonGamesRepository();
}
