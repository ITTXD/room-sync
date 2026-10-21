import { z } from "zod";

export const BookingStatusEnum = z.enum(["CONFIRMED", "CHECKED_IN", "CANCELLED"]);
export const UserRoleEnum = z.enum(["ADMIN", "MEMBER"]);

// Schema for creating a new booking
//
// Time contract (venue-timezone semantics, see src/lib/tz.ts):
//  - Preferred: `date` = "YYYY-MM-DD" plus `startTime`/`endTime` = "HH:mm"
//    wall clock in the venue timezone. The server composes the instant.
//  - Legacy: `date` omitted and `startTime`/`endTime` are ISO instants
//    (kept for existing API scripts).
export const CreateBookingSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100),
    description: z.string().max(500).optional(),
    roomId: z.string().min(1, "Room ID is required"),
    userId: z.string().min(1, "User ID is required"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD")
      .optional(),
    startTime: z.union([
      z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm (24h)"),
      z.string().datetime("Start time must be a valid ISO date string"),
    ]),
    endTime: z.union([
      z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm (24h)"),
      z.string().datetime("End time must be a valid ISO date string"),
    ]),
    attendeeCount: z.number().int().positive("Attendee count must be at least 1"),
    allowWalkIn: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    const bothWall = /^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime);
    const endWall = /^([01]\d|2[0-3]):[0-5]\d$/.test(data.endTime);

    // Reject mixing the two time contracts.
    if (data.date && (!bothWall || !endWall)) {
      ctx.addIssue({
        code: "custom",
        path: [data.date && !bothWall ? "startTime" : "endTime"],
        message:
          "With a venue `date`, start/end must be HH:mm wall times (not instants)",
      });
      return;
    }
    if (!data.date && (bothWall || endWall)) {
      ctx.addIssue({
        code: "custom",
        path: [bothWall ? "startTime" : "endTime"],
        message:
          "Without a venue `date`, start/end must be ISO instants (send `date` to use wall times)",
      });
      return;
    }

    // Work in consistent milliseconds on both branches:
    // wall times are minutes-since-midnight scaled to ms (no calendar),
    // ISO strings are already absolute instants.
    const toWallMs = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (h * 60 + m) * 60_000;
    };
    const startMs = data.date
      ? toWallMs(data.startTime)
      : new Date(data.startTime).getTime();
    const endMs = data.date
      ? toWallMs(data.endTime)
      : new Date(data.endTime).getTime();

    if (startMs >= endMs) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after start time",
      });
      return;
    }
    const diffMins = (endMs - startMs) / (1000 * 60);
    if (diffMins < 15 || diffMins > 480) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Booking duration must be between 15 minutes and 8 hours",
      });
    }
  });

// Schema for updating booking status / details
export const UpdateBookingSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  status: BookingStatusEnum.optional(),
  attendeeCount: z.number().int().positive().optional(),
  allowWalkIn: z.boolean().optional(),
});

// Schema for Audience / Participant QR Check-in
export const JoinSessionSchema = z.object({
  name: z.string().min(2, "Participant name must be at least 2 characters").max(80),
  department: z.string().max(80).optional(),
  userId: z.string().optional(),
  role: z.enum(["HOST", "AUDIENCE"]).optional().default("AUDIENCE"),
});

// Schema for Room creation
export const CreateRoomSchema = z.object({
  name: z.string().min(2, "Room name must be at least 2 characters").max(60),
  floor: z.string().min(2, "Floor/Location is required").max(100),
  capacity: z.number().int().min(1, "Capacity must be at least 1 person").max(200),
  amenities: z.array(z.string()).default([]),
  colorCode: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color code (e.g. #3b82f6)"),
  imageUrl: z.string().url().optional(),
  organizationId: z.string().optional(),
});

// Schema for Room updates
export const UpdateRoomSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  floor: z.string().min(2).max(100).optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  amenities: z.array(z.string()).optional(),
  colorCode: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Schema for filtering rooms and availability
export const AvailabilityFilterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  minCapacity: z.number().int().nonnegative().optional(),
  requiredAmenities: z.array(z.string()).optional(),
});

// ============================================================================
// Auth & Profile Schemas
// ============================================================================

export const RegisterSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters").max(60),
  email: z.string().email("Invalid email address").max(100),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  department: z.string().max(60).optional(),
  avatarUrl: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().regex(/^\d{6}$/, "Must be a 6-digit code").optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60).optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  department: z.string().max(60).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "New password must be at least 8 characters").optional(),
});

export const VerifyTotpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Must be a 6-digit code"),
  preAuthToken: z.string().optional(),
});

export type CreateBookingInput = z.input<typeof CreateBookingSchema>;
export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>;
export type JoinSessionInput = z.infer<typeof JoinSessionSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
export type AvailabilityFilterInput = z.infer<typeof AvailabilityFilterSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type VerifyTotpInput = z.infer<typeof VerifyTotpSchema>;
