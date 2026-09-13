import './env.js';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createRepository, PostgresGamesRepository } from './repository.js';

const repo = createRepository();
const yoga = createApp(repo);
const port = Number(process.env.PORT ?? 4000);

createServer(yoga).listen(port, async () => {
  if (!(repo instanceof PostgresGamesRepository)) {
    console.log(`Games API (source: data/games.json) → http://localhost:${port}/graphql`);
    return;
  }
  console.log(`Games API (source: PostgreSQL at ${repo.target}) → http://localhost:${port}/graphql`);
  try {
    console.log(`PostgreSQL connected: ${await repo.countGames()} games`);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.warn(`⚠️  PostgreSQL is not reachable (${reason}). Start it with \`docker compose up -d\`, or clear DATABASE_URL in .env to serve data/games.json.`);
  }
});
