import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/wallet")({
  component: WalletHome,
});

const SSI_BACKEND = "http://localhost:3001";
const api = (path: string) => `${SSI_BACKEND}/api/${path}`;

type DIDRecord = {
  id: string;
  did: string;
  method: string;
  status: string;
  created_at: string;
};

type CredentialRecord = {
  credential_id: string;
  issuer_did: string;
  subject_did: string;
  type: string;
  status: string;
  issuance_date: string;
};

function WalletHome() {
  const [dids, setDids] = useState<DIDRecord[]>([]);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingDid, setCreatingDid] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [didRes, credRes] = await Promise.all([
        fetch(api("did/list")),
        fetch(api("vc/credentials")),
      ]);
      const didData = await didRes.json();
      const credData = await credRes.json();
      if (didData.success) setDids(didData.dids || []);
      if (credData.success) setCredentials(credData.credentials || []);
    } catch (err: any) {
      setError("Could not connect to SSI backend. Start it on port 3001.");
    } finally {
      setLoading(false);
    }
  };

  const createDID = async () => {
    setCreatingDid(true);
    try {
      const res = await fetch(api("did/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "key" }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      } else {
        setError(data.message || "Failed to create DID");
      }
    } catch (err: any) {
      setError("Failed to create DID: " + err.message);
    } finally {
      setCreatingDid(false);
    }
  };

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <img src="/logo/orbis-mark.svg" alt="" className="mx-auto mb-4 h-12 w-12" />
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            ORBIS.ID Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your self-sovereign identity dashboard
          </p>
        </div>

        {error && (
          <div className="mx-auto mb-6 max-w-md rounded-xl border border-orbis-danger/30 bg-orbis-danger/5 p-4 text-sm text-orbis-danger">
            {error}
          </div>
        )}

        {loading && (
          <div className="mx-auto mb-10 max-w-md text-center">
            <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-full bg-orbis-primary/10" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Connecting to SSI backend...</p>
          </div>
        )}

        {!loading && (
          <>
            <div className="mx-auto mb-10 max-w-md">
              <div className="relative overflow-hidden rounded-2xl bg-orbis-gradient p-6 text-white shadow-xl">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />
                <div className="relative">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-white/70">
                      Digital Identity
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase">
                      {dids.length > 0 ? "Active" : "No DID"}
                    </span>
                  </div>
                  <div className="mb-4">
                    <div className="mb-1 text-xs text-white/60">DID</div>
                    <div className="truncate font-mono text-sm text-white/90">
                      {dids.length > 0 ? dids[0].did : "— No identity yet —"}
                    </div>
                  </div>
                  <div className="mb-6 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-white/60">Credentials</div>
                      <div className="text-lg font-bold">{credentials.length}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/60">Verifications</div>
                      <div className="text-lg font-bold">0</div>
                    </div>
                  </div>
                  {dids.length === 0 && (
                    <button
                      onClick={createDID}
                      disabled={creatingDid}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/20 py-2.5 text-sm font-semibold backdrop-blur-sm transition-all hover:bg-white/30 disabled:opacity-50"
                    >
                      {creatingDid ? "Generating..." : "Create Your Identity"}
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
              <button
                onClick={createDID}
                disabled={creatingDid}
                className="card-hover rounded-xl border border-gray-200/60 bg-white p-5 text-center dark:border-orbis-border/60 dark:bg-orbis-surface disabled:opacity-50"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-orbis-primary/10 text-orbis-primary dark:text-orbis-accent">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {creatingDid ? "Creating..." : "Create DID"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {dids.length > 0 ? "Already have an identity" : "Generate a new self-custodied identity"}
                </p>
              </button>

              <div className={`card-hover rounded-xl border p-5 text-center ${
                dids.length > 0
                  ? "border-gray-200/60 bg-white dark:border-orbis-border/60 dark:bg-orbis-surface"
                  : "border-gray-200/30 bg-gray-50 opacity-50 dark:border-orbis-border/30 dark:bg-orbis-surface/50"
              }`}>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-orbis-primary/10 text-orbis-primary dark:text-orbis-accent">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Credentials</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {credentials.length > 0
                    ? `${credentials.length} credential(s) in wallet`
                    : "Manage verifiable credentials"}
                </p>
              </div>

              <div className={`card-hover rounded-xl border p-5 text-center ${
                dids.length > 0
                  ? "border-gray-200/60 bg-white dark:border-orbis-border/60 dark:bg-orbis-surface"
                  : "border-gray-200/30 bg-gray-50 opacity-50 dark:border-orbis-border/30 dark:bg-orbis-surface/50"
              }`}>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-orbis-primary/10 text-orbis-primary dark:text-orbis-accent">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Verify</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Scan QR to verify credentials</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}