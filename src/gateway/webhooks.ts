/**
 * Webhook registration and delivery for ORBIS.ID API Gateway.
 * Supports credential.issued and credential.verified events.
 */

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WebhookEvent = "credential.issued" | "credential.verified";

export const VALID_EVENTS: WebhookEvent[] = ["credential.issued", "credential.verified"];

export interface WebhookRecord {
  id: string;
  url: string;
  events: string; // comma-separated
  api_key_id: string;
  created_at: string;
  active: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: string;
  response_status: number | null;
  delivered_at: string;
  success: number;
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

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

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Register a webhook URL for specific events.
 */
export function registerWebhook(
  url: string,
  events: WebhookEvent[],
  apiKeyId: string
): WebhookRecord {
  if (!url || (!url.startsWith("https://") && !url.startsWith("http://"))) {
    throw new Error("Webhook URL must start with http:// or https://");
  }
  if (!events || events.length === 0) {
    throw new Error("At least one event is required");
  }
  for (const e of events) {
    if (!VALID_EVENTS.includes(e)) {
      throw new Error(`Invalid event: ${e}. Valid events: ${VALID_EVENTS.join(", ")}`);
    }
  }

  const id = generateId();
  const now = new Date().toISOString();
  const eventsStr = events.join(",");

  db(
    `INSERT INTO webhooks (id, url, events, api_key_id, created_at, active) VALUES ('${id}', '${url.replace(/'/g, "''")}', '${eventsStr}', '${apiKeyId}', '${now}', 1)`
  );

  return { id, url, events: eventsStr, api_key_id: apiKeyId, created_at: now, active: 1 };
}

/**
 * List webhooks for an API key.
 */
export function listWebhooks(apiKeyId?: string): WebhookRecord[] {
  let query = "SELECT id, url, events, api_key_id, created_at, active FROM webhooks";
  if (apiKeyId) {
    query += ` WHERE api_key_id = '${apiKeyId}'`;
  }
  query += " ORDER BY created_at DESC";

  return db(query) as WebhookRecord[];
}

/**
 * Delete a webhook by ID (scoped to API key).
 */
export function deleteWebhook(id: string, apiKeyId?: string): boolean {
  let query = `DELETE FROM webhooks WHERE id = '${id}'`;
  if (apiKeyId) {
    query += ` AND api_key_id = '${apiKeyId}'`;
  }
  db(query);
  return true;
}

/**
 * Deliver a webhook event to all registered webhooks that subscribe to the event type.
 * Returns delivery results.
 */
export async function deliverWebhookEvent(
  eventType: WebhookEvent,
  payload: Record<string, unknown>
): Promise<{ webhookId: string; url: string; success: boolean; statusCode: number | null }[]> {
  const results: { webhookId: string; url: string; success: boolean; statusCode: number | null }[] = [];

  const webhooks = db(
    `SELECT id, url, events FROM webhooks WHERE active = 1 AND events LIKE '%${eventType}%'`
  ) as any[];

  if (webhooks.length === 0) {
    return results;
  }

  const body = JSON.stringify({
    event: eventType,
    created_at: new Date().toISOString(),
    data: payload,
  });

  for (const wh of webhooks) {
    const deliveryId = generateId();
    const now = new Date().toISOString();

    try {
      const response = await fetch(wh.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": eventType,
          "X-Webhook-Delivery": deliveryId,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      const statusCode = response.status;
      const success = statusCode >= 200 && statusCode < 300;

      db(
        `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, response_status, delivered_at, success) VALUES ('${deliveryId}', '${wh.id}', '${eventType}', '${body.replace(/'/g, "''")}', ${statusCode}, '${now}', ${success ? 1 : 0})`
      );

      results.push({ webhookId: wh.id, url: wh.url, success, statusCode });
    } catch (err: any) {
      db(
        `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, response_status, delivered_at, success) VALUES ('${deliveryId}', '${wh.id}', '${eventType}', '${body.replace(/'/g, "''")}', NULL, '${now}', 0)`
      );

      results.push({ webhookId: wh.id, url: wh.url, success: false, statusCode: null });
    }
  }

  return results;
}

/**
 * Get delivery history for a webhook.
 */
export function getWebhookDeliveries(
  webhookId: string,
  limit: number = 20
): WebhookDelivery[] {
  return db(
    `SELECT id, webhook_id, event_type, payload, response_status, delivered_at, success FROM webhook_deliveries WHERE webhook_id = '${webhookId}' ORDER BY delivered_at DESC LIMIT ${limit}`
  ) as WebhookDelivery[];
}
