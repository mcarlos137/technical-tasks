/**
 * Grounding check for agent replies. Every time, match format, price, spot count and
 * known venue a reply mentions must appear in a tool result from the same conversation,
 * and the reply must not make general claims the data cannot support.
 * The eval uses it today; it is also the basis for a future runtime guard.
 */

/** Values a reply may quote: everything the tools returned in the conversation. */
export interface Facts {
  times: Set<string>; // HH:mm, including the applied time window
  formats: Set<string>; // e.g. "8v8"
  prices: Set<number>; // euros
  spots: Set<number>; // spots_available and spots_total values
  venues: Set<string>; // accent-folded venue names
}

export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const TIME_KEYS = new Set(['start_time', 'end_time', 'startTimeFrom', 'startTimeTo']);

export function collectFacts(results: unknown[]): Facts {
  const facts: Facts = { times: new Set(), formats: new Set(), prices: new Set(), spots: new Set(), venues: new Set() };
  const visit = (value: unknown, key = ''): void => {
    if (Array.isArray(value)) return value.forEach((v) => visit(v, key));
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) visit(v, k);
      return;
    }
    if (typeof value === 'string') {
      if (TIME_KEYS.has(key)) facts.times.add(value);
      else if (key === 'format') facts.formats.add(value.toLowerCase());
      else if (key === 'venue' || key === 'name') facts.venues.add(fold(value));
    } else if (typeof value === 'number') {
      if (key === 'price_eur') facts.prices.add(value);
      else if (key === 'spots_available' || key === 'spots_total') facts.spots.add(value);
    }
  };
  results.forEach((r) => visit(r));
  return facts;
}

/** Times, formats, prices, spot counts and known venues in `reply` that no tool result backs up. */
export function ungroundedMentions(reply: string, facts: Facts, knownVenues: string[] = []): string[] {
  const problems: string[] = [];
  for (const [, h, m] of reply.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)) {
    const time = `${h.padStart(2, '0')}:${m}`;
    if (!facts.times.has(time)) problems.push(`time ${time} is not in any tool result`);
  }
  for (const [, a, b] of reply.matchAll(/\b(\d{1,2}) ?v ?(\d{1,2})\b/gi)) {
    const format = `${a}v${b}`;
    if (!facts.formats.has(format)) problems.push(`format ${format} is not in any tool result`);
  }
  for (const m of reply.matchAll(/€ ?(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?) ?(?:€|eur\b|euros?\b)/gi)) {
    const price = Number((m[1] ?? m[2]).replace(',', '.'));
    if (!facts.prices.has(price)) problems.push(`price €${price} is not in any tool result`);
  }
  for (const [, n] of reply.matchAll(/\b(\d+) (?:open |free |available )?spots?\b/gi)) {
    if (!facts.spots.has(Number(n))) problems.push(`"${n} spots" is not in any tool result`);
  }
  const text = fold(reply);
  for (const venue of knownVenues) {
    const v = fold(venue);
    if (text.includes(v) && !facts.venues.has(v)) problems.push(`venue "${venue}" is mentioned without a tool result`);
  }
  return [...new Set(problems)];
}

/** General statements the data cannot support, such as who the games are suitable for. */
const UNSUPPORTED_CLAIMS: [RegExp, string][] = [
  [/open to (?:players of )?(?:all|any|every)\b|(?:all|every) (?:skill )?levels? (?:are|is) welcome|suitable for (?:all|every|beginners)|beginner[- ]friendly|for all abilities/i, 'claims who the games are suitable for'],
  [/\b(?:usually|generally|typically|normally) (?:have|has|are|is|include|includes)\b/i, 'makes a general claim about how games usually are'],
];

export function unsupportedClaims(reply: string): string[] {
  return UNSUPPORTED_CLAIMS.filter(([re]) => re.test(reply)).map(([, why]) => `reply ${why}`);
}
