"use client";

import React, { useState, useEffect } from "react";
import { Room, Booking, User } from "@/types";
import { Calendar, X, AlertCircle } from "lucide-react";
import styles from "./BookingModal.module.css";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdBooking?: Booking) => void;
  rooms: Room[];
  currentUser: User | null;
  initialRoomId?: string;
  initialDate?: string;
  initialStartTime?: string;
}

export default function BookingModal({
  isOpen,
  onClose,
  onSuccess,
  rooms,
  currentUser,
  initialRoomId,
  initialDate,
  initialStartTime,
}: BookingModalProps) {
  const [roomId, setRoomId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [attendeeCount, setAttendeeCount] = useState<number>(2);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or prefill state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setRoomId(initialRoomId || (rooms.length > 0 ? rooms[0].id : ""));
      setDate(initialDate || new Date().toISOString().split("T")[0]);
      if (initialStartTime) {
        setStartTime(initialStartTime);
        // Default duration: 1 hour
        const [h, m] = initialStartTime.split(":").map(Number);
        const nextHour = String(Math.min(h + 1, 20)).padStart(2, "0");
        setEndTime(`${nextHour}:${String(m).padStart(2, "0")}`);
      } else {
        setStartTime("09:00");
        setEndTime("10:00");
      }
    }
  }, [isOpen, initialRoomId, initialDate, initialStartTime, rooms]);

  if (!isOpen) return null;

  const selectedRoom = rooms.find((r) => r.id === roomId);

  // Time slot options (30-min intervals between 08:00 and 20:00)
  const timeOptions: string[] = [];
  for (let h = 8; h <= 20; h++) {
    const hh = String(h).padStart(2, "0");
    timeOptions.push(`${hh}:00`);
    if (h < 20) timeOptions.push(`${hh}:30`);
  }

  // Handle start time change and auto-adjust end time
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    const [h, m] = newStart.split(":").map(Number);
    const endH = m === 30 ? h + 1 : h;
    const endM = m === 30 ? "00" : "30";
    if (endH <= 20) {
      setEndTime(`${String(endH).padStart(2, "0")}:${endM}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentUser) {
      setError("Please sign in or select an active user profile to book.");
      return;
    }

    if (!roomId) {
      setError("Please select a meeting room.");
      return;
    }

    if (startTime >= endTime) {
      setError("End time must be strictly after start time.");
      return;
    }

    setLoading(true);

    try {
      const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          roomId,
          userId: currentUser.id,
          startTime: startDateTime,
          endTime: endDateTime,
          attendeeCount: Number(attendeeCount),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || data.error || "Failed to create booking");
        setLoading(false);
        return;
      }

      // Success
      setLoading(false);
      setTitle("");
      setDescription("");
      onClose();
      onSuccess(data.booking);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconSquare}>
              <Calendar size={20} />
            </div>
            <div>
              <h2 className={styles.title}>Book Meeting Room</h2>
              <p className={styles.subtitle}>Schedule a seamless conference or focus session</p>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className={styles.alertError}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
            <div>
              <strong>Booking Conflict / Error: </strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Room Selection */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Select Room</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={styles.select}
              required
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} — {room.floor} (Capacity: {room.capacity})
                </option>
              ))}
            </select>
            {selectedRoom && (
              <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--color-text-muted)" }}>
                <span
                  style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: selectedRoom.colorCode }}
                />
                <span>Max {selectedRoom.capacity} seats</span>
                <span>•</span>
                <span>{selectedRoom.amenities.slice(0, 3).join(", ")}</span>
              </div>
            )}
          </div>

          {/* Meeting Title */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Meeting Title</label>
            <input
              type="text"
              placeholder="e.g. Sprint 24 Planning & Architecture Sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
              required
              minLength={3}
            />
          </div>

          {/* Date & Time Row */}
          <div className={styles.grid3}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Start Time</label>
              <select
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className={styles.select}
              >
                {timeOptions.slice(0, -1).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>End Time</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={styles.select}
              >
                {timeOptions.slice(1).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Attendees */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Expected Attendees</label>
            <div className={styles.attendeesRow}>
              <input
                type="number"
                min={1}
                max={selectedRoom ? selectedRoom.capacity : 50}
                value={attendeeCount}
                onChange={(e) => setAttendeeCount(Math.max(1, parseInt(e.target.value) || 1))}
                className={styles.attendeeNumberInput}
                required
              />
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                {selectedRoom && attendeeCount > selectedRoom.capacity ? (
                  <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>
                    ⚠️ Exceeds room capacity ({selectedRoom.capacity})
                  </span>
                ) : (
                  `Room can comfortably host up to ${selectedRoom?.capacity || 10} people`
                )}
              </span>
            </div>
          </div>

          {/* Notes / Agenda */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Agenda / Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="Key discussion topics or preparation needed..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
            />
          </div>

          {/* Organizer Info */}
          <div className={styles.organizerBox}>
            <span>Booking created on behalf of:</span>
            <span className={styles.organizerName}>
              {currentUser?.name} ({currentUser?.department || "Team Member"})
            </span>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              <span>{loading ? "Checking Conflicts..." : "Confirm Booking"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
