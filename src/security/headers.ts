/**
 * Security Headers Middleware for ORBIS.ID SSI Backend.
 *
 * Adds helmet-style security headers to all HTTP responses:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Content-Security-Policy: restrictive defaults
 * - Strict-Transport-Security: max-age=31536000
 * - X-XSS-Protection: 0 (deprecated but still-referenced)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: restrict features
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Default Content Security Policy.
 * Restrictive by default — allows same-origin and API calls only.
 */
const DEFAULT_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' https: data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' https: 'unsafe-inline'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Apply security headers to every response.
 * These are the standard OWASP-recommended headers.
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Content Security Policy
  res.setHeader("Content-Security-Policy", DEFAULT_CSP);

  // HTTP Strict Transport Security (HSTS) — 1 year, include subdomains, preload
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // Disable XSS filter (modern browsers use CSP instead)
  res.setHeader("X-XSS-Protection", "0");

  // Referrer policy — send origin only for cross-origin
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — restrict powerful features
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // Prevent cache of sensitive data
  if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/compliance")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

/**
 * X-RateLimit headers middleware.
 * Adds standardized rate limit headers to every response.
 * These are informational — actual rate limiting is handled by the gateway rate limiter.
 *
 * Headers added:
 * - X-RateLimit-Limit: maximum requests per window
 * - X-RateLimit-Remaining: remaining requests in current window
 * - X-RateLimit-Reset: time (seconds since epoch) when the limit resets
 *
 * If a rate limit result object is attached to the request, use real values.
 * Otherwise, set default values (no limit enforced).
 */

declare global {
  namespace Express {
    interface Request {
      rateLimitInfo?: {
        limit: number;
        remaining: number;
        resetMs: number; // ms until reset
      };
    }
  }
}

/**
 * Attach rate limit headers to all responses.
 * Can be used standalone or after rate limit middleware.
 */
export function rateLimitHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.rateLimitInfo) {
    const now = Math.floor(Date.now() / 1000);
    const resetSeconds = now + Math.ceil(req.rateLimitInfo.resetMs / 1000);

    res.setHeader("X-RateLimit-Limit", String(req.rateLimitInfo.limit));
    res.setHeader("X-RateLimit-Remaining", String(req.rateLimitInfo.remaining));
    res.setHeader("X-RateLimit-Reset", String(resetSeconds));
  } else {
    // Default: no rate limit info — mark as unlimited
    res.setHeader("X-RateLimit-Limit", "100");
    res.setHeader("X-RateLimit-Remaining", "100");
    res.setHeader("X-RateLimit-Reset", String(Math.floor(Date.now() / 1000) + 3600));
  }

  next();
}