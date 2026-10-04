import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const token = process.env.MOTHERDUCK_TOKEN;
    if (!token) {
      throw new Error("MOTHERDUCK_TOKEN environment variable is not set.");
    }

    pool = new Pool({
      host: process.env.MOTHERDUCK_HOST || "pg.ap-northeast-1-aws.motherduck.com",
      port: 5432,
      user: "postgres",
      password: token,
      database: "roblox_trends",
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function GET(request: NextRequest) {
  try {
    const token = process.env.MOTHERDUCK_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "MOTHERDUCK_TOKEN environment variable is not set." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200)
      : 100;

    const query = `
      WITH ranked_metrics AS (
        SELECT 
          universe_id,
          timestamp,
          ccu,
          visits,
          upvotes,
          downvotes,
          ROW_NUMBER() OVER (PARTITION BY universe_id ORDER BY timestamp DESC) AS rn
        FROM metrics
      ),
      latest AS (
        SELECT * FROM ranked_metrics WHERE rn = 1
      ),
      previous AS (
        SELECT universe_id, ccu AS prev_ccu FROM ranked_metrics WHERE rn = 2
      ),
      history AS (
        SELECT 
          universe_id,
          LIST(ccu ORDER BY timestamp ASC) AS ccu_history,
          MAX(ccu) AS peak_ccu
        FROM (
          SELECT universe_id, timestamp, ccu
          FROM ranked_metrics
          WHERE rn <= 10
        )
        GROUP BY universe_id
      )
      SELECT 
        g.universe_id,
        g.name,
        g.description,
        g.created_at,
        COALESCE(g.cluster_label, 'Unclassified') AS genre,
        m.ccu,
        p.prev_ccu,
        (m.ccu - COALESCE(p.prev_ccu, m.ccu)) AS ccu_diff,
        ROUND(((m.ccu - COALESCE(p.prev_ccu, m.ccu)) * 100.0) / NULLIF(p.prev_ccu, 0), 1) AS ccu_pct_change,
        m.visits,
        m.upvotes,
        m.downvotes,
        m.timestamp,
        h.peak_ccu,
        h.ccu_history
      FROM latest m
      LEFT JOIN previous p ON m.universe_id = p.universe_id
      LEFT JOIN history h ON m.universe_id = h.universe_id
      LEFT JOIN games g ON m.universe_id = g.universe_id
      ORDER BY m.ccu DESC
      LIMIT ${limit};
    `;

    const clientPool = getPool();
    const result = await clientPool.query(query);

    return NextResponse.json(result.rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Failed to query MotherDuck:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
