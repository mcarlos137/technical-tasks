import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, type Content } from '@google/genai';
import { describeModelError, runAgentTurn, type ModelClient } from './agent.js';

/** Scripted model: first asks for a tool, then answers from the tool result it was given. */
function scriptedModel(steps: Array<(contents: Content[]) => any>): ModelClient & { calls: Content[][] } {
  const calls: Content[][] = [];
  let i = 0;
  return {
    calls,
    models: {
      generateContent: async ({ contents }: { contents: Content[] }) => {
        calls.push(structuredClone(contents));
        return steps[i++](contents);
      },
    } as any,
  };
}

test('executes tool calls, feeds results back, and returns the final text', async () => {
  const model = scriptedModel([
    () => ({
      candidates: [{ content: { role: 'model', parts: [{ functionCall: { id: 'c1', name: 'search_games', args: { date: '2026-08-26' } } }] } }],
      functionCalls: [{ id: 'c1', name: 'search_games', args: { date: '2026-08-26' } }],
    }),
    (contents) => {
      const last = contents.at(-1)!;
      const fr = last.parts![0].functionResponse!;
      assert.equal(fr.name, 'search_games');
      assert.equal((fr.response as any).total_count, 1);
      return { candidates: [{ content: { role: 'model', parts: [{ text: '9:15 at Agapito' }] } }], text: '9:15 at Agapito' };
    },
  ]);
  const history: Content[] = [];
  const toolArgs: unknown[] = [];
  const turn = await runAgentTurn(model, history, 'games tomorrow?', {
    systemInstruction: 'test',
    runTool: async (name, args) => { toolArgs.push({ name, args }); return { total_count: 1 }; },
  });
  assert.equal(turn.reply, '9:15 at Agapito');
  assert.deepEqual(toolArgs, [{ name: 'search_games', args: { date: '2026-08-26' } }]);
  assert.equal(turn.toolCalls.length, 1);
  // user msg, model call, function response, model answer
  assert.deepEqual(history.map((c) => c.role), ['user', 'model', 'user', 'model']);
});

test('stops after too many tool rounds instead of looping forever', async () => {
  const loop = () => ({
    candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'list_venues', args: {} } }] } }],
    functionCalls: [{ name: 'list_venues', args: {} }],
  });
  const model = scriptedModel(Array.from({ length: 20 }, () => loop));
  const turn = await runAgentTurn(model, [], 'hi', { systemInstruction: 't', runTool: async () => ({ venues: [] }) });
  assert.match(turn.reply, /too many tool calls/);
  assert.ok(model.calls.length <= 7);
});

/** A 429 shaped like Gemini's: the quota that ran out, plus how long to wait. */
function quotaError(quotaId: string): ApiError {
  const body = { error: { code: 429, details: [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId }] },
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '8s' },
  ] } };
  return new ApiError({ status: 429, message: `got status: 429 Too Many Requests. ${JSON.stringify(body)}` });
}
const perMinute = () => quotaError('GenerateRequestsPerMinutePerProjectPerModel-FreeTier');
const perDay = () => quotaError('GenerateRequestsPerDayPerProjectPerModel-FreeTier');
const answer = (text: string) => ({ candidates: [{ content: { role: 'model', parts: [{ text }] } }], text });

test('a per-minute 429 waits as long as Gemini asks, then retries', async () => {
  const model = scriptedModel([() => { throw perMinute(); }, () => answer('No games that day.')]);
  const waits: number[] = [];
  const turn = await runAgentTurn(model, [], 'games on 5 Sep?', {
    systemInstruction: 't',
    sleep: async (ms) => { waits.push(ms); },
  });
  assert.equal(turn.reply, 'No games that day.');
  assert.deepEqual(waits, [8000]);
});

test('the daily limit fails at once and rolls the half-finished turn back', async () => {
  const history: Content[] = [
    { role: 'user', parts: [{ text: 'hi' }] },
    { role: 'model', parts: [{ text: 'Hello!' }] },
  ];
  const before = structuredClone(history);
  const model = scriptedModel([
    () => ({
      candidates: [{ content: { role: 'model', parts: [{ functionCall: { id: 'c1', name: 'search_games', args: {} } }] } }],
      functionCalls: [{ id: 'c1', name: 'search_games', args: {} }],
    }),
    () => { throw perDay(); },
  ]);
  const waits: number[] = [];
  await assert.rejects(
    runAgentTurn(model, history, 'games tomorrow?', {
      systemInstruction: 't',
      runTool: async () => ({ total_count: 0 }),
      sleep: async (ms) => { waits.push(ms); },
    }),
    ApiError,
  );
  assert.deepEqual(waits, [], 'no point waiting for a quota that refills at midnight Pacific');
  assert.equal(model.calls.length, 2);
  assert.deepEqual(history, before, 'the next question starts from a clean session');
});

test('describeModelError explains quota and overload errors and leaves the rest alone', () => {
  assert.match(describeModelError(perDay())!.error, /used up for today/);
  assert.equal(describeModelError(perDay())!.status, 429);
  assert.match(describeModelError(perMinute())!.error, /per minute/);
  assert.equal(describeModelError(new ApiError({ status: 503, message: 'high demand' }))!.status, 503);
  assert.equal(describeModelError(new ApiError({ status: 400, message: 'bad request' })), null);
  assert.equal(describeModelError(new Error('fetch failed')), null);
});
