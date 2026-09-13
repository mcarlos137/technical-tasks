import { createYoga } from 'graphql-yoga';
import { schema, type Context } from './schema.js';
import { createRepository, type GamesRepository } from './repository.js';
import { graphiqlTabs } from './graphiql-examples.js';

export function createApp(repo: GamesRepository = createRepository()) {
  return createYoga<{}, Context>({
    schema,
    context: () => ({ repo }),
    graphqlEndpoint: '/graphql',
    landingPage: false,
    graphiql: { title: 'CeleBreak Games API', defaultTabs: graphiqlTabs },
    cors: { origin: '*', methods: ['GET', 'POST', 'OPTIONS'] },
    maskedErrors: false,
  });
}
