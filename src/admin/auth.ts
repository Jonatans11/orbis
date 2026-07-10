/**
 * Admin Authentication Middleware for ORBIS.ID SSI Backend.
 *
 * Provides:
 * - requireAdmin — Express middleware that verifies JWT and checks admin role
 * - seedAdminUser — Seeds the owner (Jonatan Schmidt) as admin on startup
 *
 * Users with `admin=1` in the ssi_users table can access admin endpoints.
 * Uses the same JWT verification as requireJwt from security/jwt.js.
 */

import type { Request, Response, NextFunction } from "express";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { verifyToken, findUserById, type JwtPayload, type UserRecord } from "../security/jwt.js";
import { logAudit, getClientIp } from "../security/audit.js";

// ─── Database Helpers ───────────────────────────────────────────────────────

const TEAM_DB = "team-db";

function query(sql: string): any[] {
  const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  try {
    const output = execSync(`${TEAM_DB} ${JSON.stringify(normalized)}`, {
      encoding: "utf-8",
      timeout: 10_000,
    });
    return JSON.parse(output.trim());
  } catch (err: any) {
    if (err.stderr?.includes("no such table")) return [];
    throw new Error(`DB query failed: ${err.message}`);
  }
}

function quote(val: string | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  return `'${val.replace(/'/g, "''")}'`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** Extended user record with admin status. */
export interface AdminUserRecord extends UserRecord {
  admin: number;
  status: string;
}

// ─── Migration: Add admin/status columns to existing tables ─────────────────

/**
 * Ensure the ssi_users table has the admin and status columns.
 * Safe to run multiple times — ALTER TABLE ADD COLUMN IF NOT EXISTS is handled
 * by catching errors if the column already exists.
 */
export function ensureAdminColumns(): void {
  // Add admin column (integer, default 0 = false)
  try {
    query("ALTER TABLE ssi_users ADD COLUMN admin INTEGER DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }

  // Add status column (for suspend/activate)
  try {
    query("ALTER TABLE ssi_users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  } catch {
    // Column already exists — ignore
  }
}

/**
 * Ensure the ssi_api_keys table exists with all columns.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS creates the table only once;
 * ALTER TABLE ADD COLUMN attempts are guarded by try/catch for when
 * the column already exists from a prior migration.
 */
export function ensureApiKeyColumns(): void {
  // Create the table with ALL columns upfront (idempotent)
  query("CREATE TABLE IF NOT EXISTS ssi_api_keys (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, key_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', company_name TEXT, contact_email TEXT, rate_limit_tier TEXT NOT NULL DEFAULT 'basic', expires_at TEXT, member_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), revoked_at TEXT, last_used_at TEXT)");

  // Migration safety: add columns that might not exist in older schemas
  try { query("ALTER TABLE ssi_api_keys ADD COLUMN company_name TEXT"); } catch { /* exists */ }
  try { query("ALTER TABLE ssi_api_keys ADD COLUMN contact_email TEXT"); } catch { /* exists */ }
  try { query("ALTER TABLE ssi_api_keys ADD COLUMN rate_limit_tier TEXT NOT NULL DEFAULT 'basic'"); } catch { /* exists */ }
  try { query("ALTER TABLE ssi_api_keys ADD COLUMN expires_at TEXT"); } catch { /* exists */ }
}

/**
 * Create the system webhook configurations table if it doesn't exist.
 */
export function ensureSystemWebhooksTable(): void {
  query(
    "CREATE TABLE IF NOT EXISTS ssi_system_webhooks (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, events TEXT NOT NULL, headers TEXT, active INTEGER NOT NULL DEFAULT 1, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
}

// ─── Admin Middleware ───────────────────────────────────────────────────────

/**
 * Middleware that requires a valid JWT and admin privileges.
 * Extracts JWT from `Authorization: Bearer <token>`, verifies it,
 * then looks up the user in ssi_users to check admin=1.
 *
 * On success, sets req.user (JwtPayload) and res.locals.dbUser (AdminUserRecord).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // 1. Parse Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: true, message: "Missing Authorization header" });
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({
      error: true,
      message: "Authorization header must be: Bearer <jwt_token>",
    });
    return;
  }

  const token = parts[1]!;

  // 2. Verify JWT
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: true, message: "Invalid or expired JWT token" });
    return;
  }

  // 3. Look up user in database with admin column
  const rows = query(`SELECT * FROM ssi_users WHERE id = ${quote(payload.sub)}`);
  if (rows.length === 0) {
    res.status(401).json({ error: true, message: "User not found" });
    return;
  }

  const user = rows[0] as AdminUserRecord;

  // 4. Check admin role
  if (!user.admin || user.admin !== 1) {
    res.status(403).json({ error: true, message: "Forbidden: Admin access required" });
    return;
  }

  // 5. Check user status (suspended users can't access admin)
  if (user.status === "suspended") {
    res.status(403).json({ error: true, message: "Account is suspended" });
    return;
  }

  // 6. Set user info on request
  req.user = payload as JwtPayload;
  res.locals.dbUser = user;

  next();
}

// ─── Admin Seeding ──────────────────────────────────────────────────────────

/**
 * Seed the owner as an admin user if they don't already exist.
 * Uses ADMIN_EMAIL env var with a fallback.
 * Creates the user with a random password (owner should reset it).
 */
export function seedAdminUser(): void {
  const adminEmail = process.env.ADMIN_EMAIL || "jonatan@orbis.id";
  const adminDisplayName = "Jonatan Schmidt";

  // Check if already exists
  const existing = query(`SELECT * FROM ssi_users WHERE email = ${quote(adminEmail.toLowerCase().trim())}`);
  if (existing.length > 0) {
    const user = existing[0] as AdminUserRecord;

    // Ensure admin flag is set on existing user
    if (!user.admin || user.admin !== 1) {
      query(`UPDATE ssi_users SET admin = 1, updated_at = datetime('now') WHERE email = ${quote(adminEmail.toLowerCase().trim())}`);
      console.log(`[ADMIN] Owner admin flag set for: ${adminEmail}`);
    }

    // Ensure status is active
    if (user.status !== "active") {
      query(`UPDATE ssi_users SET status = 'active', updated_at = datetime('now') WHERE email = ${quote(adminEmail.toLowerCase().trim())}`);
      console.log(`[ADMIN] Owner status reset to active: ${adminEmail}`);
    }

    console.log(`[ADMIN] Owner already exists: ${adminEmail}`);
    return;
  }

  // Create the admin user
  try {
    const id = randomBytes(16).toString("hex");
    const tempPassword = randomBytes(24).toString("base64url");
    const passwordHash = bcrypt.hashSync(tempPassword, 12);

    query(
      `INSERT INTO ssi_users (id, email, password_hash, display_name, admin, status, verified) VALUES (${quote(id)}, ${quote(adminEmail.toLowerCase().trim())}, ${quote(passwordHash)}, ${quote(adminDisplayName)}, 1, 'active', 1)`
    );

    console.log(`[ADMIN] ╔══════════════════════════════════════════════════╗`);
    console.log(`[ADMIN] ║         ADMIN USER CREATED                       ║`);
    console.log(`[ADMIN] ╠══════════════════════════════════════════════════╣`);
    console.log(`[ADMIN] ║  Email:    ${adminEmail}`);
    console.log(`[ADMIN] ║  Password: ${tempPassword}`);
    console.log(`[ADMIN] ║  ⚠️  CHANGE THIS PASSWORD AFTER FIRST LOGIN      ║`);
    console.log(`[ADMIN] ╚══════════════════════════════════════════════════╝`);

    // Audit log the admin seeding
    logAudit({
      actorType: "system",
      actorId: id,
      action: "auth.register",
      entityType: "user",
      entityId: id,
      result: "success",
      message: `Admin user auto-created: ${adminEmail}`,
    });
  } catch (err: any) {
    console.error(`[ADMIN] Failed to seed admin user: ${err.message}`);
  }
}