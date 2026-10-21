"use client";

import React from "react";
import Link from "next/link";
import { User } from "@/types";
import {
  CalendarDays,
  LayoutGrid,
  BookmarkCheck,
  BarChart3,
  ChevronDown,
  ShieldCheck,
  User as UserIcon,
  Sparkles,
  Settings,
  LogOut,
  LogIn,
} from "lucide-react";
import styles from "./Navbar.module.css";

interface NavbarProps {
  activeTab: "timeline" | "rooms" | "my-bookings" | "analytics";
  setActiveTab: (tab: "timeline" | "rooms" | "my-bookings" | "analytics") => void;
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  onOpenBookingModal: () => void;
  onOpenProfileModal: () => void;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  users,
  currentUser,
  setCurrentUser,
  onOpenBookingModal,
  onOpenProfileModal,
}: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore
    }
    window.location.href = "/login";
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.innerContainer}>
        {/* Brand Logo & Navigation */}
        <div className={styles.brandNavGroup}>
          <div
            className={styles.brandLogoGroup}
            onClick={() => setActiveTab("timeline")}
          >
            <div className={styles.brandIcon}>
              <CalendarDays size={20} />
            </div>
            <div>
              <span className={styles.brandTitle}>RoomSync</span>
              <span className={styles.brandBadge}>SaaS</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className={styles.navLinks}>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`${styles.navItem} ${
                activeTab === "timeline" ? styles.navItemActive : ""
              }`}
            >
              <CalendarDays size={16} />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => setActiveTab("rooms")}
              className={`${styles.navItem} ${
                activeTab === "rooms" ? styles.navItemActive : ""
              }`}
            >
              <LayoutGrid size={16} />
              <span>Rooms</span>
            </button>
            <button
              onClick={() => setActiveTab("my-bookings")}
              className={`${styles.navItem} ${
                activeTab === "my-bookings" ? styles.navItemActive : ""
              }`}
            >
              <BookmarkCheck size={16} />
              <span>My Bookings</span>
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`${styles.navItem} ${
                activeTab === "analytics" ? styles.navItemActive : ""
              }`}
            >
              <BarChart3 size={16} />
              <span>Analytics</span>
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className={styles.rightActions}>
          <button
            onClick={onOpenBookingModal}
            className={styles.bookButton}
          >
            <Sparkles size={16} />
            <span>Book a Room</span>
          </button>

          {/* User Profile / Switcher Dropdown */}
          <div className={styles.userDropdownContainer}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={styles.userTrigger}
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className={styles.avatarImg}
                />
              ) : (
                <div className={styles.avatarFallback}>
                  {currentUser?.name?.slice(0, 2).toUpperCase() || "U"}
                </div>
              )}
              <div className={styles.userInfo}>
                <div className={styles.userNameRow}>
                  <span>{currentUser?.name || "Guest User"}</span>
                  {currentUser?.role === "ADMIN" ? (
                    <span className={styles.roleAdmin}>ADMIN</span>
                  ) : (
                    <span className={styles.roleMember}>MEMBER</span>
                  )}
                  {(currentUser as any)?.totpEnabled && (
                    <span title="Google Authenticator 2FA Active">
                      <ShieldCheck size={14} color="#10b981" />
                    </span>
                  )}
                </div>
                <div className={styles.userDept}>
                  {currentUser?.department || "General"}
                </div>
              </div>
              <ChevronDown size={16} className={styles.chevron} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div
                className={styles.dropdownMenu}
                onClick={() => setDropdownOpen(false)}
              >
                {/* Profile & Security Hub Action */}
                <div style={{ padding: "4px" }}>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenProfileModal();
                    }}
                    className={styles.settingsCardBtn}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className={styles.settingsIconWrapper}>
                        <Settings size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-main)" }}>
                          Profile & Security
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                          Edit Role, 2FA & Sessions
                        </div>
                      </div>
                    </div>
                    <span className={styles.settingsBadge}>Settings</span>
                  </button>
                </div>

                {/* Fast Profile Switcher */}
                <div className={styles.menuDivider}>
                  <div className={styles.menuSectionHeader}>
                    Switch Workspace Member
                  </div>
                  <div className={styles.userListScroll}>
                    {users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setCurrentUser(u)}
                        className={`${styles.userItemBtn} ${
                          currentUser?.id === u.id ? styles.userItemBtnActive : ""
                        }`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                          {u.role === "ADMIN" ? (
                            <ShieldCheck size={14} color="#d97706" style={{ flexShrink: 0 }} />
                          ) : (
                            <UserIcon size={14} color="#64748b" style={{ flexShrink: 0 }} />
                          )}
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-main)" }}>
                              {u.name}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                              {u.department}
                            </div>
                          </div>
                        </div>
                        <span className={u.role === "ADMIN" ? styles.roleAdmin : styles.roleMember}>
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auth Actions: Sign in or Sign out */}
                <div className={styles.menuDivider}>
                  <Link href="/login" className={styles.menuActionLink}>
                    <LogIn size={14} />
                    <span>Login with another account</span>
                  </Link>

                  <button onClick={handleLogout} className={styles.menuActionLogout}>
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
