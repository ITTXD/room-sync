import prisma from "./db";
import { CreateBookingInput, JoinSessionInput } from "./validations";
import { VENUE_TZ, composeVenueInstant, dayWindowUTC } from "./tz";
import { SAFE_USER_SELECT, hashPassword } from "./auth";

/**
 * Generates a short, human-readable 6-char access code for QR Check-in (e.g., "RM-4K9X2A")
 */
export function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RM-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Ensures the default Organization, default Users, and "Meeting Room 1" & "Meeting Room 2" exist,
 * and backfills accessCode for any existing bookings.
 */
export async function ensureDefaultWorkspace() {
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "RoomSync Workspace",
        slug: "roomsync-workspace",
        openTime: "08:00",
        closeTime: "20:00",
      },
    });
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const adminHash = await hashPassword("Admin1234!");
    const memberHash = await hashPassword("Member1234!");

    await prisma.user.createMany({
      data: [
        {
          name: "Admin User",
          email: "admin@roomsync.io",
          passwordHash: adminHash,
          role: "ADMIN",
          department: "Operations",
          organizationId: org.id,
        },
        {
          name: "Team Member",
          email: "member@roomsync.io",
          passwordHash: memberHash,
          role: "MEMBER",
          department: "Engineering",
          organizationId: org.id,
        },
      ],
    });
  }

  const roomCount = await prisma.room.count();
  if (roomCount === 0) {
    await prisma.room.createMany({
      data: [
        {
          name: "Meeting Room 1",
          floor: "Floor 2, West Wing",
          capacity: 8,
          amenitiesJson: JSON.stringify([
            "4K Display",
            "Video Conference",
            "Whiteboard",
          ]),
          colorCode: "#2563eb",
          isActive: true,
          organizationId: org.id,
        },
        {
          name: "Meeting Room 2",
          floor: "Floor 3, East Wing",
          capacity: 12,
          amenitiesJson: JSON.stringify([
            "Projector & Screen",
            "Video Conference",
            "Whiteboard",
            "Sound System",
          ]),
          colorCode: "#059669",
          isActive: true,
          organizationId: org.id,
        },
      ],
    });
  }

  // Backfill accessCode & host participant for any existing bookings without accessCode
  const bookingsMissingCode = await prisma.booking.findMany({
    where: { accessCode: null },
    include: {
      user: { select: SAFE_USER_SELECT },
      participants: true,
    },
  });

  for (const b of bookingsMissingCode) {
    const code = generateAccessCode();
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        accessCode: code,
        ...(b.participants.length === 0 && b.user
          ? {
              participants: {
                create: {
                  userId: b.user.id,
                  name: b.user.name,
                  department: b.user.department || "Organizer",
                  role: "HOST",
                  status: "CHECKED_IN",
                },
              },
            }
          : {}),
      },
    });
  }

  return org;
}

/**
 * Pure helper function to determine if two intervals overlap.
 * Rule: StartA < EndB AND EndA > StartB
 */
export function isOverlapping(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string
): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  return sA < eB && eA > sB;
}

/**
 * Check if a room is already occupied during a requested time window.
 */
