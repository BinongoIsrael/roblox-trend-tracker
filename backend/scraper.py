import asyncio
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional
import aiohttp
from dotenv import load_dotenv
import duckdb

load_dotenv('../.env')
load_dotenv()

# Ensure UTF-8 output on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("scraper")

DB_PATH = Path(__file__).resolve().parent / "roblox_trends.duckdb"

# API Endpoints with proxy fallback for resilience
EXPLORE_API_PRIMARY = (
    "https://apis.roblox.com/explore-api/v1/get-sort-content"
    "?sortId=top-trending&sessionId=ml_pipeline_worker&device=computer"
)
EXPLORE_API_FALLBACK = (
    "https://apis.roproxy.com/explore-api/v1/get-sort-content"
    "?sortId=top-trending&sessionId=ml_pipeline_worker&device=computer"
)

GAMES_API_PRIMARY = "https://games.roblox.com/v1/games"
GAMES_API_FALLBACK = "https://games.roproxy.com/v1/games"

BATCH_SIZE = 50
BATCH_DELAY_SECONDS = 1.0
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=8)
HEADERS = {
    "User-Agent": "RobloxTrendTracker/1.0 (MachineLearningPipeline)",
    "Accept": "application/json",
}


def chunk_list(items: List[Any], chunk_size: int) -> List[List[Any]]:
    """Splits a list into chunks of at most chunk_size items."""
    return [items[i : i + chunk_size] for i in range(0, len(items), chunk_size)]


