/**
 * Canonical venue timezone.
 *
 * The schedule is a property of the office, not the viewer: a booking at
 * "09:00" means 09:00 in VENUE_TZ regardless of where the request came from.
 * This module is the single source of time interpretation (see GLOSSARY/ADR
 * decision on timezone semantics) — never call `new Date(y, m, d)` for day
 * arithmetic: on Cloudflare Workers that resolves in UTC, not venue time.
 */
export const VENUE_TZ = "Asia/Bangkok";

/**
 * Offset of `timeZone` from UTC in minutes at the given instant
 * (e.g. Bangkok = +420 at all times).
 */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value])
  );
  const wallAsUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((wallAsUTC - instant.getTime()) / 60_000);
}

/**
 * Calendar day `YYYY-MM-DD` of an instant, in venue time.
 * Use this for "today" / date-defaults — never `toISOString().split("T")[0]`,
 * which is the UTC calendar date and disagrees with venue time after 17:00 ICT.
 */
export function venueDayKey(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VENUE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Wall-clock hour and minute of an instant in the venue timezone —
 * the browser-independent counterpart of `Date.getHours()/getMinutes()`.
 * Grid positioning and chip labels must both read from this.
 */
export function venueHourMinute(instant: Date): {
  hour: number;
  minute: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TZ,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value])
  );
  return { hour: Number(parts.hour), minute: Number(parts.minute) };
}

/**
 * Composes venue-local wall time ("HH:mm") on day `YYYY-MM-DD` into the
 * actual UTC instant it represents, via the venue timezone — so a booking's
 * stored instants no longer depend on the browser's offset.
 */
export function composeVenueInstant(dateStr: string, wallTime: string): Date {
  const noonUTC = new Date(`${dateStr}T12:00:00.000Z`);
  const offsetMs = tzOffsetMinutes(noonUTC, VENUE_TZ) * 60_000;
  const [h, m] = wallTime.split(":").map(Number);
  return new Date(
    Date.UTC(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(5, 7)) - 1,
      Number(dateStr.slice(8, 10)),
      h,
      m,
      0,
      0
    ) - offsetMs
  );
}

/**
 * The window of instants that fall inside venue-local day `YYYY-MM-DD`,
 * as `{ startOfDay, endOfDay }` in UTC.
 */
export function dayWindowUTC(dateStr: string): {
  startOfDay: Date;
  endOfDay: Date;
} {
  // Probe the offset at noon UTC of the wall date so the value never sits
  // inside a midnight transition (relevant for timezones with DST).
  const noonUTC = new Date(`${dateStr}T12:00:00.000Z`);
  const offsetMs = tzOffsetMinutes(noonUTC, VENUE_TZ) * 60_000;
  return {
    startOfDay: new Date(
      new Date(`${dateStr}T00:00:00.000Z`).getTime() - offsetMs
    ),
    endOfDay: new Date(
      new Date(`${dateStr}T23:59:59.999Z`).getTime() - offsetMs
    ),
  };
}
