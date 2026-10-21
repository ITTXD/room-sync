export type UserRole = "ADMIN" | "MEMBER";
export type BookingStatus = "CONFIRMED" | "CHECKED_IN" | "CANCELLED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  avatarUrl?: string | null;
  activeBookingsCount?: number;
}

export interface Room {
  id: string;
  name: string;
  floor: string;
  capacity: number;
  amenities: string[];
  colorCode: string;
  isActive: boolean;
  imageUrl?: string | null;
  organizationId: string;
  totalActiveBookings?: number;
  bookings?: Booking[];
}

export interface BookingParticipant {
  id: string;
  bookingId: string;
  userId?: string | null;
  name: string;
  department?: string | null;
  role: "HOST" | "AUDIENCE";
  status: "CHECKED_IN" | "LEFT";
  checkedInAt: string;
}

export interface Booking {
  id: string;
  title: string;
  description?: string | null;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  status: BookingStatus;
  attendeeCount: number;
  accessCode?: string | null;
  allowWalkIn?: boolean;
  roomId: string;
  userId: string;
  room?: Room;
  user?: User;
  participants?: BookingParticipant[];
  createdAt?: string;
}

export interface TimelineData {
  success: boolean;
  date: string;
  summary: {
    totalRooms: number;
    totalBookings: number;
  };
  rooms: Room[];
}

export interface AnalyticsData {
  success: boolean;
  metrics: {
    totalRooms: number;
    totalUsers: number;
    totalBookings: number;
    confirmedCount: number;
    checkedInCount: number;
    cancelledCount: number;
    todayBookingsCount: number;
  };
  roomUtilization: {
    name: string;
    hours: number;
    color: string;
    bookingCount: number;
  }[];
  hourlyDistribution: {
    hour: string;
    count: number;
  }[];
  departmentUsage: {
    department: string;
    count: number;
  }[];
  todaySchedule: Booking[];
}
