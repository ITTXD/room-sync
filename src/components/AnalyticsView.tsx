"use client";

import React, { useEffect, useState } from "react";
import { AnalyticsData } from "@/types";
import {
  BarChart3,
  Calendar,
  Clock,
  TrendingUp,
  Building,
  CheckCircle2,
} from "lucide-react";
import styles from "./AnalyticsView.module.css";

export default function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setData(resData);
        }
      })
      .catch((err) => console.error("Error loading analytics:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", fontSize: "14px", color: "var(--color-text-subtle)" }}>
        Generating enterprise workspace analytics...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "48px", textAlign: "center", fontSize: "14px", color: "var(--color-danger)" }}>
        Failed to load analytics metrics.
      </div>
    );
  }

  const { metrics, roomUtilization, hourlyDistribution, departmentUsage } = data;

  const maxHourlyCount = Math.max(1, ...hourlyDistribution.map((h) => h.count));
  const maxRoomHours = Math.max(1, ...roomUtilization.map((r) => r.hours));

  return (
    <div className={styles.container}>
      {/* Page Title */}
      <div>
        <h2 className={styles.title}>Workspace & Room Analytics</h2>
        <p className={styles.subtitle}>
          Real-time utilization rates, peak hours traffic, and department metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total Bookings</span>
            <div className={styles.kpiIconWrapper} style={{ backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}>
              <Calendar size={16} />
            </div>
          </div>
          <div className={styles.kpiValue}>{metrics.totalBookings}</div>
          <div className={styles.kpiSubtext} style={{ color: "var(--color-success-text)", display: "flex", alignItems: "center", gap: "4px" }}>
            <TrendingUp size={12} color="#10b981" />
            <span>{metrics.confirmedCount} active / upcoming</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Today&apos;s Meetings</span>
            <div className={styles.kpiIconWrapper} style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>
              <Clock size={16} />
            </div>
          </div>
          <div className={styles.kpiValue}>{metrics.todayBookingsCount}</div>
          <div className={styles.kpiSubtext} style={{ color: "var(--color-text-muted)" }}>
            Scheduled across active rooms
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Checked-In Rate</span>
            <div className={styles.kpiIconWrapper} style={{ backgroundColor: "var(--color-success-bg)", color: "var(--color-success)" }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            {metrics.totalBookings > 0
              ? `${Math.round((metrics.checkedInCount / metrics.totalBookings) * 100)}%`
              : "0%"}
          </div>
          <div className={styles.kpiSubtext} style={{ color: "var(--color-success-text)" }}>
            {metrics.checkedInCount} verified check-ins
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Active Spaces</span>
            <div className={styles.kpiIconWrapper} style={{ backgroundColor: "#fae8ff", color: "#a855f7" }}>
              <Building size={16} />
            </div>
          </div>
          <div className={styles.kpiValue}>{metrics.totalRooms}</div>
          <div className={styles.kpiSubtext} style={{ color: "var(--color-text-muted)" }}>
            {metrics.totalUsers} registered team members
          </div>
        </div>
      </div>

      {/* Two Column Layout: Room Utilization + Peak Hours Distribution */}
      <div className={styles.twoColGrid}>
        {/* Room Utilization */}
        <div className={styles.chartCard}>
          <div className={styles.chartCardHeader}>
            <div>
              <h3 className={styles.chartTitle}>Room Utilization</h3>
              <p className={styles.chartSubtitle}>Cumulative hours scheduled per space</p>
            </div>
            <BarChart3 size={16} color="#94a3b8" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {roomUtilization.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--color-text-subtle)", padding: "24px 0", textAlign: "center" }}>
                No room usage recorded yet.
              </p>
            ) : (
              roomUtilization.map((r, idx) => {
                const percent = Math.min(100, Math.round((r.hours / maxRoomHours) * 100));
                return (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            backgroundColor: r.color,
                          }}
                        />
                        <span style={{ fontWeight: 600, color: "var(--color-text-main)" }}>{r.name}</span>
                      </div>
                      <span style={{ fontWeight: 500, color: "var(--color-text-muted)" }}>
                        {r.hours} hrs ({r.bookingCount} bookings)
                      </span>
                    </div>
                    <div style={{ height: "8px", width: "100%", borderRadius: "var(--radius-full)", backgroundColor: "var(--color-surface-hover)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: "var(--radius-full)",
                          transition: "width 500ms ease",
                          width: `${percent}%`,
                          backgroundColor: r.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Peak Booking Hours Histogram */}
        <div className={styles.chartCard}>
          <div className={styles.chartCardHeader}>
            <div>
              <h3 className={styles.chartTitle}>Peak Hours Distribution</h3>
              <p className={styles.chartSubtitle}>Booking density from 08:00 to 20:00</p>
            </div>
            <Clock size={16} color="#94a3b8" />
          </div>

          {/* Bar Chart Visual */}
          <div className={styles.barChartArea}>
            {hourlyDistribution.map((slot, idx) => {
              const heightPercent =
                slot.count > 0 ? Math.max(12, Math.round((slot.count / maxHourlyCount) * 100)) : 4;

              return (
                <div key={idx} className={styles.barCol}>
                  <div
                    className={styles.barFill}
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor: slot.count > 0 ? "var(--color-primary)" : "var(--color-border)",
                    }}
                  />
                  <span className={styles.barLabel}>
                    {slot.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Department Usage Breakdown */}
      {departmentUsage.length > 0 && (
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Department Usage</h3>
          <p className={styles.chartSubtitle}>Meeting distribution by department</p>

          <div className={styles.deptGrid}>
            {departmentUsage.map((d, i) => (
              <div key={i} className={styles.deptCard}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{d.department}</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text-main)", marginTop: "2px" }}>
                  {d.count} meetings
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
