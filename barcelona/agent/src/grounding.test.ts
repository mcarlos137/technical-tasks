import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectFacts, ungroundedMentions, unsupportedClaims } from './grounding.js';

const search = {
  applied_filter: { dateFrom: '2026-08-26', dateTo: '2026-08-26', startTimeFrom: '06:00', startTimeTo: '12:00' },
  total_count: 2,
  games_by_date: [{ date: '2026-08-26', weekday: 'Wednesday', games: [
    { game_id: 'a', start_time: '09:15', end_time: '10:15', venue: 'Agapito Fernández', format: '8v8', spots_available: 2, spots_total: 16, price_eur: 9.9 },
    { game_id: 'b', start_time: '10:15', end_time: '11:15', venue: 'Agapito Fernández', format: '8v8', spots_available: 4, spots_total: 16, price_eur: 9.9 },
  ] }],
};
const venues = ['La Catalana', 'Agapito Fernández'];

test('a reply that only quotes tool results passes', () => {
  const reply = 'Tomorrow morning (06:00 to 12:00):\n- 9:15 – 10:15 Agapito Fernandez (8v8), last 2 spots, €9.90\n- 10:15 Agapito Fernández (8 v 8), 4 spots left, 9,90 €';
  assert.deepEqual(ungroundedMentions(reply, collectFacts([search]), venues), []);
  assert.deepEqual(unsupportedClaims(reply), []);
});

test('flags times, formats, prices, spot counts and venues that no tool returned', () => {
  const reply = '07:45 at La Catalana (7v7), 3 spots left for €12.';
  assert.deepEqual(ungroundedMentions(reply, collectFacts([search]), venues), [
    'time 07:45 is not in any tool result',
    'format 7v7 is not in any tool result',
    'price €12 is not in any tool result',
    '"3 spots" is not in any tool result',
    'venue "La Catalana" is mentioned without a tool result',
  ]);
});

test('catches the ungrounded "best players" answer from the first live run', () => {
  const reply = "Information about player skill levels, ratings, or who the best players are isn't available. CeleBreak pick-up games are generally open to players of all skill levels.\n\nI can help you find upcoming games by date, venue, kick-off time, or format (e.g., 7v7, 8v8).";
  assert.deepEqual(ungroundedMentions(reply, collectFacts([]), venues), [
    'format 7v7 is not in any tool result',
    'format 8v8 is not in any tool result',
  ]);
  assert.deepEqual(unsupportedClaims(reply), ['reply claims who the games are suitable for']);
});

test('saying the data lacks skill information is not a claim', () => {
  assert.deepEqual(unsupportedClaims("The data doesn't include any skill level information, so I can't tell who the best players are."), []);
});
