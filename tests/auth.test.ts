/**
 * Regression test: admin flag in auth responses.
 * Tests against the live server at localhost:3001.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import express from "express";
import type { Server } from "node:http";

import { initDatabase } from "../src/db/metadata.js";
import { initAuthTables, loginHandler, meHandler, requireJwt } from "../src/security/jwt.js";

// Boot the auth handlers in-process on an ephemeral port so this
// regression test runs anywhere (no live server required).
let server: Server;
let BASE_URL = "";
const TEAM_DB = "team-db";

function db(sql: string): any[] {
  // execFileSync (argv, no shell) — a shell would expand the $ in bcrypt hashes.
  const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return JSON.parse(execFileSync(TEAM_DB, [normalized], { encoding: "utf-8", timeout: 10_000 }).trim());
}

describe("admin flag in auth responses", () => {
  const testEmail = `admin-test-${uuidv4().slice(0, 8)}@orbis.id`;
  const testPassword = "StrongPass123!";

  beforeAll(async () => {
    initDatabase();
    initAuthTables();
    const app = express();
    app.use(express.json());
    app.post("/api/auth/login", loginHandler);
    app.get("/api/auth/me", requireJwt, meHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    BASE_URL = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

    // Register user directly via team-db with admin=1
    const id = randomBytes(16).toString("hex");
    const hash = bcrypt.hashSync(testPassword, 12);
    db(`INSERT INTO ssi_users (id, email, password_hash, display_name, admin, verified) VALUES ('${id}', '${testEmail}', '${hash}', 'Admin Test', 1, 1)`);
  });

  it("login/me should return admin flag for admin user", async () => {
    // Login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.user).toBeDefined();
    expect(loginData.user.admin).toBe(true);
    expect(loginData.token).toBeTruthy();

    // Verify /me also returns admin
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.success).toBe(true);
    expect(meData.user.admin).toBe(true);
  });
});
afterAll(() => {
  server?.close();
});
