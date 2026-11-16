import { useEffect, useState, useCallback } from "react";
import SiteCard from "../components/SiteCard";
import IncidentLog from "../components/IncidentLog";
import { getSites, getUptimeStats, getIncidents, subscribeSites } from "../lib/api";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [sites, setSites]         = useState([]);
  const [uptime, setUptime]       = useState({});
  const [incidents, setIncidents] = useState([]);
  const [filter, setFilter]       = useState("all");
  const [lastRun, setLastRun]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [secAgo, setSecAgo]       = useState(0);

  const load = useCallback(async () => {
    try {
      const [s, u, i] = await Promise.all([
        getSites(),
        getUptimeStats(),
        getIncidents(),
      ]);
      setSites(s);
      setUptime(u);
      setIncidents(i);
      setLastRun(new Date());
      setSecAgo(0);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Real-time subscription: when Python updates a site row, dashboard reflects it instantly
  useEffect(() => {
    const channel = subscribeSites((updatedSite) => {
      setSites((prev) =>
        prev.map((s) => (s.id === updatedSite.id ? { ...s, ...updatedSite } : s))
      );
    });
    return () => supabase.removeChannel(channel);
  }, []);

  // Last-check elapsed counter
  useEffect(() => {
    const timer = setInterval(() => setSecAgo((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [lastRun]);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  // Derived stats
  const downSites   = sites.filter((s) => s.last_status === "down");
  const upSites     = sites.filter((s) => s.last_status === "up");
  const avgUptime   = Object.values(uptime).length
    ? (Object.values(uptime).reduce((a, b) => a + Number(b), 0) / Object.values(uptime).length).toFixed(1)
    : "—";

  const filtered = filter === "all" ? sites
    : sites.filter((s) => s.last_status === filter);

  const hasDown = downSites.length > 0;

  function lastCheckLabel() {
    if (secAgo < 60) return `${secAgo}s ago`;
    return `${Math.floor(secAgo / 60)}m ago`;
  }

  return (
    <div>
      {/* TOPBAR */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="white" />
              <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="1.5" fill="none" opacity="0.4" />
              <circle cx="8" cy="8" r="8" stroke="white" strokeWidth="1" fill="none" opacity="0.15" />
            </svg>
          </div>
          <div>
            <div className="logo-text">SiteWatch</div>
            <div className="logo-sub">Infrastructure</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="last-check">
            Last check: <span>{loading ? "loading…" : lastCheckLabel()}</span>
          </div>
          <button className="refresh-btn" onClick={load}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 6A4 4 0 1 1 6 2V1M6 1L8 3M6 1L4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
          <button className="refresh-btn" onClick={handleSignOut} style={{ color: "var(--text-muted)" }}>
            Sign out
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="main">

        {/* HERO */}
        <div className="hero">
          <div className="hero-label">Infrastructure Status</div>

          <div className={`hero-status-banner${hasDown ? " has-down" : ""}`}>
            <div className="hero-pulse" />
            <div className={`hero-status-text${hasDown ? " has-problem" : " all-good"}`}>
              {loading ? "Loading…"
                : hasDown ? `${downSites.length} Site${downSites.length > 1 ? "s" : ""} Down`
                : "All Systems Operational"}
            </div>
            {hasDown && (
              <div className="hero-status-sub">
                {downSites.map((s) => s.name).join(", ")}
              </div>
            )}
          </div>

          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-label">Total Sites</div>
              <div className="stat-value blue">{sites.length}</div>
              <div className="stat-hint">Monitored properties</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Currently Up</div>
              <div className="stat-value green">{upSites.length}</div>
              <div className="stat-hint">Responding normally</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Currently Down</div>
              <div className={`stat-value ${downSites.length > 0 ? "red" : "green"}`}>
                {downSites.length}
              </div>
              <div className="stat-hint">Requires attention</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Uptime · 30d</div>
              <div className="stat-value green">{avgUptime !== "—" ? `${avgUptime}%` : "—"}</div>
              <div className="stat-hint">Across all properties</div>
            </div>
          </div>
        </div>

        {/* SITES */}
        <div className="section-header">
          <div className="section-title">Monitored Sites</div>
          <div className="filter-tabs">
            {["all", "up", "down"].map((f) => (
              <button
                key={f}
                className={`tab-btn${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="site-grid">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="site-card shimmer" style={{ height: 180 }} />
              ))
            : filtered.map((site) => (
                <SiteCard key={site.id} site={site} uptime={uptime[site.id]} />
              ))}
        </div>

        {/* INCIDENTS */}
        <div className="incident-section">
          <div className="section-header">
            <div className="section-title">Incident History · Last 30 days</div>
            <div className="section-count">{incidents.length} incidents</div>
          </div>
          <IncidentLog incidents={incidents} />
        </div>

      </main>

      {/* FOOTER */}
      <footer className="footer" style={{ maxWidth: 1180, margin: "0 auto", marginTop: 48 }}>
        <div className="footer-left">
          <strong>SiteWatch</strong> · Checks every 5 minutes via GitHub Actions · Data in Supabase
        </div>
        <div className="uptime-legend">
          {[
            { color: "var(--green)", opacity: 0.65, label: "Up" },
            { color: "var(--yellow)", opacity: 1,    label: "Slow" },
            { color: "var(--red)",   opacity: 1,    label: "Down" },
            { color: "var(--border)",opacity: 1,    label: "No data" },
          ].map(({ color, opacity, label }) => (
            <div key={label} className="legend-item">
              <div className="legend-block" style={{ background: color, opacity }} />
              {label}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
