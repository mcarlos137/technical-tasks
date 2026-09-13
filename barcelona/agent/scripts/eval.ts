/**
 * Runs the five required conversations against the live agent loop and checks
 * the tool calls + answers. Requires GEMINI_API_KEY and a running Games API.
 *   npm run eval
 */
import '../src/env.js';
import type { Content } from '@google/genai';
import { runAgentTurn, createModelClient, type AgentTurn } from '../src/agent.js';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY is required'); process.exit(1); }
const ai = createModelClient(apiKey);

interface Case { name: string; turns: string[]; check: (t: AgentTurn[]) => string[] }

const searched = (t: AgentTurn, pred: (a: Record<string, unknown>) => boolean) =>
  t.toolCalls.some((c) => c.name === 'search_games' && pred(c.args));
const has = (t: AgentTurn, re: RegExp) => re.test(t.reply);

const cases: Case[] = [
  {
    name: '1. Simple question (tomorrow morning)',
    turns: ['What games are there tomorrow morning?'],
    check: ([t]) => [
      !searched(t, (a) => a.date === '2026-08-26' || a.date_from === '2026-08-26') && 'did not search 2026-08-26',
      !has(t, /7:15/) && 'missing 07:15 La Catalana',
      !has(t, /10:15/) && 'missing 10:15 Agapito',
      has(t, /18:45/) && 'included an evening game in a morning answer',
      !has(t, /4 spots|4 spot/i) && 'missing "4 spots" for 10:15',
    ].filter(Boolean) as string[],
  },
  {
    name: '2a. Relative date: this weekend',
    turns: ['Anything this weekend?'],
    check: ([t]) => [
      !searched(t, (a) => (a.date_from === '2026-08-29' && a.date_to === '2026-08-30') || a.date === '2026-08-29') && 'weekend not resolved to 2026-08-29..30',
      !has(t, /Can Drag/i) && 'missing Saturday Can Dragó game',
    ].filter(Boolean) as string[],
  },
  {
    name: '2b. Relative date: on Thursday',
    turns: ['What about on Thursday?'],
    check: ([t]) => [
      !searched(t, (a) => a.date === '2026-08-27' || (a.date_from === '2026-08-27' && a.date_to === '2026-08-27')) && 'Thursday not resolved to 2026-08-27',
      !has(t, /19:30/) && 'missing 19:30 La Catalana',
    ].filter(Boolean) as string[],
  },
  {
    name: '3. Grounded: empty result',
    turns: ['Are there any games on 5 September?'],
    check: ([t]) => [
      !searched(t, () => true) && 'did not query the API',
      !has(t, /no (games|pick-up)|there are none|aren't any|are not any|don't have any|couldn't find|no .*scheduled/i) && 'did not plainly say there are none',
    ].filter(Boolean) as string[],
  },
  {
    name: '4. Ambiguity: La Catalana across several days',
    turns: ['Any spots at La Catalana?'],
    check: ([t]) => {
      const perDay = ['27', '29', '31'].filter((d) => new RegExp(`\\b${d}\\b`).test(t.reply)).length >= 2;
      const asks = /which day|what day|which date/i.test(t.reply);
      return [
        !searched(t, (a) => String(a.venue_name ?? '').toLowerCase().includes('catalana')) && 'did not filter by venue',
        !(perDay || asks) && 'neither broke down per day nor asked which day',
      ].filter(Boolean) as string[];
    },
  },
  {
    name: '5. Honest about limits',
    turns: ['Which game has the best players?'],
    check: ([t]) => [
      !has(t, /(don't|do not|doesn't|does not|no|not) (have|include|contain|track|available)|isn't available|not available|can't tell|cannot tell|no information/i) && 'did not state the limitation',
    ].filter(Boolean) as string[],
  },
];

let failures = 0;
for (const c of cases) {
  const history: Content[] = [];
  const turns: AgentTurn[] = [];
  for (const msg of c.turns) turns.push(await runAgentTurn(ai, history, msg));
  const problems = c.check(turns);
  failures += problems.length ? 1 : 0;
  console.log(`\n${problems.length ? '✗' : '✓'} ${c.name}`);
  for (const [i, t] of turns.entries()) {
    console.log(`  user: ${c.turns[i]}`);
    for (const tc of t.toolCalls) console.log(`  tool: ${tc.name}(${JSON.stringify(tc.args)}) → ${(tc.result as any).total_count ?? ''}`);
    console.log(`  agent: ${t.reply.replace(/\n/g, '\n         ')}`);
  }
  for (const p of problems) console.log(`  ! ${p}`);
}
console.log(`\n${cases.length - failures}/${cases.length} cases passed`);
process.exit(failures ? 1 : 0);
