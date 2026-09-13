import './env.js';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createRepository } from './repository.js';

const repo = createRepository();
const yoga = createApp(repo);
const port = Number(process.env.PORT ?? 4000);

createServer(yoga).listen(port, () => {
  console.log(`Games API (source: ${repo.source}) → http://localhost:${port}/graphql`);
});
