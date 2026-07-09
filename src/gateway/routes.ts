/**
 * Gateway management routes for ORBIS.ID API Gateway.
 * Provides endpoints for:
 * - Admin: API key creation and management at /api/admin/api-keys
 * - Developer: usage stats dashboard at /api/developer/stats
 * - Webhook registration and management
 */

import { Router, type Request, type Response } from "express";
import { generateApiKey, revokeApiKey, listApiKeys, VALID_SCOPES, type Scope } from "./apikey.js";
import { getRateLimitState } from "./ratelimit.js";
import { getUsageStats } from "./usage.js";
import { registerWebhook, listWebhooks, deleteWebhook, getWebhookDeliveries, type WebhookEvent, VALID_EVENTS } from "./webhooks.js";
import { requireAuth } from "./middleware.js";
import { execSync } from "node:child_process";

const router = Router();

function db(query: string): any[] {
  const out = execSync(`team-db "${query.replace(/"/g, '\\"')}"`, {
    encoding: "utf-8",
    timeout: 10_000,
  });
  return JSON.parse(out.trim() || "[]") as any[];
}

// ─── Developer Dashboard (HTML) ─────────────────────────────────────────────

/**
 * GET /api/developer/dashboard
 * Server-rendered HTML developer dashboard for API key management and usage stats.
 */
router.get("/dashboard", (_req: Request, res: Response) => {
  try {
    const keys = db("SELECT id, name, email, scopes, member_id, created_at, revoked_at, last_used_at FROM ssi_api_keys ORDER BY created_at DESC");
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const todayRows = db(`SELECT COUNT(*) as cnt FROM ssi_usage_logs WHERE timestamp >= '${todayStart}'`);
    const monthRows = db(`SELECT COUNT(*) as cnt FROM ssi_usage_logs WHERE timestamp >= '${monthStart}'`);
    const activeKeyRows = db("SELECT COUNT(*) as cnt FROM ssi_api_keys WHERE revoked_at IS NULL");
    const todayCalls = todayRows[0]?.cnt || 0;
    const monthCalls = monthRows[0]?.cnt || 0;
    const activeKeys = activeKeyRows[0]?.cnt || 0;
    const lastRequests = db("SELECT method, path, status_code, response_time_ms, timestamp FROM ssi_usage_logs ORDER BY timestamp DESC LIMIT 10");
    const html = buildDashboardHtml(keys, todayCalls, monthCalls, activeKeys, lastRequests);
    res.type("html").send(html);
  } catch (err: any) {
    res.status(500).type("html").send(`<h1>Error</h1><pre>${err.message}</pre>`);
  }
});

/**
 * POST /api/developer/register
 * Public endpoint to register for an API key with name + email.
 */
router.post("/register", (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: true, message: "name is required" }); return; }
    if (!email || !email.trim()) { res.status(400).json({ error: true, message: "email is required" }); return; }
    const allScopes = [...VALID_SCOPES] as Scope[];
    const result = generateApiKey(name.trim(), allScopes);
    db(`UPDATE ssi_api_keys SET email = '${email.trim().replace(/'/g, "''")}' WHERE id = '${result.id}'`);
    res.status(201).json({
      success: true,
      message: "API key created successfully. Save it — it will not be shown again.",
      key: { id: result.id, name: result.name, scopes: result.scopes, created_at: result.created_at },
      raw_key: result.rawKey,
    });
  } catch (err: any) {
    res.status(400).json({ error: true, message: err.message });
  }
});

// ─── Admin: API Key Management ──────────────────────────────────────────────

/**
 * POST /api/admin/api-keys
 * Admin: Create a new API key.
 * Body: { name: string, scopes: string[], memberId?: string }
 */
