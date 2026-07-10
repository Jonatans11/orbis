/**
 * Gateway management routes for ORBIS.ID API Gateway.
 * Provides endpoints for:
 * - API key creation and management
 * - Developer dashboard stats
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
 * No auth required (the registration form is public).
 */
router.get("/dashboard", (_req: Request, res: Response) => {
  try {
    // Get all API keys
    const keys = db("SELECT id, name, email, scopes, member_id, created_at, revoked_at, last_used_at FROM api_keys ORDER BY created_at DESC") as any[];

    // Get aggregate stats for today and this month
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const todayRows = db(`SELECT COUNT(*) as cnt FROM usage_logs WHERE timestamp >= '${todayStart}'`) as any[];
    const monthRows = db(`SELECT COUNT(*) as cnt FROM usage_logs WHERE timestamp >= '${monthStart}'`) as any[];
    const activeKeyRows = db("SELECT COUNT(*) as cnt FROM api_keys WHERE revoked_at IS NULL") as any[];

    const todayCalls = todayRows[0]?.cnt || 0;
    const monthCalls = monthRows[0]?.cnt || 0;
    const activeKeys = activeKeyRows[0]?.cnt || 0;

    // Get last 10 requests
    const lastRequests = db("SELECT method, path, status_code, response_time_ms, timestamp FROM usage_logs ORDER BY timestamp DESC LIMIT 10") as any[];

    const html = buildDashboardHtml(keys, todayCalls, monthCalls, activeKeys, lastRequests);
    res.type("html").send(html);
  } catch (err: any) {
    res.status(500).type("html").send(`<h1>Error</h1><p>${err.message}</p>`);
  }
});

/**
 * POST /api/developer/register
 * Public endpoint to register for an API key with name + email.
 * Body: { name, email }
 */
router.post("/register", (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: true, message: "name is required" });
      return;
    }
    if (!email || !email.trim()) {
      res.status(400).json({ error: true, message: "email is required" });
      return;
    }

    // Generate an API key with full scopes
    const allScopes = [...VALID_SCOPES] as Scope[];
    const result = generateApiKey(name.trim(), allScopes);

    // Store email too (apikey module doesn't know about email, so we update it)
    db(`UPDATE api_keys SET email = '${email.trim().replace(/'/g, "''")}' WHERE id = '${result.id}'`);

    res.status(201).json({
      success: true,
      message: "API key created successfully. Save it — it will not be shown again.",
      key: {
        id: result.id,
        name: result.name,
        scopes: result.scopes,
        created_at: result.created_at,
      },
      raw_key: result.rawKey,
    });
  } catch (err: any) {
    res.status(400).json({ error: true, message: err.message });
  }
});

// ─── API Key Management ─────────────────────────────────────────────────────

/**
 * POST /api/gateway/keys
 * Create a new API key.
 * Body: { name: string, scopes: string[], memberId?: string }
 */
