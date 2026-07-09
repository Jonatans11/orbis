/**
 * Usage tracking for ORBIS.ID API Gateway.
 * Logs each API call to team-db.
 */

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

function db(query: string): any[] {
  const out = execSync(`team-db "${query.replace(/"/g, '\\"')}"`, {
    encoding: "utf-8",
    timeout: 10_000,
  });
  return JSON.parse(out.trim() || "[]") as any[];
}

function generateId(): string {
  return randomBytes(16).toString("hex");
}

export interface UsageLog {
  id: string;
  api_key_id: string;
  method: string;
  path: string;
  status_code: number;
  response_time_ms: number;
  timestamp: string;
}

/**
 * Log a single API usage event.
 */
export function logUsage(
  apiKeyId: string,
  method: string,
  path: string,
  statusCode: number,
  responseTimeMs: number
): void {
  const id = generateId();
  const now = new Date().toISOString();
  const escapedPath = path.replace(/'/g, "''");

  db(
    `INSERT INTO ssi_api_usage (id, api_key_id, method, path, status_code, response_time_ms, timestamp) VALUES ('${id}', '${apiKeyId}', '${method}', '${escapedPath}', ${statusCode}, ${responseTimeMs}, '${now}')`
  );
}

/**
 * Get usage stats for an API key within a time range.
 */
export function getUsageStats(
  apiKeyId: string,
  since?: string
): {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgResponseTimeMs: number;
  byEndpoint: Record<string, number>;
  byMethod: Record<string, number>;
} {
  let whereClause = `WHERE api_key_id = '${apiKeyId}'`;
  if (since) {
    whereClause += ` AND timestamp >= '${since}'`;
  }

  const rows = db(
    `SELECT method, path, status_code, response_time_ms FROM ssi_api_usage ${whereClause}`
  ) as any[];

  if (rows.length === 0) {
    return {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      avgResponseTimeMs: 0,
      byEndpoint: {},
      byMethod: {},
    };
  }

  let totalResponseTime = 0;
  let successCount = 0;
  let errorCount = 0;
  const byEndpoint: Record<string, number> = {};
  const byMethod: Record<string, number> = {};

  for (const row of rows) {
    if (row.status_code < 400) {
      successCount++;
    } else {
      errorCount++;
    }
    totalResponseTime += row.response_time_ms || 0;

    const endpoint = row.path.split("?")[0]; // strip query params
    byEndpoint[endpoint] = (byEndpoint[endpoint] || 0) + 1;
    byMethod[row.method] = (byMethod[row.method] || 0) + 1;
  }

  return {
    totalRequests: rows.length,
    successCount,
    errorCount,
    avgResponseTimeMs: Math.round(totalResponseTime / rows.length),
    byEndpoint,
    byMethod,
  };
}

/**
 * Get aggregate usage stats across all keys (for admin).
 */
export function getAggregateStats(since?: string): {
  totalRequests: number;
  activeKeys: number;
} {
  let whereClause = "";
  if (since) {
    whereClause = `WHERE timestamp >= '${since}'`;
  }

  const countRows = db(
    `SELECT COUNT(*) as cnt FROM ssi_api_usage ${whereClause}`
  ) as any[];

  const activeRows = db(
    `SELECT COUNT(DISTINCT api_key_id) as cnt FROM ssi_api_usage ${whereClause}`
  ) as any[];

  return {
    totalRequests: countRows[0]?.cnt || 0,
    activeKeys: activeRows[0]?.cnt || 0,
  };
}
