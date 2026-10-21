"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { Booking } from "@/types";
import {
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import styles from "./checkin.module.css";

function CheckInContent() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params?.code || "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedInSuccess, setCheckedInSuccess] = useState<string | null>(null);

  const fetchSession = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${code}`);
      const data = await res.json();
      if (data.success && data.booking) {
        setBooking(data.booking);
      } else {
        setError("Invalid QR code or meeting session not found.");
      }
    } catch {
      setError("Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [code]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !name.trim()) return;

    setSubmitting(true);
    setError(null);
    setCheckedInSuccess(null);

    try {
      const res = await fetch(`/api/bookings/${booking.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          department: department.trim() || "Audience",
          role: "AUDIENCE",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Check-in failed");
      } else {
        setBooking(data.booking);
        setCheckedInSuccess(`${name.trim()} is now checked into ${data.booking.room.name}!`);
        setName("");
        setDepartment("");
      }
    } catch {
      setError("Network error while checking in.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async (participantId: string) => {
    if (!booking) return;
    try {
      const res = await fetch(
        `/api/bookings/${booking.id}/join?participantId=${participantId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success && data.booking) {
        setBooking(data.booking);
      }
    } catch (err) {
      console.error("Failed to check out:", err);
    }
  };

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <div style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>
          Verifying Meeting Room QR Pass...
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.card} style={{ padding: "32px", textAlign: "center" }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: "0 auto" }} />
          <h1 style={{ marginTop: "16px", fontSize: "18px", fontWeight: 700, color: "var(--color-text-main)" }}>
            Meeting Session Not Found
          </h1>
          <p style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-muted)" }}>
            {error || "This QR code may have expired or the booking ID is invalid."}
          </p>
          <button
            onClick={() => router.push("/")}
            className={styles.checkInSubmitBtn}
            style={{ marginTop: "24px" }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const participants = booking.participants || [];
  const capacity = booking.room?.capacity || 10;
  const currentCount = participants.length;
  const isFull = currentCount >= capacity;

  const startTimeStr = new Date(booking.startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTimeStr = new Date(booking.endTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.card}>
        {/* Top Banner */}
        <div
          className={styles.banner}
          style={{ backgroundColor: booking.room?.colorCode || "#2563eb" }}
        >
          <div className={styles.bannerTopRow}>
            <button onClick={() => router.push("/")} className={styles.backBtn}>
              <ArrowLeft size={14} />
              <span>Dashboard</span>
            </button>
            <span className={styles.accessCodeBadge}>
              {booking.accessCode || "QR PASS"}
            </span>
          </div>

          <h1 className={styles.bannerTitle}>{booking.title}</h1>
          <div className={styles.bannerMetaRow}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
              <MapPin size={14} />
              <span>{booking.room?.name}</span>
            </span>
            <span>•</span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Clock size={14} />
              <span>{startTimeStr} – {endTimeStr}</span>
            </span>
          </div>
        </div>

        <div className={styles.contentBody}>
          {/* Live Room Occupancy Counter */}
          <div className={styles.occupancyBox}>
            <div className={styles.occupancyHeader}>
              <span style={{ fontWeight: 700, color: "var(--color-text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={16} color="#2563eb" />
                <span>Live Room Occupancy</span>
              </span>
              <span className={`${styles.occupancyBadge} ${isFull ? styles.badgeFull : styles.badgeOk}`}>
                {currentCount} / {capacity} People Inside
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.min(100, Math.round((currentCount / capacity) * 100))}%`,
                  backgroundColor: isFull ? "var(--color-danger)" : "var(--color-success)",
                }}
              />
            </div>
            <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--color-text-muted)", display: "flex", justifyContent: "space-between" }}>
              <span>Host: {booking.user?.name || "Organizer"}</span>
              <span>{isFull ? "Room Full" : `${capacity - currentCount} seats remaining`}</span>
            </div>
          </div>

          {checkedInSuccess && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-success-bg)",
                padding: "12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-success-text)",
                border: "1px solid var(--color-success-border)",
              }}
            >
              <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
              <span>{checkedInSuccess}</span>
            </div>
          )}

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-danger-bg)",
                padding: "12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-danger-text)",
                border: "1px solid var(--color-danger-border)",
              }}
            >
              <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Check-in Form */}
          <form onSubmit={handleCheckIn} className={styles.form}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-main)" }}>
              Enter Your Details to Check In
            </div>
            <input
              type="text"
              placeholder="Your Full Name (e.g. John Doe)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isFull || submitting}
              className={styles.input}
              required
            />
            <input
              type="text"
              placeholder="Department / Team (e.g. Product, QA)"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={isFull || submitting}
              className={styles.input}
            />
            <button
              type="submit"
              disabled={isFull || submitting}
              className={styles.checkInSubmitBtn}
            >
              <UserPlus size={16} />
              <span>
                {isFull
                  ? "Room at Full Capacity"
                  : submitting
                  ? "Checking in..."
                  : "Check In & Join Meeting"}
              </span>
            </button>
          </form>

          {/* Current Audience List */}
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--color-text-subtle)", marginBottom: "8px" }}>
              Current Audience in Room ({currentCount})
            </div>
            <div className={styles.participantsList}>
              {participants.map((p) => (
                <div key={p.id} className={styles.participantItem}>
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--color-text-main)" }}>{p.name}</span>
                    <span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--color-text-muted)" }}>
                      ({p.department || p.role})
                    </span>
                  </div>
                  <button onClick={() => handleLeave(p.id)} className={styles.leaveBtn}>
                    <LogOut size={12} />
                    <span>Leave</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: "14px" }}>
          Loading check-in session...
        </div>
      }
    >
      <CheckInContent />
    </Suspense>
  );
}
