const API = "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api/${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).message || `Request failed (${res.status})`);
  return data as T;
}

export interface DIDRecord {
  id: string; did: string; method: string; status: string; created_at: string;
}

export interface CredentialRecord {
  credential_id: string; issuer_did: string; subject_did: string;
  type: string; status: string; issuance_date: string;
}

export const api = {
  health: () => apiFetch<{ status: string; version: string }>("health"),
  did: {
    list: () => apiFetch<{ success: boolean; count: number; dids: DIDRecord[] }>("did/list"),
    create: (method: "key" | "web" = "key") => apiFetch<{ success: boolean; did: string; didDocument: any }>("did/create", { method: "POST", body: JSON.stringify({ method }) }),
  },
  vc: {
    list: () => apiFetch<{ success: boolean; count: number; credentials: CredentialRecord[] }>("vc/credentials"),
  },
};