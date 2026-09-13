/**
 * Domain model + pure filtering logic shared by every data source.
 * Keeping the filter logic in one place guarantees the JSON file and the
 * Supabase table answer every query identically.
 */

export type Availability = 'URGENT' | 'AVAILABLE' | 'FULL';

export interface Venue { id: string; name: string; address: string | null }
export interface Organizer { id: string; displayName: string; avatarUrl: string | null }

/** Raw shape as stored (JSON file / DB row). */
export interface GameRecord {
  id: string;
  startsAt: string;          // ISO-8601 with explicit offset, e.g. 2026-08-26T09:15:00+02:00
  durationMinutes: number;
  venueId: string;
  format: string;            // "8v8", "9v9", "11v11"
  organizerId: string;
  spotsTotal: number;
  spotsAvailable: number;
  isRecorded: boolean;
  priceEur: number;
}

/** Fully resolved shape exposed by the API. */
export interface Game extends Omit<GameRecord, 'venueId' | 'organizerId'> {
  date: string;              // YYYY-MM-DD in the venue's local timezone
  startTime: string;         // HH:mm local
  endTime: string;           // HH:mm local
  timezone: string;
  venue: Venue;
  organizer: Organizer;
  availability: Availability;
  spotsTaken: number;
}

export interface Dataset {
  referenceDate: string;
  timezone: string;
  city: string;
  venues: Venue[];
  organizers: Organizer[];
  games: GameRecord[];
}

export interface GamesFilter {
  date?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  venueId?: string | null;
  venueName?: string | null;
  minSpotsAvailable?: number | null;
  availability?: Availability[] | null;
  startTimeFrom?: string | null;   // HH:mm local, inclusive
  startTimeTo?: string | null;     // HH:mm local, exclusive
}

export const URGENT_THRESHOLD = 2;

export function availabilityOf(spotsAvailable: number): Availability {
  if (spotsAvailable <= 0) return 'FULL';
  if (spotsAvailable <= URGENT_THRESHOLD) return 'URGENT';
  return 'AVAILABLE';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function assertTime(value: string, field: string): string {
  if (!TIME_RE.test(value)) {
    throw new Error(`Invalid ${field}: "${value}". Expected a 24h local time formatted HH:mm, e.g. "12:00".`);
  }
  return value;
}

export function assertIsoDate(value: string, field: string): string {
  if (!DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`Invalid ${field}: "${value}". Expected an ISO calendar date formatted YYYY-MM-DD.`);
  }
  return value;
}

/** Extracts local date/time parts from an ISO string that carries its own offset. */
function localParts(startsAt: string, durationMinutes: number) {
  const m = startsAt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error(`Unparseable startsAt: ${startsAt}`);
  const [, date, hh, mm] = m;
  const startMinutes = Number(hh) * 60 + Number(mm);
  const endMinutes = (startMinutes + durationMinutes) % (24 * 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date,
    startTime: `${pad(Number(hh))}:${pad(Number(mm))}`,
    endTime: `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}`,
  };
}

export function resolveGame(record: GameRecord, dataset: Dataset): Game {
  const venue = dataset.venues.find((v) => v.id === record.venueId);
  const organizer = dataset.organizers.find((o) => o.id === record.organizerId);
  if (!venue) throw new Error(`Game ${record.id} references unknown venue ${record.venueId}`);
  if (!organizer) throw new Error(`Game ${record.id} references unknown organizer ${record.organizerId}`);
  const { venueId: _v, organizerId: _o, ...rest } = record;
  return {
    ...rest,
    ...localParts(record.startsAt, record.durationMinutes),
    timezone: dataset.timezone,
    venue,
    organizer,
    availability: availabilityOf(record.spotsAvailable),
    spotsTaken: record.spotsTotal - record.spotsAvailable,
  };
}

export function normalizeFilter(filter: GamesFilter | null | undefined): Required<GamesFilter> {
  const f = filter ?? {};
  if (f.date && (f.dateFrom || f.dateTo)) {
    throw new Error('Use either "date" or a "dateFrom"/"dateTo" range, not both.');
  }
  const date = f.date ? assertIsoDate(f.date, 'date') : null;
  const dateFrom = f.dateFrom ? assertIsoDate(f.dateFrom, 'dateFrom') : null;
  const dateTo = f.dateTo ? assertIsoDate(f.dateTo, 'dateTo') : null;
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error(`dateFrom (${dateFrom}) must not be after dateTo (${dateTo}).`);
  }
  const startTimeFrom = f.startTimeFrom ? assertTime(f.startTimeFrom, 'startTimeFrom') : null;
  const startTimeTo = f.startTimeTo ? assertTime(f.startTimeTo, 'startTimeTo') : null;
  if (startTimeFrom && startTimeTo && startTimeFrom >= startTimeTo) {
    throw new Error(`startTimeFrom (${startTimeFrom}) must be earlier than startTimeTo (${startTimeTo}).`);
  }
  if (f.minSpotsAvailable != null && (f.minSpotsAvailable < 0 || !Number.isInteger(f.minSpotsAvailable))) {
    throw new Error('minSpotsAvailable must be a non-negative integer.');
  }
  return {
    date,
    dateFrom: date ?? dateFrom,
    dateTo: date ?? dateTo,
    venueId: f.venueId?.trim() || null,
    venueName: f.venueName?.trim() || null,
    minSpotsAvailable: f.minSpotsAvailable ?? null,
    availability: f.availability?.length ? f.availability : null,
    startTimeFrom,
    startTimeTo,
  };
}

/** Accent-insensitive, case-insensitive substring match ("aliga" matches "L'Àliga"). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function applyFilter(games: Game[], filter: Required<GamesFilter>): Game[] {
  return games
    .filter((g) => !filter.dateFrom || g.date >= filter.dateFrom)
    .filter((g) => !filter.dateTo || g.date <= filter.dateTo)
    .filter((g) => !filter.venueId || g.venue.id === filter.venueId)
    .filter((g) => !filter.venueName || fold(g.venue.name).includes(fold(filter.venueName)))
    .filter((g) => filter.minSpotsAvailable == null || g.spotsAvailable >= filter.minSpotsAvailable)
    .filter((g) => !filter.availability || filter.availability.includes(g.availability))
    .filter((g) => !filter.startTimeFrom || g.startTime >= filter.startTimeFrom)
    .filter((g) => !filter.startTimeTo || g.startTime < filter.startTimeTo)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}
