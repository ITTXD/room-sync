import { describe, expect, it } from "vitest";
import {
  composeVenueInstant,
  dayWindowUTC,
  venueDayKey,
  venueHourMinute,
} from "./tz";
import { CreateBookingSchema } from "./validations";

describe("dayWindowUTC", () => {
  // Bangkok is UTC+7 with no DST (worked example by hand):
  // local midnight Thu 2026-10-22 00:00 ICT == previous day 17:00 UTC.
  it("returns the venue-local day window for the booked bug case", () => {
    const w = dayWindowUTC("2026-10-22");
    expect(w.startOfDay.toISOString()).toBe("2026-10-21T17:00:00.000Z");
    expect(w.endOfDay.toISOString()).toBe("2026-10-22T16:59:59.999Z");
  });
});

describe("venueDayKey", () => {
  // The reported bug: a viewer in Bangkok opening the site at 01:00 local
  // (17:00 UTC the previous day) is already on the next calendar day there.
  it("flips to the venue calendar day at local midnight, not UTC midnight", () => {
    expect(venueDayKey(new Date("2026-10-21T17:00:00.000Z"))).toBe(
      "2026-10-22"
    );
  });

  it("keeps the venue calendar day on the last local millisecond", () => {
    expect(venueDayKey(new Date("2026-10-22T16:59:59.999Z"))).toBe(
      "2026-10-22"
    );
  });
});

describe("composeVenueInstant", () => {
  // A slot the user reads as "Thu Oct 22, 09:00 (office wall clock)"
  // is 02:00 UTC on that same calendar day (Bangkok = UTC+7).
  it("composes date + wall time into the correct UTC instant", () => {
    expect(composeVenueInstant("2026-10-22", "09:00").toISOString()).toBe(
      "2026-10-22T02:00:00.000Z"
    );
  });

  it("composes the last bookable slot of the day", () => {
    expect(composeVenueInstant("2026-10-22", "20:00").toISOString()).toBe(
      "2026-10-22T13:00:00.000Z"
    );
  });
});

describe("venueHourMinute", () => {
  // The stored instant of the "asdasd" booking (01:00 UTC) reads as 08:00
  // on the venue wall clock. Browsers in other offsets must not reposition it.
  it("reads wall-clock parts in the venue timezone, not the browser's", () => {
    expect(venueHourMinute(new Date("2026-01-01T02:30:00.000Z"))).toEqual({
      hour: 9,
      minute: 30,
    });
  });
});

describe("CreateBookingSchema time contracts", () => {
  it.each([
    [
      "venue wall times",
      {
        date: "2026-10-22",
        startTime: "09:30",
        endTime: "10:15",
      },
    ],
    [
      "legacy ISO instants",
      {
        startTime: "2026-10-22T02:30:00.000Z",
        endTime: "2026-10-22T03:15:00.000Z",
      },
    ],
  ])("accepts %s", (_label, times) => {
    const parsed = CreateBookingSchema.safeParse({
      title: "Smoke",
      roomId: "room-1",
      userId: "user-1",
      attendeeCount: 2,
      ...times,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts 45-minute venue booking previously mis-measured as sub-minute", () => {
    const parsed = CreateBookingSchema.safeParse({
      title: "Smoke",
      roomId: "room-1",
      userId: "user-1",
      date: "2026-10-22",
      startTime: "09:30",
      endTime: "10:15",
      attendeeCount: 2,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects mixing the two time contracts", () => {
    const parsed = CreateBookingSchema.safeParse({
      title: "Smoke",
      roomId: "room-1",
      userId: "user-1",
      date: "2026-10-22",
      startTime: "2026-10-22T02:30:00.000Z",
      endTime: "10:15",
      attendeeCount: 2,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects venue booking starting after ending", () => {
    const parsed = CreateBookingSchema.safeParse({
      title: "Smoke",
      roomId: "room-1",
      userId: "user-1",
      date: "2026-10-22",
      startTime: "14:00",
      endTime: "13:00",
      attendeeCount: 2,
    });
    expect(parsed.success).toBe(false);
  });
});
