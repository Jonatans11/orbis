/**
 * Token Bucket Rate Limiter for ORBIS.ID API Gateway.
 * Uses team-db for persistence.
 */

import { execSync } from "node:child_process";

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  refillIntervalMs: number; // how often to refill (ms)
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxTokens: 100,
  refillRate: 100 / 60, // 100 tokens per minute ≈ 1.67 tokens/sec
  refillIntervalMs: 1000, // refill every second
};

// In-memory cache for rate limit state to avoid hitting DB on every request
const bucketCache = new Map<string, { tokens: number; lastRefill: number }>();

function db(query: string): any[] {
  const out = execSync(`team-db "${query.replace(/"/g, '\\"')}"`, {
    encoding: "utf-8",
    timeout: 10_000,
  });
  return JSON.parse(out.trim() || "[]") as any[];
}

/**
 * Ensure a rate limit bucket exists for an API key.
 */
function ensureBucket(apiKeyId: string): void {
  const rows = db(
    `SELECT api_key_id, tokens, last_refill FROM rate_limits WHERE api_key_id = '${apiKeyId}'`
  ) as any[];

  if (rows.length === 0) {
    const now = new Date().toISOString();
    db(
      `INSERT INTO rate_limits (api_key_id, tokens, last_refill) VALUES ('${apiKeyId}', ${DEFAULT_CONFIG.maxTokens}, '${now}')`
    );
  }
}

/**
 * Load bucket state from DB into memory cache.
 */
function loadBucket(apiKeyId: string): void {
  const rows = db(
    `SELECT api_key_id, tokens, last_refill FROM rate_limits WHERE api_key_id = '${apiKeyId}'`
  ) as any[];

  if (rows.length > 0) {
    bucketCache.set(apiKeyId, {
      tokens: rows[0].tokens,
      lastRefill: new Date(rows[0].last_refill).getTime(),
    });
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
  // Ensure bucket exists in DB
  ensureBucket(apiKeyId);

  // Load into cache if not already
  if (!bucketCache.has(apiKeyId)) {
    loadBucket(apiKeyId);
  }

  const state = bucketCache.get(apiKeyId)!;
  const now = Date.now();
  const elapsed = now - state.lastRefill;

  // Refill tokens
  const tokensToAdd = (elapsed / DEFAULT_CONFIG.refillIntervalMs) * DEFAULT_CONFIG.refillRate;
  const newTokens = Math.min(DEFAULT_CONFIG.maxTokens, state.tokens + tokensToAdd);

  // Determine if request is allowed
  if (newTokens >= cost) {
    const remaining = newTokens - cost;
    bucketCache.set(apiKeyId, { tokens: remaining, lastRefill: now });
    saveBucket(apiKeyId, remaining, now);
    return {
      allowed: true,
      remaining: Math.floor(remaining),
      resetMs: 0,
    };
  }

  // Not enough tokens — calculate when bucket will have enough
  const tokensNeeded = cost - newTokens;
  const resetMs = Math.ceil((tokensNeeded / DEFAULT_CONFIG.refillRate) * 1000);

  bucketCache.set(apiKeyId, { tokens: newTokens, lastRefill: state.lastRefill });

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
  if (!bucketCache.has(apiKeyId)) {
    loadBucket(apiKeyId);
  }

  const state = bucketCache.get(apiKeyId);
  if (!state) {
    return { maxTokens: DEFAULT_CONFIG.maxTokens, remaining: DEFAULT_CONFIG.maxTokens, resetMs: 0 };
  }

  const now = Date.now();
  const elapsed = now - state.lastRefill;
  const tokensToAdd = (elapsed / DEFAULT_CONFIG.refillIntervalMs) * DEFAULT_CONFIG.refillRate;
  const effectiveTokens = Math.min(DEFAULT_CONFIG.maxTokens, state.tokens + tokensToAdd);

  return {
    maxTokens: DEFAULT_CONFIG.maxTokens,
    remaining: Math.floor(effectiveTokens),
    resetMs: 0,
  };
}

/**
 * Reset all in-memory rate limit state (useful for testing).
 */
export function resetCache(): void {
  bucketCache.clear();
}
