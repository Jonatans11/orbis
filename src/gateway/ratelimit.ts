/**
 * Token Bucket Rate Limiter for ORBIS.ID API Gateway.
 * Uses team-db for persistence with dynamic tiered subscription quotas.
 */

import { execSync } from "node:child_process";

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  refillIntervalMs: number; // how often to refill (ms)
}

const PLAN_CONFIGS: Record<string, RateLimitConfig> = {
  free: {
    maxTokens: 100,
    refillRate: 100 / 60, // 100 tokens per minute ≈ 1.67 tokens/sec
    refillIntervalMs: 1000,
  },
  developer: {
    maxTokens: 1000,
    refillRate: 1000 / 60, // 1000 tokens per minute ≈ 16.67 tokens/sec
    refillIntervalMs: 1000,
  },
  enterprise: {
    maxTokens: 10000,
    refillRate: 10000 / 60, // 10000 tokens per minute ≈ 166.67 tokens/sec
    refillIntervalMs: 1000,
  }
};

function db(query: string): any[] {
  const out = execSync(`team-db "${query.replace(/"/g, '\\"')}"`, {
    encoding: "utf-8",
    timeout: 10_000,
  });
  return JSON.parse(out.trim() || "[]") as any[];
}

/**
 * Helper to fetch the subscription plan assigned to an API key.
 */
function getApiKeyPlan(apiKeyId: string): "free" | "developer" | "enterprise" {
  const rows = db(`SELECT plan FROM api_keys WHERE id = '${apiKeyId}'`) as any[];
  if (rows.length === 0) return "free";
  return (rows[0].plan || "free") as "free" | "developer" | "enterprise";
}

/**
 * Ensure a rate limit bucket exists for an API key.
 */
function ensureBucket(apiKeyId: string, maxTokens: number): void {
  const rows = db(
    `SELECT api_key_id, tokens, last_refill FROM rate_limits WHERE api_key_id = '${apiKeyId}'`
  ) as any[];

  if (rows.length === 0) {
    const now = new Date().toISOString();
    db(
      `INSERT INTO rate_limits (api_key_id, tokens, last_refill) VALUES ('${apiKeyId}', ${maxTokens}, '${now}')`
    );
  }
}

/**
 * Persist bucket state to DB.
 */
function saveBucket(apiKeyId: string, tokens: number, lastRefill: number): void {
  const lastRefillStr = new Date(lastRefill).toISOString();
  db(
    `UPDATE rate_limits SET tokens = ${tokens}, last_refill = '${lastRefillStr}' WHERE api_key_id = '${apiKeyId}'`
  );
}

/**
 * Check if a request should be allowed based on token bucket.
 * Returns { allowed: boolean, remaining: number, resetMs: number }.
 */
export function checkRateLimit(
  apiKeyId: string,
  cost: number = 1
): { allowed: boolean; remaining: number; resetMs: number } {
  const plan = getApiKeyPlan(apiKeyId);
  const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free!;

  // Ensure bucket exists in DB
  ensureBucket(apiKeyId, config.maxTokens);

  // Load from DB every time to ensure perfect multi-process consistency
  const rows = db(
    `SELECT api_key_id, tokens, last_refill FROM rate_limits WHERE api_key_id = '${apiKeyId}'`
  ) as any[];

  if (rows.length === 0) {
    return {
      allowed: true,
      remaining: config.maxTokens,
      resetMs: 0,
    };
  }

  const tokens = rows[0].tokens;
  const lastRefill = new Date(rows[0].last_refill).getTime();
  const now = Date.now();
  const elapsed = now - lastRefill;

  // Refill tokens
  const tokensToAdd = (elapsed / config.refillIntervalMs) * config.refillRate;
  const newTokens = Math.min(config.maxTokens, tokens + tokensToAdd);

  // Determine if request is allowed
  if (newTokens >= cost) {
    const remaining = newTokens - cost;
    saveBucket(apiKeyId, remaining, now);
    return {
      allowed: true,
      remaining: Math.floor(remaining),
      resetMs: 0,
    };
  }

  // Not enough tokens — calculate when bucket will have enough
  const tokensNeeded = cost - newTokens;
  const resetMs = Math.ceil((tokensNeeded / config.refillRate) * 1000);

  saveBucket(apiKeyId, newTokens, now);

  return {
    allowed: false,
    remaining: Math.floor(newTokens),
    resetMs,
  };
}

/**
 * Get current rate limit state for an API key.
 */
export function getRateLimitState(
  apiKeyId: string
): { maxTokens: number; remaining: number; resetMs: number } {
  const plan = getApiKeyPlan(apiKeyId);
  const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free!;

  const rows = db(
    `SELECT api_key_id, tokens, last_refill FROM rate_limits WHERE api_key_id = '${apiKeyId}'`
  ) as any[];

  if (rows.length === 0) {
    return { maxTokens: config.maxTokens, remaining: config.maxTokens, resetMs: 0 };
  }

  const tokens = rows[0].tokens;
  const lastRefill = new Date(rows[0].last_refill).getTime();
  const now = Date.now();
  const elapsed = now - lastRefill;
  const tokensToAdd = (elapsed / config.refillIntervalMs) * config.refillRate;
  const effectiveTokens = Math.min(config.maxTokens, tokens + tokensToAdd);

  return {
    maxTokens: config.maxTokens,
    remaining: Math.floor(effectiveTokens),
    resetMs: 0,
  };
}

/**
 * Reset all rate limit states is a no-op now that there is no in-memory cache.
 */
export function resetCache(): void {
  // No-op
}