export async function checkRoomConflict(
  roomId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
) {
  return await prisma.booking.findFirst({
    where: {
      roomId,
      status: { not: "CANCELLED" },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    },
    include: {
      user: {
        select: { id: true, name: true, department: true },
      },
      room: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Single place that turns a validated payload time into a Date:
 *  - `date` + "HH:mm" → venue-timezone instants (contract v2)
 *  - ISO instant string (legacy API scripts) → taken as-is
 * The mixing of the two contracts is rejected by CreateBookingSchema,
 * so a `date` without a wall time here is a caller bug: fail loudly
 * rather than silently interpreting in the server's timezone.
 */
function interpretBookingTime(date: string | undefined, value: string): Date {
  if (date) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new Error(
        `INTERNAL: booking with \`date\` requires HH:mm times, got "${value}" (mixed contracts rejected upstream)`
      );
    }
    return composeVenueInstant(date, value);
  }
  return new Date(value);
}

/**
 * Creates a booking safely inside an atomic Prisma interactive transaction.
 * Guarantees zero double-booking even under concurrent traffic (Race Condition Prevention).
 */
export async function createSafeBooking(input: CreateBookingInput) {
  const start = interpretBookingTime(input.date, input.startTime);
  const end = interpretBookingTime(input.date, input.endTime);

  return await prisma.$transaction(async (tx) => {
    // 1. Verify Room exists and is active
    const room = await tx.room.findUnique({
      where: { id: input.roomId },
    });

    if (!room) {
      throw new Error("Room not found");
    }

    if (!room.isActive) {
      throw new Error(`Room "${room.name}" is currently under maintenance`);
    }

    if (input.attendeeCount > room.capacity) {
      throw new Error(
        `Attendee count (${input.attendeeCount}) exceeds room capacity (${room.capacity})`
      );
    }

    // 2. Check for overlapping active bookings within transaction
    const conflict = await tx.booking.findFirst({
      where: {
        roomId: input.roomId,
        status: { not: "CANCELLED" },
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } },
        ],
      },
      include: {
        user: { select: { name: true } },
      },
    });

    if (conflict) {
      const timeStr = `${new Date(conflict.startTime).toLocaleTimeString([], {
        timeZone: VENUE_TZ,
        hour: "2-digit",
        minute: "2-digit",
      })} - ${new Date(conflict.endTime).toLocaleTimeString([], {
        timeZone: VENUE_TZ,
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      throw new Error(
        `Time slot conflict: "${conflict.title}" booked by ${conflict.user.name} (${timeStr})`
      );
    }

    // Fetch organizer details to add as HOST participant
    const organizer = await tx.user.findUnique({
      where: { id: input.userId },
    });

    // 3. Insert new booking with unique QR accessCode and initial HOST participant
    const accessCode = generateAccessCode();
    const newBooking = await tx.booking.create({
      data: {
        title: input.title,
        description: input.description,
        startTime: start,
        endTime: end,
        attendeeCount: input.attendeeCount,
        accessCode,
        allowWalkIn: input.allowWalkIn ?? true,
        roomId: input.roomId,
        userId: input.userId,
        status: "CONFIRMED",
        participants: organizer
          ? {
              create: {
                userId: organizer.id,
                name: organizer.name,
                department: organizer.department || "Host",
                role: "HOST",
                status: "CHECKED_IN",
              },
            }
          : undefined,
      },
      include: {
        room: true,
        user: { select: SAFE_USER_SELECT },
        participants: {
          where: { status: "CHECKED_IN" },
          orderBy: { checkedInAt: "asc" },
        },
      },
    });

    return newBooking;
  });
}

/**
 * Allows an audience member or participant to join / check-in to a meeting session
 * via Booking ID or QR Access Code. Enforces room capacity limits atomically.
 */
export async function joinBookingSession(
  bookingIdOrCode: string,
  input: JoinSessionInput
) {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: {
        OR: [{ id: bookingIdOrCode }, { accessCode: bookingIdOrCode }],
      },
      include: {
        room: true,
        participants: {
          where: { status: "CHECKED_IN" },
        },
      },
    });

    if (!booking) {
      throw new Error("Meeting session or QR code not found");
    }

    if (booking.status === "CANCELLED") {
      throw new Error("This meeting has been cancelled");
    }

    const currentOccupancy = booking.participants.length;
    if (currentOccupancy >= booking.room.capacity) {
      throw new Error(
        `Room "${booking.room.name}" is at full capacity (${currentOccupancy}/${booking.room.capacity} people in room)`
      );
    }

    // Check if this person is already checked into this session
    const alreadyInRoom = booking.participants.find(
      (p) => p.name.toLowerCase() === input.name.trim().toLowerCase()
    );
    if (alreadyInRoom) {
      throw new Error(`${input.name} is already checked into this meeting room`);
    }

    // Create participant record
    await tx.bookingParticipant.create({
      data: {
        bookingId: booking.id,
        userId: input.userId,
        name: input.name.trim(),
        department: input.department?.trim() || "Audience",
        role: input.role || "AUDIENCE",
        status: "CHECKED_IN",
      },
    });

    // Update booking status to CHECKED_IN (In Use)
    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CHECKED_IN" },
      include: {
        room: true,
        user: {
          select: { id: true, name: true, email: true, department: true, avatarUrl: true },
        },
        participants: {
          where: { status: "CHECKED_IN" },
          orderBy: { checkedInAt: "asc" },
        },
      },
    });

    return updatedBooking;
  });
}

/**
 * Fetch all rooms and their scheduled bookings (with live participants) for a specific day.
 */
export async function getRoomTimeline(dateStr: string) {
  await ensureDefaultWorkspace();

  // Window of the venue-local day (Asia/Bangkok): same convention the
  // booking modal composes instants from. Server-local vs UTC drift was
  // the source of chips invisible on the day they were booked.
  const { startOfDay, endOfDay } = dayWindowUTC(dateStr);

  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      bookings: {
        where: {
          status: { not: "CANCELLED" },
          AND: [
            { startTime: { lte: endOfDay } },
            { endTime: { gte: startOfDay } },
          ],
        },
        include: {
          user: {
            select: { id: true, name: true, department: true, avatarUrl: true },
          },
          participants: {
            where: { status: "CHECKED_IN" },
            orderBy: { checkedInAt: "asc" },
          },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });

  return rooms.map((room) => ({
    ...room,
    amenities: JSON.parse(room.amenitiesJson || "[]") as string[],
  }));
}
