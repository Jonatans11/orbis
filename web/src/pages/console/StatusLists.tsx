import { useState } from "react";
import { Activity, Plus, RefreshCw, Layers, ShieldCheck, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { api, type StatusListRecord } from "../../lib/api";
import {
  Card, CardHeader, Input, StatusPill, Button, Table, ErrorNote, EmptyState, useAsync
} from "../../components/ui";

export default function StatusLists() {
  const [listIdInput, setListIdInput] = useState("");
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Create New List Form State
  const [newName, setNewName] = useState("");
  const [newIssuer, setNewIssuer] = useState("did:key:z6MkhaXgBZDvG7JD935YJn9G3W9bX2j9hSDFSDg");
  const [newPurpose, setNewPurpose] = useState<"revocation" | "suspension">("revocation");
  const [newBits, setNewBits] = useState(131072); // Default 128KB list

  // Bit toggle form state
  const [bitIndex, setBitIndex] = useState<number>(0);
  const [bitStatus, setBitStatus] = useState<boolean>(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch individual StatusList
  const fetchList = useAsync(async () => {
    if (!activeListId) return null;
    const res = await api.status.get(activeListId);
    return res.statusList;
  }, [activeListId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await api.status.create({
        name: newName,
        issuerDid: newIssuer,
        statusPurpose: newPurpose,
        numBits: newBits,
      });
      if (res.success) {
        setSuccessMsg(`Status List "${res.statusList.name}" created successfully!`);
        setActiveListId(res.statusList.id);
        setListIdInput(res.statusList.id);
        setNewName("");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create status list");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBitToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeListId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await api.status.update({
        listId: activeListId,
        index: bitIndex,
        status: bitStatus,
      });
      if (res.success) {
        setSuccessMsg(`Index ${bitIndex} successfully updated to ${bitStatus ? "REVOKED/SUSPENDED" : "ACTIVE"}.`);
        fetchList.run(); // Reload list state
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update status bit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">W3C StatusList2021 Registries</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">Manage highly compressed, bitstring-based cryptographic status lists for secure revocation and suspension.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Creation Form */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader title="Create Registry" subtitle="Generate a new bitstring status list." />
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-[11.5px] font-medium text-ink-3 uppercase tracking-wider mb-1.5">Registry Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Employee Revocation List 2025" required />
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-ink-3 uppercase tracking-wider mb-1.5">Issuer DID</label>
                <Input value={newIssuer} onChange={(e) => setNewIssuer(e.target.value)} required />
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-ink-3 uppercase tracking-wider mb-1.5">Status Purpose</label>
                <select
                  value={newPurpose}
                  onChange={(e: any) => setNewPurpose(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-[var(--color-accent)]"
                >
                  <option value="revocation">Revocation (Bit 1 = Revoked)</option>
                  <option value="suspension">Suspension (Bit 1 = Suspended)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-ink-3 uppercase tracking-wider mb-1.5">Registry Size (Bits)</label>
                <select
                  value={newBits}
                  onChange={(e: any) => setNewBits(parseInt(e.target.value, 10))}
                  className="w-full rounded-md border border-[var(--color-line-2)] bg-[var(--color-surface-2)] px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-[var(--color-accent)]"
                >
                  <option value={1024}>1,024 bits (Small Testing)</option>
                  <option value={16384}>16,384 bits (Medium)</option>
                  <option value={131072}>131,072 bits (Production Default)</option>
                </select>
              </div>

              <Button type="submit" disabled={submitting} className="w-full justify-center">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create Status List
              </Button>
            </form>
          </Card>
        </div>

        {/* List Details & Bit Toggling */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Load & Manage Status List" subtitle="Enter a Status List ID to inspect and flip revocation/suspension status bits." />
            <div className="p-5 space-y-5">
              <div className="flex gap-2.5">
                <Input value={listIdInput} onChange={(e) => setListIdInput(e.target.value)} placeholder="Enter Status List ID..." className="flex-1" />
                <Button onClick={() => setActiveListId(listIdInput)} variant="secondary">
                  <RefreshCw size={14} /> Load Registry
                </Button>
              </div>

              {errorMsg && <ErrorNote message={errorMsg} />}
              {successMsg && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-[13px] text-emerald-400 font-medium">
                  {successMsg}
                </div>
              )}

              {fetchList.loading && (
                <div className="flex items-center justify-center py-10 text-ink-3 gap-2">
                  <Loader2 size={16} className="animate-spin" /> Fetching registry status...
                </div>
              )}

              {fetchList.data && (
                <div className="space-y-5 pt-2 border-t border-[var(--color-line)]">
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div>
                      <span className="text-ink-3">Name:</span> <strong className="text-ink">{fetchList.data.name}</strong>
                    </div>
                    <div>
                      <span className="text-ink-3">Purpose:</span>{" "}
                      <span className="inline-block rounded bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-bold text-indigo-400 uppercase">
                        {fetchList.data.status_purpose}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-3">Issuer:</span>{" "}
                      <span className="font-mono text-[11.5px] text-ink-2" title={fetchList.data.issuer_did}>
                        {fetchList.data.issuer_did.slice(0, 20)}...
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-3">Gzipped Bitstring Length:</span>{" "}
                      <span className="font-mono text-[12px] text-teal-400">{fetchList.data.encoded_list.length} characters</span>
                    </div>
                  </div>

                  {/* Toggle Bit Action Form */}
                  <form onSubmit={handleBitToggle} className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-surface-2)] p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Activity size={15} className="text-[var(--color-accent-hi)]" />
                      <h3 className="text-[13.5px] font-semibold text-ink">Bit State Management</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-[11px] font-medium text-ink-3 mb-1">Target Bit Index</label>
                        <Input
                          type="number"
                          value={bitIndex}
                          onChange={(e) => setBitIndex(parseInt(e.target.value, 10))}
                          min={0}
                          placeholder="e.g. 145"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink-3 mb-1">Flipped Status</label>
                        <select
                          value={bitStatus ? "1" : "0"}
                          onChange={(e) => setBitStatus(e.target.value === "1")}
                          className="w-full rounded-md border border-[var(--color-line-2)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-[var(--color-accent)]"
                        >
                          <option value="1">Suspended / Revoked (1)</option>
                          <option value="0">Active (0)</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <Button type="submit" disabled={submitting} className="w-full justify-center">
                          Update State
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {!fetchList.data && !fetchList.loading && (
                <EmptyState title="No registry loaded" hint="Provide a valid Status List registry ID above or create a new registry to begin management." icon={<Layers size={20} />} />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}