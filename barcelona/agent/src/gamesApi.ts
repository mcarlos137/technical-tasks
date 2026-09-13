/** Thin typed GraphQL client for the Games API. */

export const GAMES_API_URL = process.env.GAMES_API_URL ?? 'http://localhost:4000/graphql';

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GAMES_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  if (!body.data) throw new Error(`Games API returned no data (HTTP ${res.status})`);
  return body.data;
}

export interface ReferenceDate { today: string; weekday: string; timezone: string; city: string; firstGameDate: string | null; lastGameDate: string | null }

export async function fetchReferenceDate(): Promise<ReferenceDate> {
  const d = await gql<{ referenceDate: ReferenceDate }>(
    `{ referenceDate { today weekday timezone city firstGameDate lastGameDate } }`,
  );
  return d.referenceDate;
}
