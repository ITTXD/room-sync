import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoomSync — Modern Meeting Room Booking SaaS",
  description: "Enterprise SaaS Meeting Room Reservation System with Interactive Timeline, Conflict Detection, and Admin Analytics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
