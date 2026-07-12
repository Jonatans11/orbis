import { describe, it, expect, beforeAll } from "vitest";
import { initDatabase } from "../src/db/metadata.js";
import { initAuditTable, logAudit, listAuditLogs } from "../src/security/audit.js";

beforeAll(() => {
  initDatabase();
  initAuditTable();
});

describe("Compliance Security Audit Log", () => {
  it("should record a successful audit event", () => {
    logAudit({
      actorType: "user",
      actorId: "test-user-id",
      action: "did.create",
      entityType: "did",
      entityId: "did:key:z6MkhaXgBZDv",
      result: "success",
      message: "DID created successfully",
    });

    const logs = listAuditLogs(10, 0);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const target = logs.find(l => l.entity_id === "did:key:z6MkhaXgBZDv");
    expect(target).toBeDefined();
    expect(target!.action).toBe("did.create");
    expect(target!.result).toBe("success");
    expect(target!.message).toBe("DID created successfully");
  });
});