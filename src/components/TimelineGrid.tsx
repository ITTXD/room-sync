"use client";

import React, { useState } from "react";
import { Room, Booking } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Search,
  Sparkles,
  Info,
  QrCode,
} from "lucide-react";
import { VENUE_TZ, venueDayKey, venueHourMinute } from "@/lib/tz";
import styles from "./TimelineGrid.module.css";

interface TimelineGridProps {
  rooms: Room[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onSlotClick: (roomId: string, time: string) => void;
  onBookingClick: (booking: Booking) => void;
  onRefresh: () => void;
}

export default function TimelineGrid({
  rooms,
  selectedDate,
  setSelectedDate,
  onSlotClick,
  onBookingClick,
}: TimelineGridProps) {
  const [minCapacityFilter, setMinCapacityFilter] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Timeline hours from 08:00 to 20:00 (12 hours total)
  const START_HOUR = 8;
  const END_HOUR = 20;
  const TOTAL_HOURS = END_HOUR - START_HOUR;

  const hoursArray = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  // Navigate Date
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    // "Today" is the venue's business day (Asia/Bangkok), not the UTC date:
    // after 17:00 ICT the UTC calendar is already tomorrow-(negative).
    setSelectedDate(venueDayKey(new Date()));
  };

  // Filter rooms
  const filteredRooms = rooms.filter((room) => {
    const matchesCapacity = room.capacity >= minCapacityFilter;
    const matchesSearch =
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.floor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.amenities.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCapacity && matchesSearch;
  });

