"use client";

import React, { useState, useEffect } from "react";
import { Booking, User } from "@/types";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Building,
  Sparkles,
  QrCode,
} from "lucide-react";
import styles from "./MyBookings.module.css";

interface MyBookingsProps {
  currentUser: User | null;
  onBookClick: () => void;
  onOpenQrPass: (booking: Booking) => void;
}

export default function MyBookings({
  currentUser,
  onBookClick,
  onOpenQrPass,
}: MyBookingsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "CONFIRMED" | "CHECKED_IN" | "CANCELLED">("ALL");

  const fetchUserBookings = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings?userId=${currentUser.id}`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings || []);
      }
    } catch (err) {
      console.error("Failed to fetch user bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserBookings();
  }, [currentUser]);

  const handleCheckIn = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CHECKED_IN" }),
      });
      if (res.ok) {
        fetchUserBookings();
      }
    } catch (err) {
      console.error("Check-in error:", err);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUserBookings();
      }
    } catch (err) {
      console.error("Cancel error:", err);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === "ALL") return true;
    return b.status === filter;
  });

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>
            {currentUser?.name}&apos;s Reservations
          </h2>
          <p className={styles.subtitle}>
            Manage your scheduled meetings, open QR check-in passes, and monitor live audience count
          </p>
        </div>

        {/* Filter Pills */}
        <div className={styles.filterPills}>
          {(["ALL", "CONFIRMED", "CHECKED_IN", "CANCELLED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`${styles.pillBtn} ${filter === tab ? styles.pillBtnActive : ""}`}
            >
              {tab === "ALL"
                ? "All"
                : tab === "CONFIRMED"
                ? "Upcoming"
                : tab === "CHECKED_IN"
                ? "Checked In"
                : "Cancelled"}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--color-text-subtle)", fontSize: "14px" }}>
          Loading your reservations...
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconWrapper}>
            <Calendar size={24} />
          </div>
          <h3 className={styles.emptyTitle}>No bookings found</h3>
          <p className={styles.emptyText}>
            You don&apos;t have any reservations in this filter category yet.
          </p>
          <button onClick={onBookClick} className={styles.scheduleBtn}>
            <Sparkles size={14} />
            <span>Schedule a Meeting</span>
          </button>
        </div>
      ) : (
        <div className={styles.bookingsList}>
          {filteredBookings.map((b) => {
            const startDate = new Date(b.startTime);
            const endDate = new Date(b.endTime);

            const dateStr = startDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const timeStr = `${startDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })} - ${endDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}`;

            const liveCount = b.participants?.length ?? 1;
            const roomCapacity = b.room?.capacity ?? b.attendeeCount;

            return (
              <div key={b.id} className={styles.bookingCard}>
                <div className={styles.leftGroup}>
                  <div
                    className={styles.roomColorIcon}
                    style={{ backgroundColor: b.room?.colorCode || "#2563eb" }}
                  >
                    <Building size={20} />
                  </div>
                  <div>
                    <div className={styles.bookingTitleRow}>
                      <h4 className={styles.bookingTitle}>{b.title}</h4>
                      <span
                        className={`${styles.statusBadge} ${
                          b.status === "CHECKED_IN"
                            ? styles.statusCheckedIn
                            : b.status === "CONFIRMED"
                            ? styles.statusConfirmed
                            : styles.statusCancelled
                        }`}
                      >
                        {b.status}
                      </span>
                      {b.accessCode && (
                        <span className={styles.accessCodeBadge}>
                          {b.accessCode}
                        </span>
                      )}
                    </div>

                    <div className={styles.bookingMetaRow}>
                      <span className={styles.roomNameHighlight}>{b.room?.name}</span>
                      <span>•</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Calendar size={14} color="#94a3b8" />
                        <span>{dateStr}</span>
                      </span>
                      <span>•</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={14} color="#94a3b8" />
                        <span>{timeStr}</span>
                      </span>
                      <span>•</span>
                      <span className={styles.liveCountHighlight}>
                        <Users size={14} color="#2563eb" />
                        <span>{liveCount} / {roomCapacity} in room now (Planned: {b.attendeeCount})</span>
                      </span>
                    </div>

                    {b.description && (
                      <p className={styles.bookingDescription}>
                        {b.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {b.status !== "CANCELLED" && (
                  <div className={styles.actionsGroup}>
                    <button
                      onClick={() => onOpenQrPass(b)}
                      className={styles.qrPassBtn}
                    >
                      <QrCode size={14} />
                      <span>QR Pass & Audience ({liveCount}/{roomCapacity})</span>
                    </button>

                    {b.status === "CONFIRMED" && (
                      <button
                        onClick={() => handleCheckIn(b.id)}
                        className={styles.checkInBtn}
                      >
                        <CheckCircle2 size={14} />
                        <span>Check-in</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleCancel(b.id)}
                      className={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
