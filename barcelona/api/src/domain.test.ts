import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JsonGamesRepository } from './repository.js';
import { availabilityOf, normalizeFilter } from './domain.js';

const repo = new JsonGamesRepository();

test('availability thresholds', () => {
  assert.equal(availabilityOf(0), 'FULL');
  assert.equal(availabilityOf(1), 'URGENT');
  assert.equal(availabilityOf(2), 'URGENT');
  assert.equal(availabilityOf(3), 'AVAILABLE');
});

test('single date filter returns only that day, sorted by time', async () => {
  const { games } = await repo.listGames({ date: '2026-08-26' });
  assert.equal(games.length, 7);
  assert.deepEqual([...new Set(games.map((g) => g.date))], ['2026-08-26']);
  assert.equal(games[0].startTime, '07:15');
  assert.equal(games.at(-1)!.startTime, '18:45');
});

test('games that kick off together keep their listing order, as in the design', async () => {
  const { games } = await repo.listGames({ date: '2026-08-26', startTimeFrom: '09:15', startTimeTo: '09:16' });
  assert.deepEqual(games.map((g) => g.id), ['g-0826-0915-catalana', 'g-0826-0915-agapito']);
});

test('date range is inclusive', async () => {
  const { games } = await repo.listGames({ dateFrom: '2026-08-29', dateTo: '2026-08-30' });
  assert.deepEqual([...new Set(games.map((g) => g.date))], ['2026-08-29', '2026-08-30']);
});

test('venue name match is accent/case-insensitive and minSpots hides full games', async () => {
  const all = await repo.listGames({ venueName: 'aliga' });
  assert.equal(all.games.length, 4);
  const open = await repo.listGames({ venueName: 'ÀLIGA', minSpotsAvailable: 1 });
  assert.equal(open.games.length, 2);
  assert.ok(open.games.every((g) => g.spotsAvailable >= 1));
});

test('unknown venue yields an empty list, not an error', async () => {
  const { games } = await repo.listGames({ venueName: 'Camp Nou' });
  assert.deepEqual(games, []);
});

test('invalid inputs are rejected', () => {
  assert.throws(() => normalizeFilter({ date: '26/08/2026' }), /Invalid date/);
  assert.throws(() => normalizeFilter({ date: '2026-08-26', dateFrom: '2026-08-25' }), /not both/);
  assert.throws(() => normalizeFilter({ dateFrom: '2026-08-30', dateTo: '2026-08-25' }), /must not be after/);
  assert.throws(() => normalizeFilter({ minSpotsAvailable: -1 }), /non-negative/);
});

test('getGame resolves venue, organizer and derived fields', async () => {
  const g = await repo.getGame('g-0826-0915-agapito');
  assert.ok(g);
  assert.equal(g.venue.name, 'Agapito Fernández');
  assert.equal(g.organizer.displayName, 'Johnny C');
  assert.equal(g.availability, 'URGENT');
  assert.equal(g.endTime, '10:15');
  assert.equal(await repo.getGame('nope'), null);
});

test('start time window selects the morning', async () => {
  const { games } = await repo.listGames({ date: '2026-08-26', startTimeFrom: '06:00', startTimeTo: '12:00' });
  assert.deepEqual(games.map((g) => g.startTime), ['07:15', '08:15', '09:15', '09:15', '10:15']);
  assert.throws(() => normalizeFilter({ startTimeFrom: '9am' }), /HH:mm/);
});
