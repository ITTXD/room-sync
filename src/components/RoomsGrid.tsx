"use client";

import React, { useState } from "react";
import { Room, User } from "@/types";
import {
  Users,
  MapPin,
  Plus,
  Wrench,
  Sparkles,
  Calendar,
} from "lucide-react";
import styles from "./RoomsGrid.module.css";

interface RoomsGridProps {
  rooms: Room[];
  currentUser: User | null;
  onBookRoom: (roomId: string) => void;
  onRefresh: () => void;
}

export default function RoomsGrid({
  rooms,
  currentUser,
  onBookRoom,
  onRefresh,
}: RoomsGridProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState(8);
  const [amenitiesInput, setAmenitiesInput] = useState("4K Display, Video Conference, Whiteboard");
  const [colorCode, setColorCode] = useState("#2563eb");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === "ADMIN";

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const amenities = amenitiesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          floor,
          capacity: Number(capacity),
          amenities,
          colorCode,
          organizationId: rooms[0]?.organizationId || "default-org",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create room");
      }

      setShowAddModal(false);
      setName("");
      setFloor("");
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating room");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMaintenance = async (room: Room) => {
    try {
      await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !room.isActive }),
      });
      onRefresh();
    } catch (err) {
      console.error("Error toggling room status:", err);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header with Title and Add Room Button */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Conference & Meeting Rooms</h2>
          <p className={styles.subtitle}>
            Browse available spaces, capacities, and specialized AV equipment
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className={styles.addRoomBtn}
          >
            <Plus size={16} />
            <span>Add New Room</span>
          </button>
        )}
      </div>

      {/* Rooms Grid */}
      <div className={styles.roomsGrid}>
        {rooms.map((room) => (
          <div
            key={room.id}
            className={`${styles.roomCard} ${!room.isActive ? styles.roomCardMaintenance : ""}`}
          >
            <div className={styles.cardBody}>
              {/* Top Row: Color Tag, Name & Status */}
              <div className={styles.topRow}>
                <div className={styles.roomIdentityGroup}>
                  <div
                    className={styles.colorDot}
                    style={{ backgroundColor: room.colorCode }}
                  />
                  <div>
                    <h3 className={styles.roomHeading}>{room.name}</h3>
                    <div className={styles.locationRow}>
                      <MapPin size={14} color="#94a3b8" />
                      <span>{room.floor}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`${styles.statusBadge} ${
                    room.isActive ? styles.statusAvailable : styles.statusMaintenance
                  }`}
                >
                  {room.isActive ? "Available" : "Maintenance"}
                </span>
              </div>

              {/* Stats Row */}
              <div className={styles.statsRow}>
                <div className={styles.statItem}>
                  <Users size={16} color="#2563eb" />
                  <strong style={{ color: "var(--color-text-main)" }}>{room.capacity}</strong>
                  <span>Seats</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                  <Calendar size={16} color="#6366f1" />
                  <strong style={{ color: "var(--color-text-main)" }}>
                    {room.totalActiveBookings ?? 0}
                  </strong>
                  <span>Active Bookings</span>
                </div>
              </div>

              {/* Amenities Tags */}
              <div className={styles.amenitiesSection}>
                <div className={styles.amenitiesLabel}>Amenities & Equipment</div>
                <div className={styles.amenitiesTags}>
                  {room.amenities.map((amenity, idx) => (
                    <span key={idx} className={styles.amenityTag}>
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className={styles.cardFooter}>
              {isAdmin && (
                <button
                  onClick={() => handleToggleMaintenance(room)}
                  className={styles.maintenanceBtn}
                >
                  <Wrench size={14} />
                  <span>{room.isActive ? "Set Maintenance" : "Activate Room"}</span>
                </button>
              )}

              <button
                disabled={!room.isActive}
                onClick={() => onBookRoom(room.id)}
                className={styles.bookBtn}
              >
                <Sparkles size={14} />
                <span>Book Room</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Room Modal (Admin Only) */}
      {showAddModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: "var(--color-text-main)" }}>
              Add New Meeting Room
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--color-text-muted)" }}>
              Create a new workspace space with amenities
            </p>

            {error && (
              <div
                style={{
                  marginBottom: "16px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-danger-bg)",
                  padding: "10px",
                  fontSize: "12px",
                  color: "var(--color-danger-text)",
                  border: "1px solid var(--color-danger-border)",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apollo Creative Pod"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Floor / Wing</label>
                <input
                  type="text"
                  placeholder="e.g. Floor 2, Creative Hub"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className={styles.formInput}
                  required
                />
              </div>

              <div className={styles.grid2}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Seat Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={capacity}
                    onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                    className={styles.formInput}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Theme Color</label>
                  <input
                    type="color"
                    value={colorCode}
                    onChange={(e) => setColorCode(e.target.value)}
                    style={{ width: "100%", height: "36px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", padding: "2px", cursor: "pointer", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Amenities (comma separated)</label>
                <input
                  type="text"
                  value={amenitiesInput}
                  onChange={(e) => setAmenitiesInput(e.target.value)}
                  placeholder="Video Conference, Whiteboard, TV"
                  className={styles.formInput}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", paddingTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: "var(--color-primary)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {loading ? "Creating..." : "Save Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