router.post("/admin/api-keys", requireAuth(["admin:manage"]), (req: Request, res: Response) => {
  try {
    const { name, scopes, memberId } = req.body;

    if (!name) {
      res.status(400).json({ error: true, message: "name is required" });
      return;
    }
    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      res.status(400).json({ error: true, message: "scopes must be a non-empty array" });
      return;
    }

    const result = generateApiKey(name, scopes as Scope[], memberId);

    res.status(201).json({
      success: true,
      key: {
        id: result.id,
        name: result.name,
        scopes: result.scopes,
        created_at: result.created_at,
        status: "active",
      },
      raw_key: result.rawKey,
      message: "Save this key — it will not be shown again.",
    });
  } catch (err: any) {
    res.status(400).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/admin/api-keys
 * Admin: List all API keys (without raw keys).
 */
router.get("/admin/api-keys", requireAuth(["admin:manage"]), (_req: Request, res: Response) => {
  try {
    const keys = listApiKeys();
    res.json({
      success: true,
      count: keys.length,
      keys,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/admin/api-keys/:id
 * Admin: Revoke an API key.
 */
router.delete("/admin/api-keys/:id", requireAuth(["admin:manage"]), (req: Request, res: Response) => {
  try {
    revokeApiKey(req.params.id);
    res.json({ success: true, message: "API key revoked" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/admin/api-keys/scopes
 * List available API key scopes.
 */
router.get("/admin/api-keys/scopes", (_req: Request, res: Response) => {
  res.json({
    success: true,
    scopes: VALID_SCOPES,
  });
});

// ─── Developer Dashboard ────────────────────────────────────────────────────

/**
 * GET /api/developer/stats
 * Get usage stats for the authenticated API key.
 * Query: ?since=ISO8601 (optional, defaults to last 24h)
 */
router.get("/developer/stats", requireAuth(), (req: Request, res: Response) => {
  try {
    const apiKeyId = req.apiKey!.id;
    const since = (req.query.since as string) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const usage = getUsageStats(apiKeyId, since);
    const rateLimit = getRateLimitState(apiKeyId);
    const registeredWebhooks = listWebhooks(apiKeyId);

    res.json({
      success: true,
      api_key_id: apiKeyId,
      since,
      usage: {
        total_requests: usage.totalRequests,
        success_count: usage.successCount,
        error_count: usage.errorCount,
        avg_response_time_ms: usage.avgResponseTimeMs,
        by_endpoint: usage.byEndpoint,
        by_method: usage.byMethod,
      },
      rate_limit: rateLimit,
      webhooks: {
        count: registeredWebhooks.length,
        registered: registeredWebhooks.map((w) => ({
          id: w.id,
          url: w.url,
          events: w.events,
          active: w.active,
          created_at: w.created_at,
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Webhook Management ─────────────────────────────────────────────────────

/**
 * POST /api/gateway/webhooks
 * Register a webhook URL.
 * Body: { url: string, events: string[] }
 */
router.post("/gateway/webhooks", requireAuth(), (req: Request, res: Response) => {
  try {
    const { url, events } = req.body;
    const apiKeyId = req.apiKey!.id;

    if (!url) {
      res.status(400).json({ error: true, message: "url is required" });
      return;
    }
    if (!events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: true, message: "events must be a non-empty array" });
      return;
    }

    const webhook = registerWebhook(url, events as WebhookEvent[], apiKeyId);

    res.status(201).json({
      success: true,
      webhook,
    });
  } catch (err: any) {
    res.status(400).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/gateway/webhooks
 * List webhooks for the authenticated API key.
 */
router.get("/gateway/webhooks", requireAuth(), (req: Request, res: Response) => {
  try {
    const apiKeyId = req.apiKey!.id;
    const webhooks = listWebhooks(apiKeyId);

    res.json({
      success: true,
      count: webhooks.length,
      webhooks,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/gateway/webhooks/:id
 * Delete a webhook.
 */
router.delete("/gateway/webhooks/:id", requireAuth(), (req: Request, res: Response) => {
  try {
    const apiKeyId = req.apiKey!.id;
    deleteWebhook(req.params.id, apiKeyId);

    res.json({ success: true, message: "Webhook deleted" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/gateway/webhooks/:id/deliveries
 * Get delivery history for a webhook.
 */
router.get("/gateway/webhooks/:id/deliveries", requireAuth(), (req: Request, res: Response) => {
  try {
    const deliveries = getWebhookDeliveries(req.params.id);

    res.json({
      success: true,
      count: deliveries.length,
      deliveries,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/gateway/events
 * List available webhook events.
 */
router.get("/gateway/events", (_req: Request, res: Response) => {
  res.json({
    success: true,
    events: VALID_EVENTS,
  });
});

export default router;