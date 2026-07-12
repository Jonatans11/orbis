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
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { verifyToken, findUserById, type JwtPayload, type UserRecord } from "../security/jwt.js";
import { logAudit, getClientIp } from "../security/audit.js";

// ─── Database Helpers ───────────────────────────────────────────────────────

const TEAM_DB = "team-db";

function query(sql: string): any[] {
  // execFileSync (no shell): SQL passed as a single argv item, so bcrypt
  // hashes ($2b$...) and whitespace/newlines in string literals are preserved.
  try {
    const output = execFileSync(TEAM_DB, [sql], {
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

// ─── Migration: Tables already exist — no-ops to prevent startup errors ─────

/**
 * All migration functions are no-ops because:
 * 1. team-db's Turso sync layer throws `Parse error: duplicate column name`
 *    for any ALTER TABLE ADD COLUMN on an existing column, and the try/catch
 *    guards are insufficient since the error occurs at the SQLite parser stage.
 * 2. All columns already exist in the database schema (verified in production).
 * 3. CREATE TABLE IF NOT EXISTS is safe but triggers unnecessary team-db calls
 *    on every startup, adding latency and potential connectivity noise.
 *
 * If a future migration needs to add columns, run ALTER TABLE manually via:
 *   team-db "ALTER TABLE <name> ADD COLUMN <column> <type>"
 * Then update this file's comments.
 */

/**
 * No-op. admin and status columns already exist on ssi_users.
 */
export function ensureAdminColumns(): void {
  // Columns verified present in existing schema.
}

/**
 * No-op. ssi_api_keys table and all columns already exist.
 */
export function ensureApiKeyColumns(): void {
  // Table+columns verified present in existing schema.
}

/**
 * No-op. ssi_system_webhooks table and all columns already exist.
 */
export function ensureSystemWebhooksTable(): void {
  // Table+columns verified present in existing schema.
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