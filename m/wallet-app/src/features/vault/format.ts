/** Formatting helpers for vault & consent screens. */

/** "12.4 MB", "512 KB", "96 B". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Minor units → "$2.00" (USD fixed in v1). */
export function formatMoney(amountMinor: number, currency = 'USD'): string {
  const major = (amountMinor / 100).toFixed(2);
  return currency === 'USD' ? `$${major}` : `${major} ${currency}`;
}

/** SQLite `datetime('now')` is UTC "YYYY-MM-DD HH:MM:SS" — normalize before parsing. */
export function parseServerDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }
  return new Date(value);
}

/** Relative "just now / 5m ago / 3h ago / 2d ago / Mar 12". */
export function relativeTime(value: string, now: Date = new Date()): string {
  const then = parseServerDate(value);
  const diffMs = now.getTime() - then.getTime();
  if (Number.isNaN(diffMs)) return value;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Countdown label for grant expiry: "89d left" / "5h left" / "12m left" / "Expired". */
export function countdownLabel(expiresAt: string, now: Date = new Date()): string {
  const diffMs = parseServerDate(expiresAt).getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const mins = Math.ceil(diffMs / 60_000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

/** "Expired Jul 17" style label. */
export function expiredLabel(expiresAt: string): string {
  const d = parseServerDate(expiresAt);
  return `Expired ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** Localized "Jul 17, 3:00 PM" used in the consent review sentence. */
export function expiryDisplay(expiresAt: string | Date): string {
  const d = typeof expiresAt === 'string' ? parseServerDate(expiresAt) : expiresAt;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Truncate a DID for display: "did:key:z6Mk…9fD2". */
export function truncateDid(did: string, keep = 8): string {
  if (did.length <= keep * 2 + 6) return did;
  return `${did.slice(0, did.indexOf(':z') > 0 ? did.indexOf(':z') + 2 + keep : keep + 8)}…${did.slice(-4)}`;
}
