import { Type, type FunctionDeclaration } from '@google/genai';
import { gql } from './gamesApi.js';
import { weekdayOf } from './calendar.js';

/**
 * Tools exposed to the LLM. Design rules:
 * - Narrow, explicit, typed parameters with formats spelled out (YYYY-MM-DD, HH:mm).
 * - Results are compact, pre-grouped by date and carry the filter the server actually applied,
 *   so the model can see what it asked for and cannot silently answer for "an arbitrary day".
 * - Empty results and errors come back as structured data with an instruction, never as an exception.
 */

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_games',
    description:
      'Search pick-up football games. All parameters are optional and combine with AND. ' +
      'Resolve relative dates ("tomorrow", "this weekend", "on Thursday") to concrete YYYY-MM-DD dates using the calendar in the system prompt BEFORE calling. ' +
      'Use "date" for one day or "date_from"/"date_to" for an inclusive range, never both. ' +
      'Results are grouped by date and sorted by kick-off time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: 'Single calendar date, YYYY-MM-DD.' },
        date_from: { type: Type.STRING, description: 'Inclusive range start, YYYY-MM-DD.' },
        date_to: { type: Type.STRING, description: 'Inclusive range end, YYYY-MM-DD.' },
        venue_name: { type: Type.STRING, description: 'Venue name or part of it, case/accent-insensitive, e.g. "catalana".' },
        min_spots_available: { type: Type.INTEGER, description: 'Only games with at least this many open spots. Use 1 when the user wants games they can still join.' },
        start_time_from: { type: Type.STRING, description: 'Earliest local kick-off time, 24h HH:mm, inclusive.' },
        start_time_to: { type: Type.STRING, description: 'Latest local kick-off time, 24h HH:mm, exclusive.' },
      },
    },
  },
  {
    name: 'get_game_details',
    description: 'Fetch the full details of one game by its game_id (as returned by search_games).',
    parameters: {
      type: Type.OBJECT,
      properties: { game_id: { type: Type.STRING, description: 'The game_id from a search_games result.' } },
      required: ['game_id'],
    },
  },
  {
    name: 'list_venues',
    description: 'List every venue that hosts games (id, name, address). Use it to check whether a venue the user mentions exists.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

const GAME_FIELDS = `id date startTime endTime durationMinutes format spotsTotal spotsAvailable availability isRecorded priceEur
  venue { id name address } organizer { displayName }`;

interface ApiGame {
  id: string; date: string; startTime: string; endTime: string; durationMinutes: number; format: string;
  spotsTotal: number; spotsAvailable: number; availability: string; isRecorded: boolean; priceEur: number;
  venue: { id: string; name: string; address: string | null }; organizer: { displayName: string };
}

function compact(g: ApiGame) {
  return {
    game_id: g.id,
    start_time: g.startTime,
    end_time: g.endTime,
    venue: g.venue.name,
    format: g.format,
    organizer: g.organizer.displayName,
    spots_available: g.spotsAvailable,
    spots_total: g.spotsTotal,
    availability: g.availability,
    is_recorded: g.isRecorded,
    price_eur: g.priceEur,
  };
}

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

async function searchGames(args: Args) {
  const filter = {
    date: str(args.date),
    dateFrom: str(args.date_from),
    dateTo: str(args.date_to),
    venueName: str(args.venue_name),
    minSpotsAvailable: typeof args.min_spots_available === 'number' ? Math.trunc(args.min_spots_available) : undefined,
    startTimeFrom: str(args.start_time_from),
    startTimeTo: str(args.start_time_to),
  };
  const data = await gql<{ games: { totalCount: number; appliedFilter: Record<string, unknown>; games: ApiGame[] } }>(
    `query($filter: GamesFilter) { games(filter: $filter, first: 100) {
       totalCount appliedFilter { dateFrom dateTo venueName minSpotsAvailable startTimeFrom startTimeTo } games { ${GAME_FIELDS} } } }`,
    { filter },
  );
  const byDate = new Map<string, ReturnType<typeof compact>[]>();
  for (const g of data.games.games) {
    if (!byDate.has(g.date)) byDate.set(g.date, []);
    byDate.get(g.date)!.push(compact(g));
  }
  const games_by_date = [...byDate].map(([date, games]) => ({ date, weekday: weekdayOf(date), games }));
  const applied = Object.fromEntries(Object.entries(data.games.appliedFilter).filter(([, v]) => v != null));
  let note: string;
  if (data.games.totalCount === 0) {
    note = 'NO games match these filters. Tell the user plainly that there are none. Do not invent or suggest games that are not in a tool result.';
  } else if (games_by_date.length > 1) {
    note = `Results span ${games_by_date.length} different dates. If the user did not name a specific day, break the answer down per day (or ask which day) — never answer for just one of them.`;
  } else {
    note = 'Answer using only these games and their exact times, venues and spot counts.';
  }
  return { applied_filter: applied, total_count: data.games.totalCount, games_by_date, note };
}

async function getGameDetails(args: Args) {
  const id = str(args.game_id);
  if (!id) return { error: 'game_id is required.' };
  const data = await gql<{ game: ApiGame | null }>(`query($id: ID!) { game(id: $id) { ${GAME_FIELDS} } }`, { id });
  if (!data.game) return { found: false, note: `No game exists with id "${id}". Do not guess its details.` };
  const g = data.game;
  return { found: true, game: { ...compact(g), date: g.date, weekday: weekdayOf(g.date), duration_minutes: g.durationMinutes, venue_address: g.venue.address } };
}

async function listVenues() {
  const data = await gql<{ venues: { id: string; name: string; address: string | null }[] }>(`{ venues { id name address } }`);
  return { venues: data.venues };
}

const executors: Record<string, (args: Args) => Promise<unknown>> = {
  search_games: searchGames,
  get_game_details: getGameDetails,
  list_venues: listVenues,
};

/** Runs a tool call. Never throws: failures are returned to the model as structured errors. */
export async function runTool(name: string, args: Args): Promise<Record<string, unknown>> {
  const fn = executors[name];
  if (!fn) return { error: `Unknown tool "${name}".` };
  try {
    return (await fn(args ?? {})) as Record<string, unknown>;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      hint: 'Fix the arguments (dates YYYY-MM-DD, times HH:mm, date OR date_from/date_to) and retry, or tell the user the data could not be retrieved. Never answer from memory.',
    };
  }
}
