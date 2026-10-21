"use client";

import React, { useState, useEffect } from "react";
import { User, Room, Booking } from "@/types";
import Navbar from "@/components/Navbar";
import TimelineGrid from "@/components/TimelineGrid";
import RoomsGrid from "@/components/RoomsGrid";
import MyBookings from "@/components/MyBookings";
import AnalyticsView from "@/components/AnalyticsView";
import BookingModal from "@/components/BookingModal";
import SessionQrModal from "@/components/SessionQrModal";
import ProfileModal from "@/components/ProfileModal";
import styles from "./page.module.css";
import {
  Building,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"timeline" | "rooms" | "my-bookings" | "analytics">("timeline");
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [modalPreselect, setModalPreselect] = useState<{
    roomId?: string;
    startTime?: string;
    date?: string;
  }>({});

  // QR Pass & Live Audience Modal State
  const [selectedBookingForQr, setSelectedBookingForQr] = useState<Booking | null>(null);

  // Profile & Security Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // 1. Fetch Users & Authenticated Session
  const fetchUsers = async () => {
    try {
      // Check active auth session
      const authRes = await fetch("/api/auth/me");
      const authData = await authRes.json();
      if (authData.user) {
        setCurrentUser(authData.user);
      }

      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success && data.users.length > 0) {
        setUsers(data.users);
        if (!authData.user && !currentUser) {
          const admin = data.users.find((u: User) => u.role === "ADMIN") || data.users[0];
          setCurrentUser(admin);
        }
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  // 2. Fetch Rooms & Timeline
  const fetchTimelineData = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const [timelineRes, allRoomsRes] = await Promise.all([
        fetch(`/api/timeline?date=${selectedDate}`),
        fetch("/api/rooms"),
      ]);
      const timelineData = await timelineRes.json();
      const allRoomsData = await allRoomsRes.json();

      if (timelineData.success) {
        setRooms(timelineData.rooms || []);
      }
      if (allRoomsData.success) {
        setAllRooms(allRoomsData.rooms || []);
      }
    } catch (err) {
      console.error("Failed to fetch timeline:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchTimelineData();
    }
  }, [selectedDate]);

  // Open booking modal with prefilled slot
  const handleSlotClick = (roomId: string, time: string) => {
    setModalPreselect({
      roomId,
      startTime: time,
      date: selectedDate,
    });
    setBookingModalOpen(true);
  };

  const handleBookFromCard = (roomId: string) => {
    setModalPreselect({
      roomId,
      date: selectedDate,
    });
    setBookingModalOpen(true);
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Navigation Top Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        users={users}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        onOpenBookingModal={() => {
          setModalPreselect({
            roomId: rooms[0]?.id,
            date: selectedDate,
          });
          setBookingModalOpen(true);
        }}
        onOpenProfileModal={() => setProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {loading && rooms.length === 0 ? (
          <div className={styles.loadingBox}>
            <RefreshCw size={16} className="animate-spin" />
            <span>Loading meeting rooms and schedule...</span>
          </div>
        ) : rooms.length === 0 && activeTab === "timeline" ? (
          <div style={{ borderRadius: "24px", border: "1px dashed var(--color-border)", backgroundColor: "#ffffff", padding: "48px", textAlign: "center", boxShadow: "var(--shadow-xs)" }}>
            <div style={{ margin: "0 auto", display: "flex", height: "56px", width: "56px", alignItems: "center", justifyContent: "center", borderRadius: "16px", backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}>
              <Building size={28} />
            </div>
            <h3 style={{ marginTop: "16px", fontSize: "18px", fontWeight: 700, color: "var(--color-text-main)" }}>No Active Meeting Rooms</h3>
            <p style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-muted)", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
              Activate or add a meeting room in the Rooms tab to start scheduling meetings.
            </p>
            <div style={{ marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
              <button
                onClick={() => setActiveTab("rooms")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-primary)",
                  padding: "10px 20px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Plus size={16} />
                <span>Go to Rooms Management</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Tab 1: Interactive Timeline */}
        {rooms.length > 0 && activeTab === "timeline" && (
          <TimelineGrid
            rooms={rooms}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onSlotClick={handleSlotClick}
            onBookingClick={(booking) => setSelectedBookingForQr(booking)}
            onRefresh={fetchTimelineData}
          />
        )}

        {/* Tab 2: Rooms Directory */}
        {activeTab === "rooms" && (
          <RoomsGrid
            rooms={allRooms.length > 0 ? allRooms : rooms}
            currentUser={currentUser}
            onBookRoom={handleBookFromCard}
            onRefresh={fetchTimelineData}
          />
        )}

        {/* Tab 3: My Bookings & Check-In */}
        {activeTab === "my-bookings" && (
          <MyBookings
            currentUser={currentUser}
            onBookClick={() => {
              setModalPreselect({
                roomId: rooms[0]?.id,
                date: selectedDate,
              });
              setBookingModalOpen(true);
            }}
            onOpenQrPass={(booking) => setSelectedBookingForQr(booking)}
          />
        )}

        {/* Tab 4: Admin Analytics */}
        {activeTab === "analytics" && <AnalyticsView />}
      </main>

      {/* Booking Modal */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        onSuccess={(createdBooking) => {
          fetchTimelineData();
          if (createdBooking) {
            setSelectedBookingForQr(createdBooking);
          }
          if (activeTab === "my-bookings") {
            setActiveTab("timeline");
            setTimeout(() => setActiveTab("my-bookings"), 50);
          }
        }}
        rooms={rooms}
        currentUser={currentUser}
        initialRoomId={modalPreselect.roomId}
        initialDate={modalPreselect.date || selectedDate}
        initialStartTime={modalPreselect.startTime}
      />

      {/* QR Code & Live Audience Modal */}
      <SessionQrModal
        booking={selectedBookingForQr}
        isOpen={!!selectedBookingForQr}
        onClose={() => setSelectedBookingForQr(null)}
        onUpdated={fetchTimelineData}
        currentUser={currentUser}
      />

      {/* Profile & Enterprise Security (2FA, Role, Devices) Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          fetchUsers();
        }}
        onLoggedOut={() => {
          setCurrentUser(null);
          fetchUsers();
        }}
      />
    </div>
  );
}
