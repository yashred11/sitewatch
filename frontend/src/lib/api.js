import { supabase } from "./supabase";

/** Fetch all active sites with last status */
export async function getSites() {
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

/** Fetch last N checks for a site (for sparkline) */
export async function getRecentChecks(siteId, limit = 60) {
  const { data, error } = await supabase
    .from("checks")
    .select("status, response_time_ms, checked_at")
    .eq("site_id", siteId)
    .order("checked_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  // Return oldest-first so sparkline renders left=old, right=now
  return (data || []).reverse();
}

/** Fetch 30-day uptime % for all sites */
export async function getUptimeStats() {
  const { data, error } = await supabase
    .from("site_uptime_30d")
    .select("*");
  if (error) throw error;
  // Return as a map: { siteId: uptimePct }
  return Object.fromEntries(
    (data || []).map((row) => [row.site_id, row.uptime_pct])
  );
}

/** Fetch recent incidents (last 30 days) */
export async function getIncidents(limit = 20) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("incidents")
    .select("*, sites(name, url, emoji)")
    .gte("started_at", thirtyDaysAgo.toISOString())
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Subscribe to real-time changes on the sites table */
export function subscribeSites(callback) {
  return supabase
    .channel("sites-realtime")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sites" },
      (payload) => callback(payload.new)
    )
    .subscribe();
}
