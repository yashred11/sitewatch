import { useEffect, useState } from "react";
import { getRecentChecks } from "../lib/api";

export default function SiteCard({ site, uptime }) {
  const [checks, setChecks] = useState([]);

  useEffect(() => {
    getRecentChecks(site.id, 60).then(setChecks).catch(console.error);
  }, [site.id]);

  const isDown      = site.last_status === "down";
  const lastCheck   = checks[checks.length - 1];
  const responseMs  = lastCheck?.response_time_ms ?? null;
  const uptimePct   = uptime ?? "—";

  // SSL days: not stored in DB in this version, placeholder
  const sslDays     = site.ssl_days ?? null;
  const sslStatus   = sslDays === null ? null : sslDays > 30 ? "ok" : "warn";

  return (
    <div className={`site-card${isDown ? " down" : ""}`}>
      {/* Top row */}
      <div className="card-top">
        <div className="card-favicon">{site.emoji || "🌐"}</div>
        <div className="card-info">
          <div className="card-name">{site.name}</div>
          <div className="card-url">{site.url.replace(/^https?:\/\//, "")}</div>
        </div>
        <div className="card-status">
          <div className={`status-dot ${site.last_status || "none"}`} />
          <div className={`status-label ${site.last_status || "none"}`}>
            {site.last_status === "up" ? "Up" : site.last_status === "down" ? "Down" : "—"}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="sparkline-wrap">
        <div className="sparkline-label">
          <span>24h history</span>
          <span>Now</span>
        </div>
        <div className="sparkline">
          {checks.length === 0
            ? Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="spark-block none" />
              ))
            : checks.map((c, i) => (
                <div
                  key={i}
                  className={`spark-block ${
                    c.status === "down" ? "err" :
                    c.response_time_ms > 2000 ? "slow" : "ok"
                  }`}
                  title={`${c.status === "down" ? "Down" : c.response_time_ms > 2000 ? "Slow" : "Up"} · ${
                    new Date(c.checked_at).toLocaleTimeString()
                  }`}
                />
              ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="card-metrics">
        <div className="metric">
          <div className="metric-label">Response</div>
          <div className={`metric-value ${
            responseMs === null ? "bad" :
            responseMs > 1000  ? "warn" : "good"
          }`}>
            {responseMs !== null ? `${responseMs}ms` : "—"}
          </div>
        </div>

        <div className="metric">
          <div className="metric-label">Uptime 30d</div>
          <div className={`metric-value ${
            uptimePct === "—"    ? "" :
            uptimePct >= 99      ? "good" :
            uptimePct >= 95      ? "warn" : "bad"
          }`}>
            {uptimePct !== "—" ? `${uptimePct}%` : "—"}
          </div>
        </div>

        <div className="metric">
          <div className="metric-label">SSL cert</div>
          {sslStatus ? (
            <span className={`ssl-badge ${sslStatus}`}>
              {sslStatus === "ok" ? "✓" : "⚠"} {sslDays}d
            </span>
          ) : (
            <span className="metric-value">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
