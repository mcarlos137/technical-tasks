import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { JsonGamesRepository } from './repository.js';
import { graphiqlTabs } from './graphiql-examples.js';

const app = createApp(new JsonGamesRepository());

async function run(tab: { query: string; variables?: string }) {
  const res = await app.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: tab.query, variables: tab.variables ? JSON.parse(tab.variables) : undefined }),
  });
  return (await res.json()) as { data?: any; errors?: Array<{ message: string; extensions?: { code?: string } }> };
}

test('every GraphiQL example tab runs, and each returns what its comment promises', async () => {
  const [morning, catalana, byId, badDate] = await Promise.all(graphiqlTabs.map(run));
  assert.equal(morning.errors, undefined);
  assert.equal(morning.data.games.totalCount, 5);
  assert.equal(catalana.errors, undefined);
  assert.ok(catalana.data.games.totalCount > 0);
  assert.equal(byId.errors, undefined);
  assert.equal(byId.data.game.venue.name, 'Agapito Fernández');
  assert.equal(badDate.errors?.[0].extensions?.code, 'BAD_USER_INPUT');
});

test('GraphiQL opens with the example tabs', async () => {
  const res = await app.fetch('http://localhost/graphql', { headers: { accept: 'text/html' } });
  const html = await res.text();
  for (const name of ['TomorrowMorning', 'SpotsAtLaCatalana', 'GameById', 'BadDate']) assert.ok(html.includes(name), name);
});
