/**
 * Deterministic relative-date support. The LLM is bad at weekday arithmetic,
 * so we precompute a calendar around the dataset's reference "today" and hand
 * it to the model, plus explicit definitions for "this weekend", "on Thursday"...
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(iso: string): string {
  return WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

/** "this weekend": the Saturday+Sunday of the current week; if today is Sat/Sun, today..Sunday. */
export function thisWeekend(today: string): { from: string; to: string } {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (dow === 6) return { from: today, to: addDays(today, 1) };
  if (dow === 0) return { from: today, to: today };
  const sat = addDays(today, 6 - dow);
  return { from: sat, to: addDays(sat, 1) };
}

/** "on Thursday": the next occurrence on or after today. */
export function nextWeekday(today: string, weekday: string): string {
  const target = WEEKDAYS.findIndex((w) => w.toLowerCase() === weekday.toLowerCase());
  if (target < 0) throw new Error(`Unknown weekday ${weekday}`);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, (target - dow + 7) % 7);
}

export function calendarTable(today: string, days = 14): string {
  const rows: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const label = i === 0 ? ' (today)' : i === 1 ? ' (tomorrow)' : '';
    rows.push(`- ${weekdayOf(date)} ${date}${label}`);
  }
  return rows.join('\n');
}

export function buildDateContext(today: string): string {
  const we = thisWeekend(today);
  const nextWeek = WEEKDAYS.map((w) => `${w} = ${nextWeekday(today, w)}`).join(', ');
  return [
    `Reference "today" for this dataset: ${weekdayOf(today)} ${today} (timezone Europe/Madrid). Never use any other "today".`,
    `Calendar:`,
    calendarTable(today),
    `Resolved relative expressions:`,
    `- "today" = ${today}; "tomorrow" = ${addDays(today, 1)}; "day after tomorrow" = ${addDays(today, 2)}`,
    `- "this weekend" = ${we.from} to ${we.to}; "next weekend" = ${addDays(we.from, 7)} to ${addDays(we.to, 7)}`,
    `- "on <weekday>" means the next such day on or after today: ${nextWeek}`,
    `- "this week" = ${today} to ${addDays(today, (7 - new Date(`${today}T12:00:00Z`).getUTCDay()) % 7)} (through Sunday)`,
    `Times of day (local, start time): morning = 06:00-12:00, afternoon = 12:00-18:00, evening = 18:00-24:00 (use start_time_to "23:59"), night = 21:00-23:59.`,
  ].join('\n');
}
