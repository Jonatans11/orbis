/**
 * Express middleware for API Gateway authentication, rate limiting,
 * and usage tracking.
 *
 * Usage:
 *   import { requireAuth, rateLimitMiddleware, usageMiddleware } from "./gateway/middleware.js";
 *   app.use("/api/did/*", requireAuth(["did:read", "did:write"]));
 */

import type { Request, Response, NextFunction } from "express";
import { findApiKey, touchApiKey, hasScope, type ApiKeyRecord, type Scope } from "./apikey.js";
import { checkRateLimit } from "./ratelimit.js";
import { logUsage } from "./usage.js";

// Augment express Request with our apiKey info
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyRecord;
    }
  }
}

/**
 * Middleware that requires a valid API key with at least one of the specified scopes.
 * Extracts key from `Authorization: Bearer <key>` header.
 * If no scopes specified, any valid key is accepted.
 */
export function requireAuth(allowedScopes?: Scope[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: true, message: "Missing Authorization header" });
      return;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({ error: true, message: "Authorization header must be: Bearer <api_key>" });
      return;
    }

    const rawKey = parts[1];
    const record = findApiKey(rawKey);

    if (!record) {
      res.status(401).json({ error: true, message: "Invalid or revoked API key" });
      return;
    }

    // Check scopes if required
    if (allowedScopes && allowedScopes.length > 0) {
      const hasRequiredScope = allowedScopes.some((scope) => hasScope(record, scope));
      if (!hasRequiredScope) {
        res.status(403).json({
          error: true,
          message: `Insufficient scopes. Requires one of: ${allowedScopes.join(", ")}`,
        });
        return;
      }
    }

    // Attach record to request
    req.apiKey = record;

    // Touch last_used_at
    touchApiKey(record.id);

    next();
  };
}

/**
 * Rate limiting middleware. Must be used after requireAuth.
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.apiKey) {
    next(); // Skip if no auth (will be caught by requireAuth)
    return;
  }

  const result = checkRateLimit(req.apiKey.id);

  // Set rate limit headers
  res.setHeader("X-RateLimit-Limit", "100");
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));

  if (!result.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(result.resetMs / 1000)));
    res.status(429).json({
      error: true,
      message: "Rate limit exceeded. Please wait before retrying.",
      retryAfterMs: result.resetMs,
    });
    return;
  }

  next();
}

/**
 * Usage tracking middleware. Wraps res.json to capture response status code.
 * Must be registered AFTER routes in the middleware chain.
 */
export function usageMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.apiKey) {
    next();
    return;
  }

  const startTime = Date.now();

  // Capture the original end/json methods
  const originalJson = res.json.bind(res);

  res.json = function (body: any) {
    const responseTimeMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log usage asynchronously (don't block response)
    setImmediate(() => {
      try {
        logUsage(
          req.apiKey!.id,
          req.method,
          req.originalUrl || req.url,
          statusCode,
          responseTimeMs
        );
      } catch (err) {
        console.error("[GATEWAY] Failed to log usage:", err);
      }
    });

    return originalJson(body);
  } as typeof res.json;

  next();
}

/**
 * Combined auth + rate limit middleware for protected SSI routes.
 */
export function gatewayMiddleware(allowedScopes?: Scope[]) {
  return [requireAuth(allowedScopes), rateLimitMiddleware];
}
