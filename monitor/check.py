"""
SiteWatch – website monitor
Runs every 5 minutes via GitHub Actions.
Reads site list from Supabase, checks each site,
writes results back, and fires alerts on state changes.
"""

import os
import time
import json
import smtplib
import requests
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from supabase import create_client, Client

# ── CONFIG ────────────────────────────────────────────────────────────────────
SUPABASE_URL     = os.environ["SUPABASE_URL"]
SUPABASE_KEY     = os.environ["SUPABASE_SERVICE_KEY"]

# Email (Gmail / Google Workspace SMTP)
SMTP_HOST        = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT        = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER        = os.environ["SMTP_USER"]          # e.g. alerts@cyble.com
SMTP_PASS        = os.environ["SMTP_PASS"]          # App password, not account password
ALERT_TO         = os.environ["ALERT_TO"]           # Comma-separated recipient emails

# Google Chat webhook (optional)
GOOGLE_CHAT_WEBHOOK = os.environ.get("GOOGLE_CHAT_WEBHOOK", "")

# Request settings
TIMEOUT_SECONDS  = 10
CHECK_KEYWORD    = ""   # Optional: string that must appear in response body

# ── SUPABASE CLIENT ───────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── HELPERS ───────────────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def check_site(site: dict) -> dict:
    """
    Perform an HTTP GET on the site URL.
    Returns a result dict with status, http_code, response_time_ms, error.
    """
    url = site["url"]
    start = time.time()

    try:
        resp = requests.get(
            url,
            timeout=TIMEOUT_SECONDS,
            allow_redirects=True,
            headers={"User-Agent": "SiteWatch/1.0 (uptime monitor)"},
        )
        elapsed_ms = int((time.time() - start) * 1000)

        # Optional keyword check
        if CHECK_KEYWORD and CHECK_KEYWORD not in resp.text:
            return {
                "status": "down",
                "http_code": resp.status_code,
                "response_time_ms": elapsed_ms,
                "error": f"Keyword '{CHECK_KEYWORD}' not found in response body",
            }

        status = "up" if resp.status_code < 400 else "down"
        return {
            "status": status,
            "http_code": resp.status_code,
            "response_time_ms": elapsed_ms,
            "error": None,
        }

    except requests.exceptions.Timeout:
        return {
            "status": "down",
            "http_code": None,
            "response_time_ms": int((time.time() - start) * 1000),
            "error": f"Connection timed out after {TIMEOUT_SECONDS}s",
        }
    except requests.exceptions.ConnectionError as e:
        return {
            "status": "down",
            "http_code": None,
            "response_time_ms": int((time.time() - start) * 1000),
            "error": f"Connection error: {str(e)[:120]}",
        }
    except Exception as e:
        return {
            "status": "down",
            "http_code": None,
            "response_time_ms": int((time.time() - start) * 1000),
            "error": str(e)[:200],
        }


# ── ALERTING ──────────────────────────────────────────────────────────────────
def send_email_alert(site: dict, result: dict, event: str):
    """
    Send an email alert via Google Workspace SMTP.
    event is either 'down' or 'recovered'.
    """
    subject_map = {
        "down":      f"🔴 ALERT: {site['name']} is DOWN",
        "recovered": f"🟢 RESOLVED: {site['name']} is back UP",
    }
    color_map = {
        "down":      "#F43F5E",
        "recovered": "#10B981",
    }

    subject = subject_map[event]
    color   = color_map[event]

    if event == "down":
        body_line = f"{site['url']} is not responding."
        detail    = result.get("error") or f"HTTP {result.get('http_code')}"
        action    = "Please investigate immediately."
    else:
        body_line = f"{site['url']} is responding normally."
        detail    = f"HTTP {result.get('http_code')} · {result.get('response_time_ms')}ms"
        action    = "No further action required."

    html = f"""
    <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#0D0D0F;color:#F0EEF8;border-radius:12px;overflow:hidden;">
      <div style="background:{color};padding:16px 24px;">
        <span style="font-size:16px;font-weight:700;color:#fff;">{subject}</span>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 8px;font-size:15px;font-weight:600;">{site['name']}</p>
        <p style="margin:0 0 16px;font-size:13px;color:#9693A8;">{body_line}</p>
        <div style="background:#18181C;border:1px solid #26262E;border-radius:8px;padding:14px 16px;font-family:monospace;font-size:12px;color:#9693A8;margin-bottom:16px;">
          <div>Time: {now_iso()}</div>
          <div>Detail: {detail}</div>
          <div>URL: {site['url']}</div>
        </div>
        <p style="margin:0;font-size:13px;color:#9693A8;">{action}</p>
      </div>
      <div style="padding:12px 24px;border-top:1px solid #26262E;font-size:11px;color:#55536A;">
        SiteWatch · CRIL Infrastructure Monitor · Automated alert
      </div>
    </div>
    """

    recipients = [r.strip() for r in ALERT_TO.split(",") if r.strip()]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"SiteWatch <{SMTP_USER}>"
    msg["To"]      = ", ".join(recipients)
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, recipients, msg.as_string())
        print(f"  [email] Alert sent to {recipients}")
    except Exception as e:
        print(f"  [email] Failed: {e}")


