export function adminFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("orbis_admin_token");
  return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } }).then(r => r.json());
}
