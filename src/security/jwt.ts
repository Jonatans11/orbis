/**
 * JWT Authentication Module for ORBIS.ID SSI Backend.
 *
 * Provides:
 * - User registration (signup) with hashed secrets stored in team-db
 * - Login endpoint that issues JWT tokens
 * - JWT verification middleware for protected routes
 *
 * The JWT_SECRET is read from environment or auto-generated (dev only).
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { logAudit, getClientIp } from "./audit.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const JWT_SECRET: string =
  process.env.JWT_SECRET || randomBytes(32).toString("hex");
const JWT_EXPIRES_IN = "24h";
const BCRYPT_ROUNDS = 12;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  did: string | null;
  created_at: string;
  updated_at: string;
  verified: number;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  did?: string;
  iat: number;
  exp: number;
}

// Augment Express Request with user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

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

// ─── Table Init ─────────────────────────────────────────────────────────────

export function initAuthTables(): void {
  // Users table for JWT authentication
  query(
    "CREATE TABLE IF NOT EXISTS ssi_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, did TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), verified INTEGER NOT NULL DEFAULT 0)"
  );
}

// ─── User Operations ────────────────────────────────────────────────────────

export function findUserByEmail(email: string): UserRecord | null {
  const rows = query(
    `SELECT * FROM ssi_users WHERE email = ${quote(email.toLowerCase().trim())}`
  );
  return rows.length > 0 ? (rows[0] as UserRecord) : null;
}

export function findUserById(id: string): UserRecord | null {
  const rows = query(`SELECT * FROM ssi_users WHERE id = ${quote(id)}`);
  return rows.length > 0 ? (rows[0] as UserRecord) : null;
}

export async function createUser(
  email: string,
  password: string,
  displayName: string
): Promise<UserRecord> {
  const id = randomBytes(16).toString("hex");
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const normalizedEmail = email.toLowerCase().trim();

  query(
    `INSERT INTO ssi_users (id, email, password_hash, display_name) VALUES (${quote(id)}, ${quote(normalizedEmail)}, ${quote(passwordHash)}, ${quote(displayName)})`
  );

  const user = findUserById(id);
  if (!user) throw new Error("Failed to create user");
  return user;
}

export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

// ─── JWT Operations ─────────────────────────────────────────────────────────

export function generateToken(user: UserRecord): string {
  const payload: Omit<JwtPayload, "iat" | "exp"> = {
    sub: user.id,
    email: user.email,
    did: user.did || undefined,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

// ─── Express Middleware ──────────────────────────────────────────────────────

/**
 * Middleware that requires a valid JWT Bearer token.
 * Attaches decoded payload to req.user.
 */
export function requireJwt(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: true, message: "Invalid or expired JWT token" });
    return;
  }

  req.user = payload;
  next();
}

// ─── Express Route Handlers ──────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Register a new user account.
 * Body: { email, password, displayName }
 */
export async function registerHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, displayName } = req.body;

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: true, message: "email is required" });
      return;
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      res.status(400).json({
        error: true,
        message: "password is required and must be at least 8 characters",
      });
      return;
    }
    if (!displayName || typeof displayName !== "string") {
      res.status(400).json({ error: true, message: "displayName is required" });
      return;
    }

    // Check if user already exists
    const existing = findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: true, message: "Email already registered" });
      return;
    }

    const user = await createUser(email, password, displayName);
    const token = generateToken(user);

    // Audit log: user registration
    logAudit({
      actorType: "user",
      actorId: user.id,
      action: "auth.register",
      entityType: "user",
      entityId: user.id,
      result: "success",
      message: `User registered: ${user.email}`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        did: user.did,
        verified: user.verified === 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
}

/**
 * POST /api/auth/login
 * Authenticate and receive a JWT token.
 * Body: { email, password }
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: true, message: "email is required" });
      return;
    }
    if (!password || typeof password !== "string") {
      res.status(400).json({ error: true, message: "password is required" });
      return;
    }

    const user = findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: true, message: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: true, message: "Invalid email or password" });
      return;
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        did: user.did,
        verified: user.verified === 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
}

/**
 * GET /api/auth/me
 * Get current user profile from JWT token.
 * Requires: Authorization: Bearer <token>
 */
export function meHandler(req: Request, res: Response): void {
  const user = findUserById(req.user!.sub);
  if (!user) {
    res.status(404).json({ error: true, message: "User not found" });
    return;
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      did: user.did,
      verified: user.verified === 1,
      created_at: user.created_at,
    },
  });
}

/**
 * PUT /api/auth/password
 * Change password (requires JWT).
 * Body: { currentPassword, newPassword }
 */
export async function changePasswordHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = findUserById(req.user!.sub);
    if (!user) {
      res.status(404).json({ error: true, message: "User not found" });
      return;
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: true, message: "Current password is incorrect" });
      return;
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      res.status(400).json({
        error: true,
        message: "newPassword must be at least 8 characters",
      });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    query(
      `UPDATE ssi_users SET password_hash = ${quote(newHash)}, updated_at = datetime('now') WHERE id = ${quote(user.id)}`
    );

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
}

/**
 * PUT /api/auth/did
 * Link a DID to the user account (requires JWT).
 * Body: { did }
 */
export function linkDIDHandler(req: Request, res: Response): void {
  try {
    const { did } = req.body;
    if (!did || typeof did !== "string" || !did.startsWith("did:")) {
      res.status(400).json({ error: true, message: "Valid did is required" });
      return;
    }

    query(
      `UPDATE ssi_users SET did = ${quote(did)}, updated_at = datetime('now') WHERE id = ${quote(req.user!.sub)}`
    );

    res.json({ success: true, message: "DID linked to account" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
}