router.post("/keys", requireAuth(), (req: Request, res: Response) => {
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
      },
      // Show raw key only on creation
      raw_key: result.rawKey,
      message: "Save this key — it will not be shown again.",
    });
  } catch (err: any) {
    res.status(400).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/gateway/keys
 * List all API keys (without raw keys).
 */
router.get("/keys", requireAuth(), (_req: Request, res: Response) => {
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
 * DELETE /api/gateway/keys/:id
 * Revoke an API key.
 */
router.delete("/keys/:id", requireAuth(), (req: Request, res: Response) => {
  try {
    revokeApiKey(req.params.id as string);
    res.json({ success: true, message: "API key revoked" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Developer Dashboard ────────────────────────────────────────────────────

/**
 * GET /api/developer/stats
 * Get usage stats for the authenticated API key.
 * Query: ?since=ISO8601 (optional, defaults to last 24h)
 */
router.get("/stats", requireAuth(), (req: Request, res: Response) => {
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
      usage,
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
router.post("/webhooks", requireAuth(), (req: Request, res: Response) => {
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
router.get("/webhooks", requireAuth(), (req: Request, res: Response) => {
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
router.delete("/webhooks/:id", requireAuth(), (req: Request, res: Response) => {
  try {
    const apiKeyId = req.apiKey!.id;
    deleteWebhook(req.params.id as string, apiKeyId);

    res.json({ success: true, message: "Webhook deleted" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/gateway/webhooks/:id/deliveries
 * Get delivery history for a webhook.
 */
router.get("/webhooks/:id/deliveries", requireAuth(), (req: Request, res: Response) => {
  try {
    const deliveries = getWebhookDeliveries(req.params.id as string);

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
 * GET /api/gateway/scopes
 * List available API key scopes.
 */
router.get("/scopes", (_req: Request, res: Response) => {
  res.json({
    success: true,
    scopes: VALID_SCOPES,
  });
});

/**
 * GET /api/gateway/events
 * List available webhook events.
 */
router.get("/events", (_req: Request, res: Response) => {
  res.json({
    success: true,
    events: VALID_EVENTS,
  });
});

export default router;

// ─── HTML Dashboard Builder ──────────────────────────────────────────────────

function buildDashboardHtml(
  keys: any[],
  todayCalls: number,
  monthCalls: number,
  activeKeys: number,
  lastRequests: any[]
): string {
  const keyRows = keys.map((k) => {
    const isRevoked = k.revoked_at !== null;
    const scopes = (k.scopes || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    return `
      <tr>
        <td class="px-4 py-3 border-b border-gray-700"><code class="font-mono text-sm text-gray-200">${k.id.slice(0, 12)}...</code></td>
        <td class="px-4 py-3 border-b border-gray-700 text-gray-300">${escHtml(k.name)}</td>
        <td class="px-4 py-3 border-b border-gray-700 text-gray-300">${escHtml(k.email || "")}</td>
        <td class="px-4 py-3 border-b border-gray-700">
          <div class="flex flex-wrap gap-1">${scopes.map((s: string) => `<span class="inline-block rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">${escHtml(s)}</span>`).join("")}</div>
        </td>
        <td class="px-4 py-3 border-b border-gray-700 text-sm text-gray-400">${k.created_at ? new Date(k.created_at).toLocaleDateString() : ""}</td>
        <td class="px-4 py-3 border-b border-gray-700 text-sm text-gray-400">${k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "never"}</td>
        <td class="px-4 py-3 border-b border-gray-700">
          ${isRevoked
            ? `<span class="inline-block rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">Revoked</span>`
            : `<span class="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">Active</span>`
          }
          ${!isRevoked
            ? `<button onclick="revokeKey('${k.id}')" class="ml-2 rounded-md bg-red-600/20 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-600/40 transition-colors">Revoke</button>`
            : ""
          }
        </td>
      </tr>
    `;
  }).join("");

  const requestRows = lastRequests.map((r) => `
    <tr>
      <td class="px-4 py-2 border-b border-gray-700/50"><span class="inline-block rounded px-1.5 py-0.5 font-mono text-xs font-bold ${r.status_code < 400 ? "text-emerald-400" : "text-red-400"}">${r.method}</span></td>
      <td class="px-4 py-2 border-b border-gray-700/50 font-mono text-xs text-gray-400">${escHtml(r.path)}</td>
      <td class="px-4 py-2 border-b border-gray-700/50 text-xs text-gray-400">${r.status_code}</td>
      <td class="px-4 py-2 border-b border-gray-700/50 text-xs text-gray-400">${r.response_time_ms}ms</td>
      <td class="px-4 py-2 border-b border-gray-700/50 text-xs text-gray-500">${r.timestamp ? new Date(r.timestamp).toLocaleString() : ""}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ORBIS.ID Developer Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0B1020; color: #e2e8f0; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    h1 { font-size: 1.75rem; font-weight: 700; background: linear-gradient(135deg, #6366F1, #22D3EE); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    h2 { font-size: 1.125rem; font-weight: 600; color: #e2e8f0; margin-bottom: 1rem; }
    .card { background: #141829; border: 1px solid #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .card-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 1rem; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stat-card { background: #1a1f35; border: 1px solid #1e293b; border-radius: 10px; padding: 1.25rem; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: 700; color: #6366F1; }
    .stat-label { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { text-align: left; padding: 0.75rem 1rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #1e293b; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #1e293b; }
    input { width: 100%; padding: 0.625rem 0.875rem; background: #1a1f35; border: 1px solid #1e293b; border-radius: 8px; color: #e2e8f0; font-family: 'Inter', sans-serif; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #6366F1; }
    button { font-family: 'Inter', sans-serif; }
    .btn-primary { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1.25rem; background: linear-gradient(135deg, #6366F1, #22D3EE); border: none; border-radius: 8px; color: #fff; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.875rem 1.25rem; border-radius: 10px; font-size: 0.875rem; font-weight: 500; z-index: 100; transform: translateY(100px); opacity: 0; transition: all 0.3s ease; }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast-success { background: #065f46; border: 1px solid #34d399; color: #a7f3d0; }
    .toast-error { background: #7f1d1d; border: 1px solid #f87171; color: #fecaca; }
    .toast-info { background: #1e3a5f; border: 1px solid #60a5fa; color: #bfdbfe; }
    .hidden { display: none; }
    .key-reveal { background: #1a1f35; border: 1px solid #6366F1; border-radius: 8px; padding: 0.75rem 1rem; word-break: break-all; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #22D3EE; margin-top: 0.75rem; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-3">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="#6366F1" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="#6366F1"/></svg>
        <h1>ORBIS.ID Developer Dashboard</h1>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-500">API v1.0.0</span>
        <a href="/api/health" class="text-xs text-indigo-400 hover:text-indigo-300 underline">Health</a>
        <a href="/openapi.yaml" class="text-xs text-indigo-400 hover:text-indigo-300 underline">OpenAPI</a>
      </div>
    </div>

    <!-- Register API Key Form -->
    <div class="card" id="register-section">
      <div class="card-title">Register for an API Key</div>
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-gray-500 mb-1">Name</label>
          <input type="text" id="reg-name" placeholder="Your name or app name" />
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-gray-500 mb-1">Email</label>
          <input type="email" id="reg-email" placeholder="you@example.com" />
        </div>
        <button onclick="registerKey()" id="reg-btn" class="btn-primary">Generate API Key</button>
      </div>
      <div id="key-result" class="hidden mt-4">
        <div class="key-reveal" id="key-display"></div>
        <p class="mt-2 text-xs text-amber-400 font-medium">⚠ Save this key — it will not be shown again.</p>
      </div>
    </div>

    <!-- Stats -->
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${activeKeys}</div><div class="stat-label">Active API Keys</div></div>
      <div class="stat-card"><div class="stat-value">${todayCalls}</div><div class="stat-label">API Calls Today</div></div>
      <div class="stat-card"><div class="stat-value">${monthCalls}</div><div class="stat-label">API Calls This Month</div></div>
      <div class="stat-card"><div class="stat-value">${keys.length}</div><div class="stat-label">Total Keys Created</div></div>
    </div>

    <!-- API Keys Table -->
    <div class="card">
      <div class="card-title">API Keys</div>
      <div class="overflow-x-auto">
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Email</th><th>Scopes</th><th>Created</th><th>Last Used</th><th>Status</th></tr>
          </thead>
          <tbody>${keyRows || '<tr><td colspan="7" class="text-center text-gray-500 py-8">No API keys registered yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <!-- Last 10 Requests -->
    <div class="card">
      <div class="card-title">Last 10 API Requests</div>
      <div class="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Method</th><th>Path</th><th>Status</th><th>Time</th><th>Timestamp</th></tr>
          </thead>
          <tbody>${requestRows || '<tr><td colspan="5" class="text-center text-gray-500 py-8">No requests logged yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center mt-8 text-xs text-gray-600">
      ORBIS.ID SSI Backend — Self-Sovereign Identity Platform
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    function showToast(msg, type = "success") {
      const toast = document.getElementById("toast");
      toast.textContent = msg;
      toast.className = "toast toast-" + type + " show";
      setTimeout(() => toast.classList.remove("show"), 5000);
    }

    async function registerKey() {
      const name = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const btn = document.getElementById("reg-btn");

      if (!name) { showToast("Name is required", "error"); return; }
      if (!email) { showToast("Email is required", "error"); return; }

      btn.disabled = true;
      btn.textContent = "Generating...";

      try {
        const res = await fetch("/api/developer/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email }),
        });
        const data = await res.json();

        if (data.success) {
          document.getElementById("key-result").classList.remove("hidden");
          document.getElementById("key-display").textContent = data.raw_key;
          showToast("API key generated successfully!", "success");
          setTimeout(() => location.reload(), 2000);
        } else {
          showToast(data.message || "Failed to generate key", "error");
        }
      } catch (err) {
        showToast("Network error", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Generate API Key";
      }
    }

    async function revokeKey(id) {
      if (!confirm("Revoke this API key? This cannot be undone.")) return;
      try {
        const res = await fetch("/api/gateway/keys/" + id, { method: "DELETE" });
        if (res.ok) {
          showToast("API key revoked", "info");
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast("Failed to revoke key", "error");
        }
      } catch (err) {
        showToast("Network error", "error");
      }
    }
  </script>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
