"use client";

import React, { useState, useEffect } from "react";
import { Booking, User } from "@/types";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  QrCode,
  Users,
  UserPlus,
  LogOut,
  Copy,
  Check,
  ExternalLink,
  Clock,
  MapPin,
  AlertCircle,
} from "lucide-react";
import styles from "./SessionQrModal.module.css";

interface SessionQrModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  currentUser: User | null;
}

export default function SessionQrModal({
  booking: initialBooking,
  isOpen,
  onClose,
  onUpdated,
  currentUser,
}: SessionQrModalProps) {
  const [booking, setBooking] = useState<Booking | null>(initialBooking);
  const [participantName, setParticipantName] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchLatestBooking = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`);
      const data = await res.json();
      if (data.success && data.booking) {
        setBooking(data.booking);
      }
    } catch (err) {
      console.error("Failed to refresh booking details:", err);
    }
  };

  useEffect(() => {
    setBooking(initialBooking);
    setError(null);
    if (initialBooking?.id && isOpen) {
      fetchLatestBooking(initialBooking.id);
    }
  }, [initialBooking, isOpen]);

  if (!isOpen || !booking) return null;

  const participants = booking.participants || [];
  const roomCapacity = booking.room?.capacity || 10;
  const checkedInCount = participants.length;
  const occupancyPercent = Math.min(100, Math.round((checkedInCount / roomCapacity) * 100));
  const isFull = checkedInCount >= roomCapacity;

  const accessCode = booking.accessCode || booking.id;
  const checkInUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/checkin/${accessCode}`
      : `http://localhost:3000/checkin/${accessCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(checkInUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: participantName.trim(),
          department: department.trim() || "Audience",
          role: "AUDIENCE",
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Could not check in");
      } else {
        setBooking(data.booking);
        setParticipantName("");
        setDepartment("");
        onUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveSession = async (participantId: string) => {
    try {
      const res = await fetch(
        `/api/bookings/${booking.id}/join?participantId=${participantId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success && data.booking) {
        setBooking(data.booking);
        onUpdated();
      }
    } catch (err) {
      console.error("Failed to check out participant:", err);
    }
  };

  const startTimeStr = new Date(booking.startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTimeStr = new Date(booking.endTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div
              className={styles.iconSquare}
              style={{ backgroundColor: booking.room?.colorCode || "#2563eb" }}
            >
              <QrCode size={24} />
            </div>
            <div>
              <div className={styles.titleRow}>
                <h2 className={styles.title}>{booking.title}</h2>
                <span className={styles.liveBadge}>Live Session & QR Pass</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLocation}>
                  <MapPin size={14} color="#2563eb" />
                  <span>{booking.room?.name} ({booking.room?.floor})</span>
                </span>
                <span>•</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={14} color="#64748b" />
                  <span>{startTimeStr} – {endTimeStr}</span>
                </span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Body Grid: Left = QR Pass, Right = Live Occupancy */}
        <div className={styles.bodyGrid}>
          {/* Left Column: QR Code Pass */}
          <div className={styles.qrPassCard}>
            <div style={{ width: "100%" }}>
              <div className={styles.qrInstruction}>Scan to Enter Meeting Room</div>
              <p className={styles.qrSubtext}>
                Audience members can scan this QR code at the room door to check in
              </p>

              <div className={styles.qrWrapper}>
                <QRCodeSVG
                  value={checkInUrl}
                  size={168}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div style={{ marginTop: "16px" }}>
                <div className={styles.codeLabel}>Room Access Code</div>
                <div className={styles.codeValue}>{accessCode}</div>
              </div>
            </div>

            <div className={styles.qrBtnGroup}>
              <button onClick={handleCopyLink} className={styles.copyBtn}>
                {copied ? (
                  <>
                    <Check size={14} color="#10b981" />
                    <span style={{ color: "var(--color-success-text)" }}>Copied Check-in Link!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} color="#64748b" />
                    <span>Copy QR Check-in Link</span>
                  </>
                )}
              </button>

              <a
                href={`/checkin/${accessCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLinkBtn}
              >
                <ExternalLink size={14} />
                <span>Open Mobile Check-in Page</span>
              </a>
            </div>
          </div>

          {/* Right Column: Live Occupancy & Roster */}
          <div className={styles.rosterCol}>
            {/* Live Occupancy Meter */}
            <div className={styles.occupancyCard}>
              <div className={styles.occupancyHeader}>
                <div className={styles.occupancyTitleGroup}>
                  <Users size={16} color="#2563eb" />
                  <span>Live Room Occupancy</span>
                </div>
                <span
                  className={`${styles.occupancyBadge} ${
                    isFull ? styles.badgeFull : styles.badgeNormal
                  }`}
                >
                  {checkedInCount} / {roomCapacity} in room now
                </span>
              </div>

              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{
                    width: `${occupancyPercent}%`,
                    backgroundColor: isFull
                      ? "var(--color-danger)"
                      : occupancyPercent >= 75
                      ? "var(--color-warning)"
                      : "var(--color-success)",
                  }}
                />
              </div>

              <div className={styles.occupancyFooter}>
                <span>Planned Audience: {booking.attendeeCount} people</span>
                <span>
                  {isFull
                    ? "Room at maximum capacity"
                    : `${roomCapacity - checkedInCount} seats available to join`}
                </span>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-danger-bg)",
                  padding: "10px",
                  fontSize: "12px",
                  color: "var(--color-danger-text)",
                  border: "1px solid var(--color-danger-border)",
                }}
              >
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Add / Check-in Audience Form */}
            <form onSubmit={handleJoinSession} className={styles.joinForm}>
              <div className={styles.joinFormTitle}>
                <UserPlus size={14} color="#2563eb" />
                <span>Check In / Join This Meeting Room</span>
              </div>
              <div className={styles.joinFormInputs}>
                <input
                  type="text"
                  placeholder="Participant Name"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  disabled={isFull || loading}
                  className={styles.joinInput}
                  required
                />
                <input
                  type="text"
                  placeholder="Department / Role"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  disabled={isFull || loading}
                  className={styles.joinInput}
                />
                <button
                  type="submit"
                  disabled={isFull || loading}
                  className={styles.joinSubmitBtn}
                >
                  {loading ? "..." : "Join"}
                </button>
              </div>
            </form>

            {/* Live Audience Roster */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--color-text-subtle)", marginBottom: "8px" }}>
                People Currently in Room ({checkedInCount})
              </div>
              <div className={styles.rosterList}>
                {participants.length === 0 ? (
                  <div
                    style={{
                      borderRadius: "var(--radius-md)",
                      border: "1px dashed var(--color-border)",
                      padding: "16px",
                      textAlign: "center",
                      fontSize: "12px",
                      color: "var(--color-text-subtle)",
                    }}
                  >
                    No one has checked into the room yet. Scan QR or enter your name above!
                  </div>
                ) : (
                  participants.map((p) => (
                    <div key={p.id} className={styles.participantCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className={styles.participantAvatar}>
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className={styles.participantNameRow}>
                            <span>{p.name}</span>
                            <span className={p.role === "HOST" ? styles.roleHost : styles.roleAudience}>
                              {p.role}
                            </span>
                          </div>
                          <div className={styles.participantSubtext}>
                            {p.department || "Participant"} • Checked in at{" "}
                            {new Date(p.checkedInAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleLeaveSession(p.id)}
                        title="Check out / Leave room"
                        className={styles.leaveBtn}
                      >
                        <LogOut size={14} />
                        <span>Leave</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
