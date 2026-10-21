"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Mail,
  Lock,
  User,
  Building,
  Shield,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import styles from "./register.module.css";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [department, setDepartment] = useState("Engineering");

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          department,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Registration failed");
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
        throw new Error(data.error || `Failed to sign up with ${provider}`);
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "OAuth failed");
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
              <span className={styles.brandBadge}>New User</span>
            </div>
            <p className={styles.brandSubtitle}>Enterprise Meeting Room Booking</p>
          </div>
        </div>

        <h1 className={styles.pageTitle}>Create your account</h1>
        <p className={styles.pageDescription}>
          Set up your profile, organization role, and start managing bookings
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

          {/* Quick SSO */}
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
              <span>Google Sign Up</span>
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
              <span>GitHub Sign Up</span>
            </button>
          </div>

          <div className={styles.dividerWrapper}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>Or fill out your profile</span>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Display Name */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Display Name</label>
              <div className={styles.inputWrapper}>
                <User className={styles.inputIcon} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className={styles.input}
                />
              </div>
            </div>

            {/* Email */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Corporate Email</label>
              <div className={styles.inputWrapper}>
                <Mail className={styles.inputIcon} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@company.com"
                  className={styles.input}
                />
              </div>
            </div>

            {/* Role & Department */}
            <div className={styles.rowGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>System Role</label>
                <div className={styles.inputWrapper}>
                  <Shield className={styles.inputIcon} />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER")}
                    className={styles.select}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
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

            {/* Password */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrapper}>
                <Lock className={styles.inputIcon} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
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

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className={styles.strengthMeter}>
                  <div className={styles.strengthTrack}>
                    <div
                      className={`${styles.strengthFill} ${
                        strength <= 1
                          ? styles.strengthFillWeak
                          : strength === 2
                          ? styles.strengthFillFair
                          : strength === 3
                          ? styles.strengthFillGood
                          : styles.strengthFillStrong
                      }`}
                    />
                  </div>
                  <div className={styles.strengthLabelRow}>
                    <span>Password strength:</span>
                    <span
                      className={
                        strength <= 1
                          ? styles.strengthTextWeak
                          : strength === 2
                          ? styles.strengthTextFair
                          : strength === 3
                          ? styles.strengthTextGood
                          : styles.strengthTextStrong
                      }
                    >
                      {strength <= 1
                        ? "Weak"
                        : strength === 2
                        ? "Fair"
                        : strength === 3
                        ? "Good"
                        : "Strong (Recommended)"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={styles.submitButton}
            >
              <span>{loading ? "Creating Account..." : "Complete Registration"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div className={styles.footer}>
            Already have an account?{" "}
            <Link href="/login" className={styles.link}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
