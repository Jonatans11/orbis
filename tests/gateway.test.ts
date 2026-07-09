/**
 * Tests for ORBIS.ID API Gateway.
 * Covers API key management, rate limiting, auth middleware, usage tracking,
 * and webhook registration.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import express from "express";

import { generateApiKey, findApiKey, revokeApiKey, listApiKeys, hasScope, type Scope } from "../src/gateway/apikey.js";
import { checkRateLimit, resetCache, getRateLimitState } from "../src/gateway/ratelimit.js";
import { logUsage, getUsageStats, getAggregateStats } from "../src/gateway/usage.js";
import { registerWebhook, listWebhooks, deleteWebhook, getWebhookDeliveries } from "../src/gateway/webhooks.js";

// ─── API Key Management ─────────────────────────────────────────────────────

describe("API Key Management", () => {
  it("should generate a key with valid scopes", () => {
    const result = generateApiKey("test-key", ["did:read", "vc:verify"]);

    expect(result.rawKey).toMatch(/^orb_/);
    expect(result.name).toBe("test-key");
    expect(result.scopes).toBe("did:read,vc:verify");
    expect(result.id).toBeTruthy();
    expect(result.created_at).toBeTruthy();
  });

  it("should reject empty name", () => {
    expect(() => generateApiKey("", ["did:read"])).toThrow("API key name is required");
  });

  it("should reject empty scopes", () => {
    expect(() => generateApiKey("test", [])).toThrow("At least one scope is required");
  });

  it("should reject invalid scopes", () => {
    expect(() => generateApiKey("test", ["did:read", "invalid:scope" as Scope])).toThrow("Invalid scope");
  });

  it("should find a key by its raw value", () => {
    const { rawKey, id } = generateApiKey("findable", ["did:read"]);
    const record = findApiKey(rawKey);

    expect(record).not.toBeNull();
    expect(record!.id).toBe(id);
    expect(record!.name).toBe("findable");
    expect(record!.scopes).toBe("did:read");
  });

  it("should not find a revoked key", () => {
    const { rawKey, id } = generateApiKey("revocable", ["did:read"]);
    revokeApiKey(id);
    const record = findApiKey(rawKey);

    expect(record).toBeNull();
  });

  it("should return null for unknown key", () => {
    const record = findApiKey("orb_" + randomBytes(24).toString("base64url"));
    expect(record).toBeNull();
  });

  it("should list all keys", () => {
    generateApiKey("list-test-1", ["did:read"]);
    generateApiKey("list-test-2", ["vc:issue"]);

    const keys = listApiKeys();
    expect(keys.length).toBeGreaterThanOrEqual(2);

    const testKeys = keys.filter((k) => k.name.startsWith("list-test"));
    expect(testKeys.length).toBeGreaterThanOrEqual(2);
  });

  it("should check scope membership", () => {
    const { rawKey } = generateApiKey("scope-test", ["did:read", "vc:issue"]);
    const record = findApiKey(rawKey)!;

    expect(hasScope(record, "did:read")).toBe(true);
    expect(hasScope(record, "vc:issue")).toBe(true);
    expect(hasScope(record, "vc:verify")).toBe(false);
    expect(hasScope(record, "trust:write")).toBe(false);
  });
});

// ─── Rate Limiting ──────────────────────────────────────────────────────────

describe("Rate Limiting", () => {
  const testKeyId = "rate-limit-test-key";

  beforeAll(() => {
    resetCache();
  });

  afterAll(() => {
    resetCache();
  });

  it("should allow requests within limit", () => {
    const result = checkRateLimit(testKeyId);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it("should return rate limit state", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(testKeyId);
      expect(result.allowed).toBe(true);
    }
  });

  it("should report rate limit state", () => {
    const state = getRateLimitState(testKeyId);
    expect(state.maxTokens).toBe(100);
    expect(state.remaining).toBeGreaterThanOrEqual(0);
  });
});

// ─── Usage Tracking ─────────────────────────────────────────────────────────

describe("Usage Tracking", () => {
  const testKeyId = "usage-test-key";

  it("should log usage events", () => {
    logUsage(testKeyId, "POST", "/api/did/create", 201, 45);
    logUsage(testKeyId, "GET", "/api/did/list", 200, 12);
    logUsage(testKeyId, "POST", "/api/vc/issue", 500, 230);

    const stats = getUsageStats(testKeyId);

    expect(stats.totalRequests).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.errorCount).toBe(1);
    expect(stats.avgResponseTimeMs).toBeGreaterThan(0);
  });

  it("should break down by endpoint", () => {
    logUsage(testKeyId, "POST", "/api/vc/verify", 200, 30);

    const stats = getUsageStats(testKeyId);
    expect(stats.byEndpoint["/api/did/create"]).toBe(1);
    expect(stats.byEndpoint["/api/vc/verify"]).toBe(1);
  });

  it("should return empty stats for unknown key", () => {
    const stats = getUsageStats("nonexistent-key");
    expect(stats.totalRequests).toBe(0);
    expect(stats.successCount).toBe(0);
    expect(stats.errorCount).toBe(0);
  });

  it("should provide aggregate stats", () => {
    const stats = getAggregateStats();
    expect(stats.totalRequests).toBeGreaterThan(0);
    expect(stats.activeKeys).toBeGreaterThan(0);
  });
});

// ─── Webhooks ───────────────────────────────────────────────────────────────

describe("Webhooks", () => {
  const testApiKeyId = "webhook-test-key";

  it("should register a webhook", () => {
    const wh = registerWebhook("https://example.com/webhook", ["credential.issued"], testApiKeyId);

    expect(wh.url).toBe("https://example.com/webhook");
    expect(wh.events).toBe("credential.issued");
    expect(wh.active).toBe(1);
    expect(wh.api_key_id).toBe(testApiKeyId);
  });

  it("should reject invalid URL", () => {
    expect(() => registerWebhook("not-a-url", ["credential.issued"], testApiKeyId)).toThrow();
  });

  it("should reject invalid events", () => {
    expect(() =>
      registerWebhook("https://example.com/hook", ["invalid.event" as any], testApiKeyId)
    ).toThrow("Invalid event");
  });

  it("should register multiple events", () => {
    const wh = registerWebhook("https://example.com/multi", ["credential.issued", "credential.verified"], testApiKeyId);
    expect(wh.events).toBe("credential.issued,credential.verified");
  });

  it("should list webhooks for an API key", () => {
    const webhooks = listWebhooks(testApiKeyId);
    expect(webhooks.length).toBeGreaterThanOrEqual(2);
  });

  it("should delete a webhook", () => {
    const wh = registerWebhook("https://example.com/deleteme", ["credential.issued"], testApiKeyId);
    deleteWebhook(wh.id, testApiKeyId);

    const webhooks = listWebhooks(testApiKeyId);
    const deleted = webhooks.find((w) => w.id === wh.id);
    expect(deleted).toBeUndefined();
  });
});

// ─── Auth Middleware (direct function testing) ──────────────────────────────

describe("Auth Middleware - requireAuth", () => {
  it("should reject requests with no auth header", async () => {
    // Simulate Express req/res chain
    const req = { headers: {} } as express.Request;
    const res = {
      statusCode: 0,
      body: null,
      status(code: number) { this.statusCode = code; return this; },
      json(data: any) { this.body = data; return this; },
    } as any;
    let nextCalled = false;

    const { requireAuth } = await import("../src/gateway/middleware.js");
    const mw = requireAuth();
    await new Promise<void>((resolve) => {
      mw(req, res, () => { nextCalled = true; resolve(); });
      resolve();
    });

    expect(res.statusCode).toBe(401);
    expect(res.body?.message).toContain("Authorization header");
    expect(nextCalled).toBe(false);
  });

  it("should reject invalid Bearer format", async () => {
    const req = { headers: { authorization: "Invalid" } } as any;
    const res = {
      statusCode: 0,
      body: null,
      status(code: number) { this.statusCode = code; return this; },
      json(data: any) { this.body = data; return this; },
    } as any;
    let nextCalled = false;

    const { requireAuth } = await import("../src/gateway/middleware.js");
    const mw = requireAuth();
    await new Promise<void>((resolve) => {
      mw(req, res, () => { nextCalled = true; resolve(); });
      resolve();
    });

    expect(res.statusCode).toBe(401);
    expect(res.body?.message).toContain("Bearer");
  });

  it("should reject unknown API key", async () => {
    const req = { headers: { authorization: "Bearer orb_invalid_key_here" } } as any;
    const res = {
      statusCode: 0,
      body: null,
      status(code: number) { this.statusCode = code; return this; },
      json(data: any) { this.body = data; return this; },
    } as any;
    let nextCalled = false;

    const { requireAuth } = await import("../src/gateway/middleware.js");
    const mw = requireAuth(["did:read"]);
    await new Promise<void>((resolve) => {
      mw(req, res, () => { nextCalled = true; resolve(); });
      resolve();
    });

    expect(res.statusCode).toBe(401);
    expect(res.body?.message).toContain("Invalid");
  });

  it("should allow valid API key with correct scope", async () => {
    const { rawKey } = generateApiKey("mw-auth-test", ["did:read"]);
    const req = { headers: { authorization: `Bearer ${rawKey}` } } as any;
    const res = {
      statusCode: 0,
      body: null,
      status(code: number) { this.statusCode = code; return this; },
      json(data: any) { this.body = data; return this; },
    } as any;
    let nextCalled = false;

    const { requireAuth } = await import("../src/gateway/middleware.js");
    const mw = requireAuth(["did:read"]);
    await new Promise<void>((resolve) => {
      mw(req, res, () => { nextCalled = true; resolve(); });
      resolve();
    });

    expect(nextCalled).toBe(true);
    expect(req.apiKey).toBeDefined();
    expect(req.apiKey!.name).toBe("mw-auth-test");
  });

  it("should reject valid API key with wrong scope", async () => {
    const { rawKey } = generateApiKey("mw-wrong-scope", ["vc:issue"]);
    const req = { headers: { authorization: `Bearer ${rawKey}` } } as any;
    const res = {
      statusCode: 0,
      body: null,
      status(code: number) { this.statusCode = code; return this; },
      json(data: any) { this.body = data; return this; },
    } as any;
    let nextCalled = false;

    const { requireAuth } = await import("../src/gateway/middleware.js");
    const mw = requireAuth(["did:read"]);
    await new Promise<void>((resolve) => {
      mw(req, res, () => { nextCalled = true; resolve(); });
      resolve();
    });

    expect(res.statusCode).toBe(403);
    expect(res.body?.message).toContain("Insufficient scopes");
    expect(nextCalled).toBe(false);
  });
});
