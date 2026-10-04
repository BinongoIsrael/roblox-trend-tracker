import { NextResponse } from "next/server";
import { DuckDBInstance } from "@duckdb/node-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = process.env.MOTHERDUCK_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "MOTHERDUCK_TOKEN environment variable is not set." },
        { status: 500 }
      );
    }

    const instance = await DuckDBInstance.create(
      `md:roblox_trends?motherduck_token=${process.env.MOTHERDUCK_TOKEN}`
    );
    const connection = await instance.connect();

    const query = `
      WITH latest_metrics AS (
        SELECT 
          universe_id,
          timestamp,
          ccu,
          visits,
          upvotes,
          downvotes,
          ROW_NUMBER() OVER (PARTITION BY universe_id ORDER BY timestamp DESC) AS rn
        FROM metrics
      )
      SELECT 
        g.universe_id,
        g.name,
        g.description,
        m.ccu,
        m.visits,
        m.upvotes,
        m.downvotes,
        m.timestamp
      FROM latest_metrics m
      JOIN games g ON m.universe_id = g.universe_id
      WHERE m.rn = 1
      ORDER BY m.ccu DESC
      LIMIT 10;
    `;

    const reader = await connection.runAndReadAll(query);
    const rows = reader.getRowObjectsJson();

    return NextResponse.json(rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Failed to query MotherDuck:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
