import './env.js';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Content } from '@google/genai';
import { runAgentTurn, createModelClient, MODEL } from './agent.js';
import { GAMES_API_URL } from './gamesApi.js';

const apiKey = process.env.GEMINI_API_KEY;
const MISSING_KEY = 'GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey, put it in agent/.env and restart.';
if (!apiKey) console.warn(`⚠️  ${MISSING_KEY}`);
const ai = apiKey ? createModelClient(apiKey) : null;
const port = Number(process.env.PORT ?? 3001);
const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(here, '..', 'public', 'index.html'), 'utf8');

// In-memory chat sessions (fine for a local demo).
const sessions = new Map<string, Content[]>();

async function readJson(req: import('node:http').IncomingMessage): Promise<any> {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64_000) throw new Error('Body too large');
  }
  return JSON.parse(body || '{}');
}

createServer(async (req, res) => {
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(indexHtml);
    }
    if (req.method === 'POST' && req.url === '/api/chat') {
      if (!ai) return send(503, { error: MISSING_KEY });
      const { sessionId, message } = await readJson(req);
      if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
        return send(400, { error: 'message must be a non-empty string (max 2000 chars)' });
      }
      const id = typeof sessionId === 'string' && sessions.has(sessionId) ? sessionId : randomUUID();
      const history = sessions.get(id) ?? [];
      sessions.set(id, history);
      const turn = await runAgentTurn(ai, history, message.trim());
      return send(200, { sessionId: id, ...turn });
    }
    if (req.method === 'POST' && req.url === '/api/reset') {
      const { sessionId } = await readJson(req);
      sessions.delete(sessionId);
      return send(200, { ok: true });
    }
    send(404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    send(500, { error: e instanceof Error ? e.message : String(e) });
  }
}).listen(port, () => {
  console.log(`Games agent (${MODEL}) → http://localhost:${port}  (games API: ${GAMES_API_URL})`);
});
