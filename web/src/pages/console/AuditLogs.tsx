import { useState, useEffect } from "react";
import { ShieldCheck, Search, ShieldX } from "lucide-react";
import { api, type AuditLogEntry } from "../../lib/api";
import {
  Card, CardHeader, Input, StatusPill, Mono, Table, ErrorNote, EmptyState, useAsync
} from "../../components/ui";

export default function AuditLogs() {
  // Query secure audit logs
  const list = useAsync(async () => {
    // Standard secure query fetches the logs
    const res = await api.gateway.listAuditLogs();
    return res;
  }, []);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = list.data?.logs.filter((log) => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      (log.action || "").toLowerCase().includes(term) ||
      (log.entity_type || "").toLowerCase().includes(term) ||
      (log.message || "").toLowerCase().includes(term) ||
      (log.actor_type || "").toLowerCase().includes(term)
    );
  }) || [];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Security Audit Logs</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">Interactive, secure, and compliant audit trail tracking all platform-level DID, VC, and cryptographic state events.</p>
      </div>

      <Card>
        <CardHeader title={`Compliance Audit Log Trail${list.data ? ` · ${list.data.count} of ${list.data.total}` : ""}`} subtitle="Immutable ledger capturing actors, entities, operations, and execution results." />
        <div className="p-5 space-y-4">
          <div className="flex gap-2 max-w-md">
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter by action, entity, actor or message..." />
          </div>

          {list.error && <ErrorNote message={list.error} />}

          {list.data && filteredLogs.length === 0 && (
            <EmptyState title="No audit entries matched" hint="Try adjusting your filter or check back later." icon={<ShieldX size={20} />} />
          )}

          {list.data && filteredLogs.length > 0 && (
            <div className="overflow-x-auto pb-1">
              <Table head={
                <>
                  <th className="py-2.5 pr-4">Result</th>
                  <th className="py-2.5 pr-4">Action</th>
                  <th className="py-2.5 pr-4">Entity Type</th>
                  <th className="py-2.5 pr-4">Actor</th>
                  <th className="py-2.5 pr-4">Details</th>
                  <th className="py-2.5 pr-4">IP Address</th>
                  <th className="py-2.5">Timestamp</th>
                </>
              }>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="group">
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${log.result === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"} uppercase`}>
                        {log.result}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[13px] font-semibold text-ink">{log.action}</td>
                    <td className="py-3 pr-4 text-[12px] font-mono text-indigo-300 capitalize">{log.entity_type}</td>
                    <td className="py-3 pr-4 text-[12px] text-ink-2">
                      <span className="font-semibold capitalize text-indigo-400">{log.actor_type}</span>
                      {log.actor_id && <span className="text-ink-4"> ({log.actor_id.slice(0, 8)}...)</span>}
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] text-ink-3 max-w-xs truncate" title={log.message || ""}>{log.message || "—"}</td>
                    <td className="py-3 pr-4 text-[11.5px] font-mono text-ink-4">{log.ip_address || "0.0.0.0"}</td>
                    <td className="py-3 text-[12px] text-ink-3">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}