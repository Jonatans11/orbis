/**
 * Regression test: admin flag in auth responses.
 * Tests against the live server at localhost:3001.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { execSync, randomBytes } from "node:child_process";
import bcrypt from "bcryptjs";

const BASE_URL = "http://localhost:3001";
const TEAM_DB = "team-db";

function db(sql: string): any[] {
  const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return JSON.parse(execSync(`${TEAM_DB} ${JSON.stringify(normalized)}`, { encoding: "utf-8", timeout: 10_000 }).trim());
}

describe("admin flag in auth responses", () => {
  const testEmail = `admin-test-${uuidv4().slice(0, 8)}@orbis.id`;
  const testPassword = "StrongPass123!";

  beforeAll(() => {
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