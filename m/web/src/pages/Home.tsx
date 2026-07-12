import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../lib/api";

export default function Home() {
  const [dids, setDids] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [d, c] = await Promise.all([api.did.list(), api.vc.list()]);
      if (d.success) setDids(d.dids);
      if (c.success) setCredentials(c.credentials);
    } catch { setError("Could not connect to SSI backend."); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    setCreating(true); setError(null);
    try { const r = await api.did.create("key"); if (r.success) load(); }
    catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const did = dids[0];
  const credLabel = (t: string) => { try { return JSON.parse(t).find((x: string) => x !== "VerifiableCredential") || t; } catch { return t; } };

  if (loading) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh" }}>
      <div className="spinner mb-4" />
      <p className="text-muted">Loading wallet...</p>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="title1">Wallet</h1>
          <p className="text-muted caption mt-1">Self-Sovereign Identity</p>
        </div>
        {did && <span className="badge badge-success"><span className="w-1.5 h-1.5 rounded-full bg-current" /> Connected</span>}
      </div>

      {error && <div className="card mb-4" style={{ background: "var(--danger-bg)", borderColor: "rgba(248,113,113,0.2)" }}><p className="text-secondary body">{error}</p></div>}

      <div className="card-gradient mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="overline text-muted">Digital Identity</span>
          {did && <span className="badge badge-info">did:key</span>}
        </div>
        {did ? (
          <>
            <p className="font-mono text-muted caption break-all mb-4">{did.did}</p>
            <div className="flex gap-3">
              <NavLink to="/credentials" className="btn-secondary flex-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7z"/><path d="M9 12 11 14 15 10"/></svg>{credentials.length} Creds</NavLink>
              <button onClick={load} className="btn-secondary flex-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21 12a9 9 0 11-9-9"/><path d="M21 3v5h-5"/></svg>Refresh</button>
            </div>
          </>
        ) : (
          <div className="text-center py-3">
            <p className="text-secondary body mb-3">Create your first digital identity.</p>
            <button onClick={handleCreate} disabled={creating} className="btn-primary">
              {creating ? <span className="spinner" /> : "Request Identity"}
            </button>
          </div>
        )}
      </div>

      <h2 className="title2 mb-3">Recent Activity</h2>
      {credentials.length === 0 ? (
        <div className="card text-center py-8" style={{ borderStyle: "dashed" }}>
          <svg className="w-10 h-10 mx-auto mb-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7z"/><path d="M16 8h-6a2 2 0 00-2 2v4a2 2 0 002 2h6"/><path d="M10 12h6"/></svg>
          <p className="text-muted body">No credentials yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {credentials.slice(0, 5).map(c => (
            <div key={c.credential_id} className="card flex items-center justify-between" style={{ padding: "14px 16px" }}>
              <div className="flex-1 min-w-0 mr-2">
                <p className="headline truncate">{credLabel(c.type)}</p>
                <p className="caption text-muted">Issued {new Date(c.issuance_date).toLocaleDateString()}</p>
              </div>
              <span className={`badge ${c.status === "active" ? "badge-success" : "badge-danger"}`}>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}