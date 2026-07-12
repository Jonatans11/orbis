import { useState, useEffect } from "react";
import { api } from "../lib/api";

const CAT_COLORS: Record<string, { from: string; to: string; icon: string }> = {
  Identity: { from: "#4F46E5", to: "#22D3EE", icon: "person" },
  Medical: { from: "#065F46", to: "#34D399", icon: "heart" },
  Financial: { from: "#92400E", to: "#FBBF24", icon: "bank" },
  Assets: { from: "#5B21B6", to: "#A78BFA", icon: "key" },
  Education: { from: "#1E40AF", to: "#60A5FA", icon: "grad" },
  Membership: { from: "#9D174D", to: "#F472B6", icon: "ribbon" },
};

function guessCategory(type: string): string {
  if (type.includes("Age") || type.includes("Email") || type.includes("Identity") || type.includes("KYC")) return "Identity";
  if (type.includes("Medical") || type.includes("Health")) return "Medical";
  if (type.includes("Bank") || type.includes("Financ")) return "Financial";
  if (type.includes("Asset") || type.includes("Property")) return "Assets";
  if (type.includes("Edu") || type.includes("Degree")) return "Education";
  if (type.includes("Member") || type.includes("Premium")) return "Membership";
  return "Identity";
}

function credLabel(t: string) {
  try { return JSON.parse(t).find((x: string) => x !== "VerifiableCredential") || t; } catch { return t; }
}

export default function Credentials() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.vc.list().then(d => { if (d.success) setCredentials(d.credentials); }).finally(() => setLoading(false)); }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh" }}>
      <div className="spinner mb-4" />
      <p className="text-muted">Loading credentials...</p>
    </div>
  );

  return (
    <>
      <h1 className="title1 mb-1">Credentials</h1>
      <p className="text-muted caption mb-6">Verifiable Credentials</p>

      {credentials.length === 0 ? (
        <div className="card text-center py-10" style={{ borderStyle: "dashed" }}>
          <svg className="w-12 h-12 mx-auto mb-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7z"/><path d="M16 8h-6a2 2 0 00-2 2v4a2 2 0 002 2h6"/><path d="M10 12h6"/></svg>
          <p className="text-secondary body">No credentials yet</p>
          <p className="text-muted caption mt-1">Request a credential from an issuer</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {credentials.map(c => {
            const label = credLabel(c.type);
            const cat = guessCategory(label);
            const colors = CAT_COLORS[cat] || CAT_COLORS.Identity;
            return (
              <div key={c.credential_id} className="card" style={{ background: `linear-gradient(135deg, ${colors.from}22, ${colors.to}11)`, borderColor: `${colors.from}44` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="headline">{label}</span>
                  <span className={`badge ${c.status === "active" ? "badge-success" : "badge-danger"}`}>{c.status}</span>
                </div>
                <div className="flex flex-col gap-1 caption text-muted">
                  <p className="font-mono truncate">{c.issuer_did.slice(0, 32)}...</p>
                  <p>Issued {new Date(c.issuance_date).toLocaleDateString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}