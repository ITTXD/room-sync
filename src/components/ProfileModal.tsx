"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import {
  X,
  User as UserIcon,
  Shield,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  Trash2,
  Building,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { User } from "@/types";
import styles from "./ProfileModal.module.css";

interface SessionInfo {
  id: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserUpdated: (user: User) => void;
  onLoggedOut: () => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  onLoggedOut,
}: ProfileModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "2fa" | "sessions">("profile");

  // Profile Form State
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("MEMBER");
  const [department, setDepartment] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 2FA State
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [setupStep, setSetupStep] = useState<"initial" | "scanning" | "verify">("initial");
  const [totpSecret, setTotpSecret] = useState("");
  const [otpAuthUri, setOtpAuthUri] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpMessage, setTotpMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sessions State
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsMessage, setSessionsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync state when opened
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "");
      setRole(currentUser.role || "MEMBER");
      setDepartment(currentUser.department || "Engineering");
      setIs2FAEnabled(Boolean((currentUser as any).totpEnabled));
    }
    setProfileMessage(null);
    setTotpMessage(null);
  }, [currentUser, isOpen]);

  // Fetch active sessions when the sessions tab is opened
  useEffect(() => {
    if (isOpen && activeTab === "sessions") {
      fetchSessions();
    }
  }, [isOpen, activeTab]);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/auth/sessions");
      const data = await res.json();
      if (res.ok) {
        setSessions(data.sessions || []);
      }
    } catch {
      // Ignore session fetch errors
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setIsSavingProfile(true);

    try {
      const payload: any = {
        name: name.trim(),
        role,
        department: department.trim(),
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setProfileMessage({ type: "success", text: "Profile updated successfully!" });
      onUserUpdated(data.user);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setProfileMessage({ type: "error", text: err.message || "Failed to update" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Start 2FA Setup
  const handleStart2FASetup = async () => {
    setTotpLoading(true);
    setTotpMessage(null);

    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate 2FA setup");
      }

      setTotpSecret(data.secret);
      setOtpAuthUri(data.otpAuthUri);
      setSetupStep("scanning");
    } catch (err: any) {
      setTotpMessage({ type: "error", text: err.message || "2FA setup failed" });
    } finally {
      setTotpLoading(false);
    }
  };

  // Confirm 2FA Code
  const handleVerify2FACode = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpLoading(true);
    setTotpMessage(null);

    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid authenticator code");
      }

      setIs2FAEnabled(true);
      setSetupStep("initial");
      setVerifyCode("");
      setTotpMessage({ type: "success", text: "Google Authenticator 2FA enabled successfully!" });
      if (currentUser) {
        onUserUpdated({ ...(currentUser as any), totpEnabled: true });
      }
    } catch (err: any) {
      setTotpMessage({ type: "error", text: err.message || "Verification failed" });
    } finally {
      setTotpLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    const code = prompt("Enter your 6-digit Authenticator code to confirm disabling 2FA:");
    if (!code) return;

    setTotpLoading(true);
    setTotpMessage(null);

    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", code: code.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to disable 2FA");
      }

      setIs2FAEnabled(false);
      setTotpMessage({ type: "success", text: "2FA has been disabled." });
      if (currentUser) {
        onUserUpdated({ ...(currentUser as any), totpEnabled: false });
      }
    } catch (err: any) {
      setTotpMessage({ type: "error", text: err.message || "Failed to disable 2FA" });
    } finally {
      setTotpLoading(false);
    }
  };

  // Revoke Session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/auth/sessions?id=${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setSessionsMessage({ type: "success", text: "Session revoked." });
      }
    } catch {
      setSessionsMessage({ type: "error", text: "Failed to revoke session" });
    }
  };

  // Revoke All Others
  const handleRevokeOtherSessions = async () => {
    try {
      const res = await fetch(`/api/auth/sessions?revokeOthers=true`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.isCurrent));
        setSessionsMessage({ type: "success", text: "All other sessions revoked." });
      }
    } catch {
      setSessionsMessage({ type: "error", text: "Failed to revoke other sessions" });
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    onClose();
    onLoggedOut();
    router.push("/login");
    router.refresh();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerUserGroup}>
            <div className={styles.avatarSquare}>
              {name ? name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className={styles.headerTitle}>
                <span>{name || "User Profile"}</span>
                <span className={role === "ADMIN" ? styles.roleAdmin : styles.roleMember}>
                  {role}
                </span>
              </div>
              <div className={styles.headerEmail}>{currentUser?.email}</div>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabs}>
          <button
            onClick={() => setActiveTab("profile")}
            className={`${styles.tabBtn} ${activeTab === "profile" ? styles.tabBtnActive : ""}`}
          >
            <UserIcon size={14} />
            <span>Profile & Role</span>
          </button>

          <button
            onClick={() => setActiveTab("2fa")}
            className={`${styles.tabBtn} ${activeTab === "2fa" ? styles.tabBtnActive : ""}`}
          >
            <ShieldCheck size={14} />
            <span>Google Authenticator (2FA)</span>
            {is2FAEnabled && <span className={styles.badgeActiveDot} />}
          </button>

          <button
            onClick={() => setActiveTab("sessions")}
            className={`${styles.tabBtn} ${activeTab === "sessions" ? styles.tabBtnActive : ""}`}
          >
            <Laptop size={14} />
            <span>Active Sessions</span>
          </button>
        </div>

        {/* Content Body */}
        <div className={styles.body}>
          {/* TAB 1: Profile & Role Settings */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className={styles.form}>
              {profileMessage && (
                <div
                  className={`${styles.alertBox} ${
                    profileMessage.type === "success" ? styles.alertSuccess : styles.alertError
                  }`}
                >
                  {profileMessage.type === "success" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Display Name</label>
                <div className={styles.inputWrapper}>
                  <UserIcon className={styles.inputIcon} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.grid2}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Workspace Role</label>
                  <div className={styles.inputWrapper}>
                    <Shield className={styles.inputIcon} />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className={styles.select}
                    >
                      <option value="MEMBER">Member (Booking & Join)</option>
                      <option value="ADMIN">Admin (Full Control)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Department</label>
                  <div className={styles.inputWrapper}>
                    <Building className={styles.inputIcon} />
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className={styles.select}
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Product">Product</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Operations">Operations</option>
                      <option value="Human Resources">HR</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Password change section */}
              <div className={styles.passwordSection}>
                <div className={styles.passwordHeader}>
                  <KeyRound size={14} color="#2563eb" />
                  <span>Change Password (Optional)</span>
                </div>
                <div className={styles.passwordInputs}>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className={styles.plainInput}
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 characters)"
                    className={styles.plainInput}
                  />
                </div>
              </div>

              <div className={styles.saveBtnRow}>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className={styles.primaryBtn}
                >
                  <span>{isSavingProfile ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Google Authenticator 2FA */}
          {activeTab === "2fa" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {totpMessage && (
                <div
                  className={`${styles.alertBox} ${
                    totpMessage.type === "success" ? styles.alertSuccess : styles.alertError
                  }`}
                >
                  {totpMessage.type === "success" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span>{totpMessage.text}</span>
                </div>
              )}

              {is2FAEnabled ? (
                /* Already Enabled State */
                <div className={styles.twoFactorActiveCard}>
                  <div className={styles.twoFactorActiveIcon}>
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--color-success-text)" }}>
                      Two-Factor Authentication is Active
                    </h4>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      Your account is protected by standard RFC 6238 TOTP (Google Authenticator).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisable2FA}
                    disabled={totpLoading}
                    className={styles.revokeBtn}
                    style={{ marginTop: "8px" }}
                  >
                    {totpLoading ? "Processing..." : "Disable 2FA"}
                  </button>
                </div>
              ) : setupStep === "initial" ? (
                /* Setup prompt */
                <div className={styles.twoFactorPromptCard}>
                  <div className={styles.twoFactorPromptIcon}>
                    <Smartphone size={28} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--color-text-main)" }}>
                      Google Authenticator Protection
                    </h4>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)", maxWidth: "380px" }}>
                      Scan a QR Code with your Google Authenticator or Microsoft Authenticator app
                      to generate 6-digit codes for secure login.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleStart2FASetup}
                    disabled={totpLoading}
                    className={styles.primaryBtn}
                  >
                    {totpLoading ? "Setting up..." : "Enable Google Authenticator (2FA)"}
                  </button>
                </div>
              ) : (
                /* QR Code Scanning & Verification */
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className={styles.twoFactorQrRow}>
                    <div className={styles.qrBox}>
                      {otpAuthUri && <QRCodeSVG value={otpAuthUri} size={135} level="M" />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--color-text-main)" }}>
                        Step 1: Scan this QR Code
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-muted)" }}>
                        Open Google Authenticator, tap the <strong>+</strong> button, and point your camera at this code.
                      </p>
                      <div style={{ marginTop: "4px" }}>
                        <span style={{ fontSize: "10px", color: "var(--color-text-subtle)", display: "block" }}>
                          Manual key:
                        </span>
                        <div className={styles.manualSecretRow}>
                          <span>{totpSecret}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(totpSecret)}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                          >
                            {copiedSecret ? <Check size={14} color="#10b981" /> : <Copy size={14} color="#64748b" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Verification Code */}
                  <form onSubmit={handleVerify2FACode} className={styles.form}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>
                        Step 2: Enter the 6-digit code shown in the app
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className={styles.totpVerifyInput}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSetupStep("initial");
                          setVerifyCode("");
                        }}
                        style={{
                          flex: 1,
                          padding: "9px 12px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-border)",
                          background: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={totpLoading || verifyCode.length !== 6}
                        style={{
                          flex: 2,
                          padding: "9px 16px",
                          borderRadius: "var(--radius-md)",
                          border: "none",
                          background: "var(--color-success)",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <span>{totpLoading ? "Verifying..." : "Verify & Activate 2FA"}</span>
                        <Check size={14} />
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Active Device Sessions */}
          {activeTab === "sessions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--color-text-main)" }}>
                    Logged-in Devices
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
                    Devices and browsers currently authenticated to your account
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchSessions}
                  disabled={sessionsLoading}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {sessionsMessage && (
                <div
                  className={`${styles.alertBox} ${
                    sessionsMessage.type === "success" ? styles.alertSuccess : styles.alertError
                  }`}
                >
                  <CheckCircle2 size={16} />
                  <span>{sessionsMessage.text}</span>
                </div>
              )}

              <div className={styles.sessionsList}>
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className={`${styles.sessionItem} ${sess.isCurrent ? styles.sessionItemCurrent : ""}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "var(--radius-sm)",
                          background: "#ffffff",
                          border: "1px solid var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        <Laptop size={16} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-main)" }}>
                            {sess.userAgent}
                          </span>
                          {sess.isCurrent && (
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 700,
                                background: "var(--color-primary-light)",
                                color: "var(--color-primary)",
                                padding: "1px 4px",
                                borderRadius: "var(--radius-xs)",
                                border: "1px solid var(--color-primary-border)",
                              }}
                            >
                              Current
                            </span>
                          )}
                        </div>
                        <p style={{ margin: "2px 0 0", fontSize: "10px", color: "var(--color-text-muted)" }}>
                          IP: {sess.ipAddress} • Logged in: {new Date(sess.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {!sess.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(sess.id)}
                        className={styles.revokeBtn}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {sessions.filter((s) => !s.isCurrent).length > 0 && (
                <button
                  type="button"
                  onClick={handleRevokeOtherSessions}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-danger-border)",
                    background: "var(--color-danger-bg)",
                    color: "var(--color-danger-text)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Trash2 size={14} />
                  <span>Revoke All Other Sessions</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" onClick={handleSignOut} className={styles.signOutBtn}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
          <button type="button" onClick={onClose} className={styles.closeFooterBtn}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
