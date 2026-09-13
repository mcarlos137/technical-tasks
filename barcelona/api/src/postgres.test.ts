import './env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { JsonGamesRepository, PostgresGamesRepository, READ_ONLY_SESSION } from './repository.js';
import type { GamesFilter } from './domain.js';

// Runs when DATABASE_URL is set (for example from .env after `docker compose up -d`).
const url = process.env.DATABASE_URL;
const skip = url ? false : 'DATABASE_URL is not set; start PostgreSQL with `docker compose up -d`';

const FILTERS: GamesFilter[] = [
  {},
  { date: '2026-08-26' },
  { dateFrom: '2026-08-29', dateTo: '2026-08-30' },
  { date: '2026-09-05' },
  { venueName: 'aliga' },
  { venueName: 'CATALANA' },
  { venueName: 'fernandez' },
  { venueName: '%' },
  { venueId: 'el-carmel' },
  { minSpotsAvailable: 1 },
  { minSpotsAvailable: 5 },
  { availability: ['URGENT'] },
  { availability: ['FULL', 'AVAILABLE'] },
  { startTimeFrom: '06:00', startTimeTo: '12:00' },
  { startTimeFrom: '18:00' },
  { date: '2026-08-26', venueName: 'agapito', minSpotsAvailable: 1, startTimeTo: '12:00' },
];

test('PostgreSQL answers every query exactly like the JSON file', { skip }, async (t) => {
  const json = new JsonGamesRepository();
  const db = new PostgresGamesRepository(url!);
  t.after(() => db.close());

  for (const f of FILTERS) {
    assert.deepEqual(await db.listGames(f), await json.listGames(f), JSON.stringify(f));
  }
  for (const { id } of (await json.listGames()).games) {
    assert.deepEqual(await db.getGame(id), await json.getGame(id), id);
  }
  assert.equal(await db.getGame('no-such-game'), null);
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  assert.deepEqual((await db.listVenues()).sort(byId), [...(await json.listVenues())].sort(byId));
  assert.deepEqual(await db.calendar(), await json.calendar());
});

test('API sessions cannot write', { skip }, async (t) => {
  const client = new pg.Client({ connectionString: url, options: READ_ONLY_SESSION });
  await client.connect();
  t.after(() => client.end());
  await assert.rejects(client.query('update games set spots_available = 0'), /read-only transaction/);
});
