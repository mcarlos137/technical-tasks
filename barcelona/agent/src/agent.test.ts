import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Content } from '@google/genai';
import { runAgentTurn, type ModelClient } from './agent.js';

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