class RobloxClient:
    """Manages HTTP requests with automatic endpoint detection and fallback."""

    def __init__(self, session: aiohttp.ClientSession) -> None:
        self.session = session
        self.use_fallback = False

    async def fetch_json(
        self,
        primary_url: str,
        fallback_url: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Fetches JSON, prioritizing primary URL or fallback if primary previously failed."""
        urls_to_try = []
        if self.use_fallback and fallback_url:
            urls_to_try = [fallback_url, primary_url]
        else:
            urls_to_try = [primary_url]
            if fallback_url:
                urls_to_try.append(fallback_url)

        for idx, url in enumerate(urls_to_try):
            is_fallback = (url == fallback_url)
            try:
                # Fast timeout (3s) for primary if not yet confirmed, standard for fallback
                timeout = aiohttp.ClientTimeout(total=4 if not is_fallback else 10)
                async with self.session.get(url, timeout=timeout) as resp:
                    if resp.status == 200:
                        if is_fallback and not self.use_fallback:
                            logger.info(
                                "Direct endpoint unreachable from this network; switching to proxy mirror (%s).",
                                url.split("/")[2],
                            )
                            self.use_fallback = True
                        return await resp.json()
                    logger.warning("URL returned HTTP %s: %s", resp.status, url)
            except Exception as exc:
                if not is_fallback:
                    logger.info(
                        "Primary endpoint attempt failed (%s: %s).",
                        type(exc).__name__,
                        exc,
                    )
                else:
                    logger.error(
                        "Fallback endpoint failed (%s: %s).",
                        type(exc).__name__,
                        exc,
                    )

        return None


async def run_scraper(db_path: Optional[Any] = None) -> None:
    """Executes the data scraping and ingestion workflow."""
    logger.info("Starting ingestion scraper. Target database: roblox_trends")

    async with aiohttp.ClientSession(headers=HEADERS) as session:
        client = RobloxClient(session)

        # Step 1: Fetch top trending games from Explore API
        logger.info("Fetching top trending games from Explore API...")
        explore_data = await client.fetch_json(
            EXPLORE_API_PRIMARY, EXPLORE_API_FALLBACK
        )
        if not explore_data or "games" not in explore_data:
            logger.error("Failed to retrieve games from Explore API. Aborting.")
            return

        trending_games = explore_data.get("games", [])
        logger.info("Retrieved %d trending games from Explore API.", len(trending_games))

        # Build explore metadata mapping for votes and fast lookup
        explore_meta: Dict[int, Dict[str, Any]] = {}
        universe_ids: List[int] = []
        for g in trending_games:
            u_id = g.get("universeId")
            if u_id is not None:
                universe_ids.append(u_id)
                explore_meta[u_id] = {
                    "totalUpVotes": g.get("totalUpVotes", 0),
                    "totalDownVotes": g.get("totalDownVotes", 0),
                    "playerCount": g.get("playerCount", 0),
                }

        # Step 2: Chunk into batches of 50
        batches = chunk_list(universe_ids, BATCH_SIZE)
        logger.info(
            "Chunked %d universe IDs into %d batch(es) of up to %d.",
            len(universe_ids),
            len(batches),
            BATCH_SIZE,
        )

        # Step 3: Fetch live metrics for each batch asynchronously with 1s delay
        fetched_games: List[Dict[str, Any]] = []
        for idx, batch in enumerate(batches):
            if idx > 0:
                logger.info(
                    "Waiting %0.1fs before next batch to respect rate limits...",
                    BATCH_DELAY_SECONDS,
                )
                await asyncio.sleep(BATCH_DELAY_SECONDS)

            batch_param = ",".join(map(str, batch))
            primary_batch_url = f"{GAMES_API_PRIMARY}?universeIds={batch_param}"
            fallback_batch_url = f"{GAMES_API_FALLBACK}?universeIds={batch_param}"

            logger.info(
                "Fetching batch %d/%d (%d universe IDs)...",
                idx + 1,
                len(batches),
                len(batch),
            )
            batch_result = await client.fetch_json(
                primary_batch_url, fallback_batch_url
            )
            if batch_result and "data" in batch_result:
                data_items = batch_result["data"]
                fetched_games.extend(data_items)
                logger.info(
                    "Batch %d/%d successfully retrieved %d game details.",
                    idx + 1,
                    len(batches),
                    len(data_items),
                )
            else:
                logger.warning("Batch %d/%d returned no game data.", idx + 1, len(batches))

        # Step 4: Ingest into DuckDB
        logger.info(
            "Ingesting %d game records into DuckDB (roblox_trends)...",
            len(fetched_games),
        )
        snapshot_time = datetime.now(timezone.utc)

        with duckdb.connect(f"md:roblox_trends?motherduck_token={os.environ.get('MOTHERDUCK_TOKEN')}") as con:
            games_inserted = 0
            metrics_inserted = 0

            for game in fetched_games:
                universe_id = game.get("id")
                if universe_id is None:
                    continue

                name = game.get("name")
                description = game.get("description")
                created_at = game.get("created")
                game_updated_at = game.get("updated")

                # Insert or ignore into games
                con.execute(
                    """
                    INSERT OR IGNORE INTO games (
                        universe_id,
                        name,
                        description,
                        created_at,
                        game_updated_at
                    ) VALUES (?, ?, ?, ?, ?);
                    """,
                    [universe_id, name, description, created_at, game_updated_at],
                )
                games_inserted += 1

                # Extract metric fields
                ccu = game.get("playing", 0)
                visits = game.get("visits", 0)

                # Prioritize vote counts from payload, fallback to Explore API metadata
                meta = explore_meta.get(universe_id, {})
                upvotes = (
                    game.get("upVotes")
                    or game.get("upvotes")
                    or meta.get("totalUpVotes", 0)
                )
                downvotes = (
                    game.get("downVotes")
                    or game.get("downvotes")
                    or meta.get("totalDownVotes", 0)
                )

                # Insert snapshot record into metrics
                con.execute(
                    """
                    INSERT INTO metrics (
                        universe_id,
                        timestamp,
                        ccu,
                        visits,
                        upvotes,
                        downvotes
                    ) VALUES (?, ?, ?, ?, ?, ?);
                    """,
                    [universe_id, snapshot_time, ccu, visits, upvotes, downvotes],
                )
                metrics_inserted += 1

            # Step 5: Rolling retention window - delete records older than 30 days
            logger.info("Enforcing 30-day rolling retention window on metrics table...")
            con.execute(
                """
                DELETE FROM metrics
                WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL 30 DAY;
                """
            )

        logger.info(
            "Ingestion complete. Processed %d games and %d metrics snapshots.",
            games_inserted,
            metrics_inserted,
        )


def verify_database(db_path: Optional[Any] = None) -> None:
    """Queries and displays summary statistics to verify table population."""
    print("\n================== Ingestion Verification ==================")
    with duckdb.connect(f"md:roblox_trends?motherduck_token={os.environ.get('MOTHERDUCK_TOKEN')}") as con:
        total_games = con.execute("SELECT COUNT(*) FROM games;").fetchone()[0]
        total_metrics = con.execute("SELECT COUNT(*) FROM metrics;").fetchone()[0]
        print(f"Total rows in 'games' table:   {total_games}")
        print(f"Total rows in 'metrics' table: {total_metrics}")

        print("\n--- Top 10 Trending Games by CCU (Latest Snapshot) ---")
        query = """
            SELECT 
                g.universe_id,
                g.name,
                m.ccu,
                m.visits,
                m.upvotes,
                m.downvotes,
                m.timestamp
            FROM metrics m
            JOIN games g ON m.universe_id = g.universe_id
            ORDER BY m.ccu DESC
            LIMIT 10;
        """
        rows = con.execute(query).fetchall()
        header = f"{'Universe ID':<12} {'Game Name':<32} {'CCU':<10} {'Visits':<14} {'Upvotes':<10} {'Downvotes':<10}"
        print(header)
        print("-" * len(header))
        for uid, name, ccu, visits, up, down, ts in rows:
            clean_name = (name[:29] + "...") if len(name) > 32 else name
            print(
                f"{uid:<12} {clean_name:<32} {ccu:<10} {visits:<14} {up:<10} {down:<10}"
            )
    print("============================================================\n")


def main() -> None:
    asyncio.run(run_scraper())
    verify_database()


if __name__ == "__main__":
    main()
