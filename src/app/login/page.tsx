"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Mail,
  Smartphone,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.requiresTwoFactor) {
        setRequires2FA(true);
        setPreAuthToken(data.preAuthToken);
        setLoading(false);
        return;
      }

      // Success
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preAuthToken) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preAuthToken,
          code: totpCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid 2FA code");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to verify 2FA code");
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);

    try {
      const res = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to sign in with ${provider}`);
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "OAuth sign-in failed");
      setOauthLoading(null);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.headerArea}>
        {/* Brand Logo Header */}
        <div className={styles.brandContainer}>
          <div className={styles.brandLogo}>
            <CalendarDays size={24} />
          </div>
          <div className={styles.brandTextGroup}>
            <div className={styles.brandTitleRow}>
              <span className={styles.brandTitle}>RoomSync</span>
              <span className={styles.brandBadge}>SaaS</span>
            </div>
            <p className={styles.brandSubtitle}>Enterprise Meeting Room Booking</p>
          </div>
        </div>

        <h1 className={styles.pageTitle}>
          {requires2FA ? "Two-Factor Authentication" : "Sign in to your account"}
        </h1>
        <p className={styles.pageDescription}>
          {requires2FA
            ? "Enter the 6-digit code from your Google Authenticator app"
            : "Access your company workspace and manage meeting rooms"}
        </p>
      </div>

      <div className={styles.cardWrapper}>
        <div className={styles.card}>
          {error && (
            <div className={styles.alertError}>
              <AlertCircle className={styles.alertErrorIcon} />
              <span>{error}</span>
            </div>
          )}

          {!requires2FA ? (
            <>
              {/* SSO Buttons */}
              <div className={styles.ssoGrid}>
                <button
                  type="button"
                  onClick={() => handleOAuth("google")}
                  disabled={loading || Boolean(oauthLoading)}
                  className={styles.ssoButton}
                >
                  <svg className={styles.ssoIcon} viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{oauthLoading === "google" ? "Connecting..." : "Google SSO"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOAuth("github")}
                  disabled={loading || Boolean(oauthLoading)}
                  className={styles.ssoButton}
                >
                  <svg className={styles.ssoIcon} viewBox="0 0 24 24" fill="#0f172a">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                  <span>{oauthLoading === "github" ? "Connecting..." : "GitHub SSO"}</span>
                </button>
              </div>

              <div className={styles.dividerWrapper}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerText}>Or sign in with email</span>
              </div>

              {/* Login Form */}
              <form onSubmit={handleCredentialsSubmit} className={styles.form}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Email address</label>
                  <div className={styles.inputWrapper}>
                    <Mail className={styles.inputIcon} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Password</label>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${styles.input} ${styles.inputPassword}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={styles.passwordToggle}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={styles.submitButton}
                >
                  <span>{loading ? "Authenticating..." : "Sign in"}</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            </>
          ) : (
            /* 2FA Verification Form */
            <form onSubmit={handle2FASubmit} className={styles.form}>
              <div className={styles.twoFactorBanner}>
                <Smartphone className={styles.twoFactorIcon} />
                <h3 className={styles.twoFactorTitle}>Google Authenticator Check</h3>
                <p className={styles.twoFactorText}>
                  Enter the 6-digit code currently displayed in your Authenticator app.
                </p>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ textAlign: "center" }}>
                  Authenticator Code (6 Digits)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  autoFocus
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000 000"
                  className={styles.totpInput}
                />
              </div>

              <div className={styles.twoFactorActions}>
                <button
                  type="button"
                  onClick={() => {
                    setRequires2FA(false);
                    setPreAuthToken(null);
                    setTotpCode("");
                  }}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className={styles.verifyButton}
                >
                  <span>{loading ? "Verifying..." : "Verify & Sign In"}</span>
                  <ShieldCheck size={16} />
                </button>
              </div>
            </form>
          )}

          <div className={styles.footer}>
            Don&apos;t have an account?{" "}
            <Link href="/register" className={styles.link}>
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
