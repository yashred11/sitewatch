export default function IncidentLog({ incidents }) {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="incident-table">
        <div className="empty-incidents">
          <div className="empty-icon">✅</div>
          <div className="empty-label">No incidents in the last 30 days</div>
          <div className="empty-sub">All sites have been running without recorded downtime.</div>
        </div>
      </div>
    );
  }

  function formatDuration(startedAt, resolvedAt) {
    if (!resolvedAt) return "Ongoing";
    const ms = new Date(resolvedAt) - new Date(startedAt);
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit",
      hour12: false,
    });
  }

  return (
    <div className="incident-table">
      <div className="incident-row header">
        <span>Site</span>
        <span>Reason</span>
        <span>Started</span>
        <span>Duration</span>
        <span>Status</span>
      </div>
      {incidents.map((inc) => (
        <div key={inc.id} className="incident-row">
          <div className="incident-site">
            {inc.sites?.emoji} {inc.sites?.name}
          </div>
          <div className="incident-reason">{inc.reason || "Unknown"}</div>
          <div className="incident-time">{formatTime(inc.started_at)}</div>
          <div className="incident-duration">
            {formatDuration(inc.started_at, inc.resolved_at)}
          </div>
          <div>
            <span className={`badge ${inc.resolved ? "resolved" : "ongoing"}`}>
              {inc.resolved ? "✓ Resolved" : "● Ongoing"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