def send_google_chat_alert(site: dict, result: dict, event: str):
    """
    Send a Google Chat space webhook message.
    Set GOOGLE_CHAT_WEBHOOK in GitHub secrets.
    """
    if not GOOGLE_CHAT_WEBHOOK:
        return

    if event == "down":
        icon  = "🔴"
        title = f"{icon} *{site['name']}* is DOWN"
        detail = result.get("error") or f"HTTP {result.get('http_code')}"
        text  = f"{title}\n`{site['url']}`\nReason: {detail}\nTime: {now_iso()}"
    else:
        icon  = "🟢"
        title = f"{icon} *{site['name']}* recovered"
        text  = f"{title}\n`{site['url']}`\nHTTP {result.get('http_code')} · {result.get('response_time_ms')}ms\nTime: {now_iso()}"

    payload = {"text": text}

    try:
        resp = requests.post(GOOGLE_CHAT_WEBHOOK, json=payload, timeout=10)
        print(f"  [google-chat] Webhook response: {resp.status_code}")
    except Exception as e:
        print(f"  [google-chat] Failed: {e}")


def fire_alerts(site: dict, result: dict, event: str):
    send_email_alert(site, result, event)
    send_google_chat_alert(site, result, event)


# ── SUPABASE OPERATIONS ───────────────────────────────────────────────────────
def get_sites() -> list:
    resp = supabase.table("sites").select("*").eq("active", True).execute()
    return resp.data or []


def get_last_state(site_id: int) -> str | None:
    """Return the last recorded status for this site."""
    resp = (
        supabase.table("checks")
        .select("status")
        .eq("site_id", site_id)
        .order("checked_at", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]["status"]
    return None


def write_check(site_id: int, result: dict):
    supabase.table("checks").insert({
        "site_id":         site_id,
        "status":          result["status"],
        "http_code":       result.get("http_code"),
        "response_time_ms": result.get("response_time_ms"),
        "error":           result.get("error"),
        "checked_at":      now_iso(),
    }).execute()


def open_incident(site_id: int, reason: str):
    supabase.table("incidents").insert({
        "site_id":    site_id,
        "started_at": now_iso(),
        "reason":     reason,
        "resolved":   False,
    }).execute()


def close_incident(site_id: int):
    """Mark the most recent open incident for this site as resolved."""
    resp = (
        supabase.table("incidents")
        .select("id")
        .eq("site_id", site_id)
        .eq("resolved", False)
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data:
        incident_id = resp.data[0]["id"]
        supabase.table("incidents").update({
            "resolved":    True,
            "resolved_at": now_iso(),
        }).eq("id", incident_id).execute()


def update_site_status(site_id: int, status: str):
    supabase.table("sites").update({
        "last_status":     status,
        "last_checked_at": now_iso(),
    }).eq("id", site_id).execute()


# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    print(f"[{now_iso()}] SiteWatch run starting")

    sites = get_sites()
    if not sites:
        print("No active sites found in Supabase. Add rows to the 'sites' table.")
        return

    print(f"Checking {len(sites)} sites…\n")

    for site in sites:
        site_id = site["id"]
        name    = site["name"]
        url     = site["url"]

        print(f"→ {name} ({url})")

        result     = check_site(site)
        last_state = get_last_state(site_id)
        new_state  = result["status"]

        print(f"  status={new_state}  code={result.get('http_code')}  "
              f"time={result.get('response_time_ms')}ms  "
              f"error={result.get('error') or '—'}")

        # Write raw check result
        write_check(site_id, result)
        update_site_status(site_id, new_state)

        # State transition: up → down
        if last_state != "down" and new_state == "down":
            print(f"  ⚠ NEWLY DOWN — opening incident and sending alerts")
            open_incident(site_id, result.get("error") or f"HTTP {result.get('http_code')}")
            fire_alerts(site, result, "down")

        # State transition: down → up
        elif last_state == "down" and new_state == "up":
            print(f"  ✓ RECOVERED — closing incident and sending alerts")
            close_incident(site_id)
            fire_alerts(site, result, "recovered")

        print()

    # Prune checks older than 90 days to keep Supabase free tier storage flat
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    supabase.table("checks").delete().lt("checked_at", cutoff).execute()
    print(f"[cleanup] Pruned checks older than {cutoff[:10]}")

    print(f"[{now_iso()}] Run complete.")


if __name__ == "__main__":
    main()
