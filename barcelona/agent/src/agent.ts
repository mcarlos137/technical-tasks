import { ApiError, GoogleGenAI, type Content } from '@google/genai';
import { toolDeclarations, runTool } from './tools.js';
import { buildDateContext } from './calendar.js';
import { fetchReferenceDate } from './gamesApi.js';

// Alias that tracks Google's current Flash Lite model, so the demo keeps working as versions are retired.
// Flash Lite is the default because its free tier allows far more requests per minute and per day than
// Flash; set GEMINI_MODEL=gemini-flash-latest for the stronger model.
export const MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-lite-latest';
const MAX_TOOL_ROUNDS = 6;

/**
 * Gemini client with retries. The free tier often answers 503 ("high demand") for a few seconds,
 * so the SDK retries 408 and 5xx with exponential backoff (about 2s, 4s, 8s, 16s). 429 is left
 * out on purpose: withQuotaRetry handles it, because only Gemini's reply says how long to wait.
 */
export function createModelClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      retryOptions: { attempts: 5, initialDelay: 2, maxDelay: 16, httpStatusCodes: [408, 500, 502, 503, 504] },
    },
  });
}

const QUOTA_ATTEMPTS = 3;
const MAX_QUOTA_WAIT_MS = 60_000;

/**
 * How long a per-minute 429 asks us to wait, read from its RetryInfo. Null for the daily limit
 * (the quota only refills at midnight Pacific time) and for any other error.
 */
export function quotaRetryDelayMs(e: unknown): number | null {
  if (!(e instanceof ApiError) || e.status !== 429 || /PerDay/.test(e.message)) return null;
  const m = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(e.message);
  return m ? Math.ceil(Number(m[1]) * 1000) : 10_000;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Waits out per-minute 429s, which clear within a minute. The daily limit fails at once. */
async function withQuotaRetry<T>(call: () => Promise<T>, sleep: (ms: number) => Promise<void>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (e) {
      const delay = quotaRetryDelayMs(e);
      if (delay === null || delay > MAX_QUOTA_WAIT_MS || attempt >= QUOTA_ATTEMPTS) throw e;
      await sleep(delay);
    }
  }
}

export interface ToolTrace { name: string; args: Record<string, unknown>; result: Record<string, unknown> }
export interface AgentTurn { reply: string; toolCalls: ToolTrace[]; modelVersion?: string }

/**
 * Turns the free tier's quota and overload errors into a status and message the chat can show,
 * instead of a 500 carrying Gemini's raw JSON. Returns null for anything else.
 */
export function describeModelError(e: unknown): { status: number; error: string } | null {
  if (!(e instanceof ApiError)) return null;
  if (e.status === 429) {
    return /PerDay/.test(e.message)
      ? { status: 429, error: `The free Gemini quota for ${MODEL} is used up for today. It resets at midnight Pacific time; until then, set GEMINI_MODEL to another model or use a paid key.` }
      : { status: 429, error: 'The free Gemini quota allows only a few requests per minute. Wait a minute and ask again.' };
  }
  if (e.status === 503) return { status: 503, error: 'Gemini is overloaded right now. Try again in a moment.' };
  return null;
}

export async function systemPrompt(): Promise<string> {
  const ref = await fetchReferenceDate();
  return `You are the pick-up games assistant for CeleBreak in ${ref.city}. You answer questions about pick-up football games using ONLY the tools provided.

${buildDateContext(ref.today)}
Games are scheduled in the dataset from ${ref.firstGameDate} to ${ref.lastGameDate}.

RULES
1. Grounding: every game, venue, time, organizer, price and spot count you mention must come from a tool result in this conversation. Never invent, estimate or "fill in" anything. If a tool returns no games, say plainly that there are none for that query (you may offer to check another day).
2. Always call search_games before answering any question about games or availability, even if you think you know the answer. Convert relative dates to concrete YYYY-MM-DD dates using the calendar above; mention the concrete date in your answer (e.g. "Tomorrow, Wednesday 26 August").
3. Ambiguity: if the user's question does not pin down a day (e.g. "Any spots at La Catalana?") and results span several dates, break the answer down per day with a short heading per date, or ask which day they mean. Never silently answer for one arbitrary day.
4. Honest limits: the data contains ONLY date, start/end time, venue name and address, format (e.g. 8v8), organizer display name, total spots, spots available, availability state, whether the game is recorded, and price in euros. It contains NOTHING about player names, skill levels, ratings, "best" players, weather, parking, facilities, results or how to book. If asked about those, say clearly that this information isn't available rather than guessing. Do not add general statements about CeleBreak, its games or its players (for example "games are open to all levels" or "games usually have referees"): nothing in the data supports them. You may offer to search by date, time or venue, but never give example formats, venues, times or prices unless they came from a tool result in this conversation.
5. Spots: spots_available = 0 means the game is FULL. Report spot counts exactly as returned (e.g. "2 spots left", "Full").
6. Format answers as a short list: time — venue (format) — spots. Use 24h local times. Be concise. Reply in the user's language.
7. You cannot book, cancel or modify games. If asked, say so.`;
}

/** The slice of the Gemini SDK the loop needs; lets tests substitute a scripted model. */
export type ModelClient = Pick<GoogleGenAI, 'models'>;

export interface AgentDeps {
  systemInstruction?: string;
  runTool?: typeof runTool;
  /** Used while waiting out a per-minute 429; tests pass a fake. */
  sleep?: (ms: number) => Promise<void>;
}

/** One agent turn: sends the user message, executes tool calls until the model produces text. */
export async function runAgentTurn(
  ai: ModelClient,
  history: Content[],
  userMessage: string,
  deps: AgentDeps = {},
): Promise<AgentTurn> {
  const systemInstruction = deps.systemInstruction ?? (await systemPrompt());
  const exec = deps.runTool ?? runTool;
  const sleep = deps.sleep ?? wait;
  // A failed turn (usually a 429 after the retries) is rolled back, so the session never keeps
  // a question without an answer or a tool call without its result.
  const start = history.length;
  history.push({ role: 'user', parts: [{ text: userMessage }] });
  try {
    const toolCalls: ToolTrace[] = [];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await withQuotaRetry(() => ai.models.generateContent({
        model: MODEL,
        contents: history,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      }), sleep);
      const content = response.candidates?.[0]?.content;
      if (content) history.push(content);
      const calls = response.functionCalls ?? [];
      if (calls.length === 0) {
        return { reply: response.text?.trim() || "Sorry, I couldn't produce an answer.", toolCalls, modelVersion: response.modelVersion };
      }
      const parts = [];
      for (const call of calls) {
        const args = (call.args ?? {}) as Record<string, unknown>;
        const result = await exec(call.name ?? '', args);
        toolCalls.push({ name: call.name ?? '', args, result });
        parts.push({ functionResponse: { id: call.id, name: call.name, response: result } });
      }
      history.push({ role: 'user', parts });
    }
    return { reply: 'Sorry, I could not complete that request (too many tool calls).', toolCalls };
  } catch (e) {
    history.length = start;
    throw e;
  }
}
