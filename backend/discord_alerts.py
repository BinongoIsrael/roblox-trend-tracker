"""Discord webhook notification utility for Roblox game player surges."""

import json
import os
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional
import urllib.request
from dotenv import load_dotenv
import duckdb

# Load environment variables
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv('../.env')
load_dotenv()

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def check_surging_games(
    min_pct_surge: float = 15.0,
    min_ccu_diff: int = 5000,
    limit: int = 5
) -> List[Dict[str, Any]]:
    """Queries MotherDuck for games experiencing significant CCU velocity surges."""
    token = os.environ.get("MOTHERDUCK_TOKEN")
    if not token:
        print("[ERROR] MOTHERDUCK_TOKEN is not set.")
        return []

    query = f"""
    WITH ranked_metrics AS (
        SELECT 
            universe_id,
            timestamp,
            ccu,
            visits,
            ROW_NUMBER() OVER (PARTITION BY universe_id ORDER BY timestamp DESC) AS rn
        FROM metrics
    ),
    latest AS (
        SELECT * FROM ranked_metrics WHERE rn = 1
    ),
    previous AS (
        SELECT universe_id, ccu AS prev_ccu FROM ranked_metrics WHERE rn = 2
    )
    SELECT 
        g.universe_id,
        g.name,
        COALESCE(g.cluster_label, 'Unclassified') AS genre,
        m.ccu,
        p.prev_ccu,
        (m.ccu - COALESCE(p.prev_ccu, m.ccu)) AS ccu_diff,
        ROUND(((m.ccu - COALESCE(p.prev_ccu, m.ccu)) * 100.0) / NULLIF(p.prev_ccu, 0), 1) AS ccu_pct_change,
        m.visits,
        m.timestamp
    FROM latest m
    JOIN previous p ON m.universe_id = p.universe_id
    JOIN games g ON m.universe_id = g.universe_id
    WHERE (
        ROUND(((m.ccu - COALESCE(p.prev_ccu, m.ccu)) * 100.0) / NULLIF(p.prev_ccu, 0), 1) >= {min_pct_surge}
        OR (m.ccu - p.prev_ccu) >= {min_ccu_diff}
    )
    ORDER BY ccu_pct_change DESC
    LIMIT {limit};
    """

    with duckdb.connect(f"md:roblox_trends?motherduck_token={token}") as con:
        df = con.execute(query).df()
        if df.empty:
            return []
        return df.to_dict(orient="records")


def send_discord_alert(games: List[Dict[str, Any]], webhook_url: Optional[str] = None) -> bool:
    """Dispatches a structured webhook notification to a Discord channel."""
    url = webhook_url or os.environ.get("DISCORD_WEBHOOK_URL")
    if not url:
        print(f"[INFO] DISCORD_WEBHOOK_URL not configured. Identified {len(games)} surging games (Dry-run mode).")
        for g in games:
            print(f"  ⚡ {g['name']}: {g['ccu']:,} CCU (+{g['ccu_pct_change']}%) [{g['genre']}]")
        return False

    fields = []
    for g in games[:5]:
        play_url = f"https://www.roblox.com/discover/?Keyword={urllib.request.quote(str(g['name']))}"
        fields.append({
            "name": f"🚀 {g['name']}",
            "value": (
                f"**CCU:** {g['ccu']:,} (`+{g['ccu_pct_change']}%` / `+{g['ccu_diff']:,}` players)\n"
                f"**Genre:** {g['genre']}\n"
                f"**Visits:** {int(g['visits']):,}\n"
                f"[Play on Roblox]({play_url})"
            ),
            "inline": False
        })

    payload = {
        "username": "Roblox Trend Bot",
        "avatar_url": "https://images.rbxcdn.com/2b35649ec76f18378546f14a09a56e2c.ico",
        "embeds": [
            {
                "title": f"🚨 {len(games)} Roblox Game(s) Surging in Players!",
                "description": "Detected sudden momentum surge from the MotherDuck trend tracker stream.",
                "color": 0x10B981,  # Emerald
                "fields": fields,
                "footer": {
                    "text": "Roblox Trend Tracker // MotherDuck Pipeline"
                }
            }
        ]
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "RobloxTrendTracker/1.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            print(f"[INFO] Webhook delivered with status code {status}.")
            return status in (200, 204)
    except Exception as e:
        print(f"[ERROR] Failed to send Discord webhook: {e}")
        return False


def main():
    print("[INFO] Checking for surging experiences...")
    surges = check_surging_games()
    if not surges:
        print("[INFO] No surge triggers detected in current telemetry snapshot.")
        return
    send_discord_alert(surges)


if __name__ == "__main__":
    main()
