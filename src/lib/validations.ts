import { z } from "zod";

export const BookingStatusEnum = z.enum(["CONFIRMED", "CHECKED_IN", "CANCELLED"]);
export const UserRoleEnum = z.enum(["ADMIN", "MEMBER"]);

// Schema for creating a new booking
export const CreateBookingSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100),
    description: z.string().max(500).optional(),
    roomId: z.string().min(1, "Room ID is required"),
    userId: z.string().min(1, "User ID is required"),
    startTime: z.string().datetime("Start time must be a valid ISO date string"),
    endTime: z.string().datetime("End time must be a valid ISO date string"),
    attendeeCount: z.number().int().positive("Attendee count must be at least 1"),
    allowWalkIn: z.boolean().optional().default(true),
  })
  .refine(
    (data) => new Date(data.startTime) < new Date(data.endTime),
    {
      message: "End time must be after start time",
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      const diffMs = new Date(data.endTime).getTime() - new Date(data.startTime).getTime();
      const diffMins = diffMs / (1000 * 60);
      return diffMins >= 15 && diffMins <= 480; // Between 15 mins and 8 hours
    },
    {
      message: "Booking duration must be between 15 minutes and 8 hours",
      path: ["endTime"],
    }
  );

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