  // Calculate position of a booking within the 08:00 - 20:00 range.
  // Reads wall-clock parts in the venue timezone: viewers in other
  // offsets must see identical chip positions and labels.
  const getBookingStyle = (booking: Booking) => {
    const startDecimalHour = venueHourMinute(new Date(booking.startTime));
    const endDecimalHour = venueHourMinute(new Date(booking.endTime));

    const startDecimal = startDecimalHour.hour + startDecimalHour.minute / 60;
    const endDecimal = endDecimalHour.hour + endDecimalHour.minute / 60;

    // Clamp within 8:00 to 20:00
    const clampedStart = Math.max(START_HOUR, Math.min(END_HOUR, startDecimal));
    const clampedEnd = Math.max(START_HOUR, Math.min(END_HOUR, endDecimal));

    const leftPercent = ((clampedStart - START_HOUR) / TOTAL_HOURS) * 100;
    const widthPercent = Math.max(2, ((clampedEnd - clampedStart) / TOTAL_HOURS) * 100);

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  };

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className={styles.container}>
      {/* Top Controls Bar */}
      <div className={styles.controlsBar}>
        {/* Date Navigator */}
        <div className={styles.dateNavGroup}>
          <div className={styles.dateBtnGroup}>
            <button
              onClick={handlePrevDay}
              className={styles.navArrowBtn}
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>
            <button onClick={handleToday} className={styles.todayBtn}>
              Today
            </button>
            <button
              onClick={handleNextDay}
              className={styles.navArrowBtn}
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className={styles.dateBadge}>
            <Calendar size={16} color="#2563eb" />
            <span>{formatDisplayDate(selectedDate)}</span>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filtersGroup}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search room, amenities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.capacityFilterGroup}>
            <Users size={14} color="#64748b" style={{ marginLeft: "4px" }} />
            {[0, 6, 10, 16].map((cap) => (
              <button
                key={cap}
                onClick={() => setMinCapacityFilter(cap)}
                className={`${styles.capacityBtn} ${
                  minCapacityFilter === cap ? styles.capacityBtnActive : ""
                }`}
              >
                {cap === 0 ? "All" : `${cap}+`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Timeline Card */}
      <div className={styles.timelineCard}>
        <div className={styles.timelineScroll}>
          <div className={styles.timelineInner}>
            {/* Header: Room Name column + Time Columns */}
            <div className={styles.timelineHeader}>
              <div className={styles.roomColumnHeader}>
                Meeting Room & Details
              </div>
              <div className={styles.hoursHeaderGroup}>
                {hoursArray.map((hour) => (
                  <div key={hour} className={styles.hourHeaderItem}>
                    {hour.toString().padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Room Rows */}
            <div>
              {filteredRooms.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center" }}>
                  <div
                    style={{
                      margin: "0 auto",
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      backgroundColor: "var(--color-surface-hover)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-subtle)",
                    }}
                  >
                    <Info size={24} />
                  </div>
                  <h3 style={{ marginTop: "12px", fontSize: "14px", fontWeight: 600, color: "var(--color-text-main)" }}>
                    No rooms match filter
                  </h3>
                  <p style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-muted)" }}>
                    Try adjusting your capacity or search query.
                  </p>
                </div>
              ) : (
                filteredRooms.map((room) => {
                  const roomBookings = room.bookings || [];

                  return (
                    <div key={room.id} className={styles.roomRow}>
                      {/* Left: Room Details */}
                      <div className={styles.roomInfoCell}>
                        <div className={styles.roomTitleRow}>
                          <span
                            className={styles.roomDot}
                            style={{ backgroundColor: room.colorCode }}
                          />
                          <span className={styles.roomName}>{room.name}</span>
                        </div>
                        <div className={styles.roomMetaRow}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {room.floor}
                          </span>
                          <span>•</span>
                          <span style={{ fontWeight: 600, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Users size={12} />
                            {room.capacity}
                          </span>
                        </div>
                        <div className={styles.amenitiesRow}>
                          {room.amenities.slice(0, 2).map((a, idx) => (
                            <span key={idx} className={styles.amenityTag}>
                              {a}
                            </span>
                          ))}
                          {room.amenities.length > 2 && (
                            <span style={{ fontSize: "9px", color: "var(--color-text-subtle)", fontWeight: 600 }}>
                              +{room.amenities.length - 2}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Interactive Timeline Bar */}
                      <div
                        className={styles.timelineTrack}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const ratio = clickX / rect.width;
                          const clickedHour = Math.floor(START_HOUR + ratio * TOTAL_HOURS);
                          onSlotClick(room.id, `${clickedHour.toString().padStart(2, "0")}:00`);
                        }}
                      >
                        {/* Background Hour Grid Lines */}
                        <div className={styles.gridLinesWrapper}>
                          {hoursArray.map((hour) => (
                            <div key={hour} className={styles.gridLine} />
                          ))}
                        </div>

                        {/* Render Booked Interval Chips */}
                        {roomBookings.map((booking) => {
                          const style = getBookingStyle(booking);
                          const startTimeStr = new Date(booking.startTime).toLocaleTimeString([], {
                            timeZone: VENUE_TZ,
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          const endTimeStr = new Date(booking.endTime).toLocaleTimeString([], {
                            timeZone: VENUE_TZ,
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          const liveCount = booking.participants?.length ?? 1;

                          return (
                            <div
                              key={booking.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onBookingClick({ ...booking, room });
                              }}
                              className={styles.bookingChip}
                              style={{
                                ...style,
                                backgroundColor: room.colorCode,
                              }}
                              title={`${booking.title}\nLive in room: ${liveCount}/${room.capacity} people\nClick to view QR Code & Join Room`}
                            >
                              <div className={styles.bookingChipHeader}>
                                <span className={styles.bookingChipTitle}>
                                  {booking.title}
                                </span>
                                <span className={styles.bookingChipOccupancy}>
                                  <Users size={10} />
                                  <span>{liveCount}/{room.capacity}</span>
                                </span>
                              </div>
                              <div className={styles.bookingChipFooter}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <QrCode size={10} style={{ flexShrink: 0 }} />
                                  <span>{booking.accessCode || "QR Pass"}</span>
                                </span>
                                <span>{startTimeStr}-{endTimeStr}</span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Hover Helper Cue */}
                        <div className={styles.hoverCue}>
                          <span className={styles.hoverBadge}>
                            <Sparkles size={12} />
                            <span>Click empty slot to book</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Legend Footer */}
        <div className={styles.legendFooter}>
          <div className={styles.legendItems}>
            <div className={styles.legendItem}>
              <span className={styles.legendColorBox} style={{ backgroundColor: "#2563eb" }} />
              <span>Confirmed Booking</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendColorBox} style={{ backgroundColor: "#10b981" }} />
              <span>Checked-In (Active)</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendColorBox} style={{ border: "1px dashed #cbd5e1", backgroundColor: "#ffffff" }} />
              <span>Vacant / Available Slot</span>
            </div>
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-subtle)" }}>
            Operating Hours: 08:00 – 20:00 (Click anywhere on a row to schedule)
          </div>
        </div>
      </div>
    </div>
  );
}
