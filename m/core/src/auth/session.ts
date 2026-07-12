/**
 * Session management: persists the ORBIS session (JWT + refresh token) in SecureKV
 * and transparently refreshes expired access tokens.
 * See wallet-specs/04-AUTH-FLOWS.md — OAuth is account convenience; DID keys are identity.
 */
import type { SecureKV, Clock } from "../platform/interfaces.js";
import { defaultClock } from "../platform/interfaces.js";
import type { OrbisApiClient } from "../api/client.js";
import type { AuthSession, OAuthProvider } from "../api/types.js";

const SESSION_KEY = "orbis.session";

export interface StoredSession {
  token: string;
  refreshToken?: string;
  userId: string;
  email: string;
  deviceId?: string;
  walletId?: string;
}

function jwtExpiresAt(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export class SessionManager {
  private cache: StoredSession | null = null;

  constructor(
    private readonly kv: SecureKV,
    private readonly api: OrbisApiClient,
    private readonly clock: Clock = defaultClock,
  ) {}

  async load(): Promise<StoredSession | null> {
    if (this.cache) return this.cache;
    const raw = await this.kv.get(SESSION_KEY);
    this.cache = raw ? (JSON.parse(raw) as StoredSession) : null;
    return this.cache;
  }

  async save(session: StoredSession): Promise<void> {
    this.cache = session;
    await this.kv.set(SESSION_KEY, JSON.stringify(session));
  }

  async clear(): Promise<void> {
    this.cache = null;
    await this.kv.delete(SESSION_KEY);
  }

  private async adopt(s: AuthSession, extra?: Partial<StoredSession>): Promise<StoredSession> {
    const stored: StoredSession = {
      token: s.token,
      userId: s.user.id,
      email: s.user.email,
      ...(s.refreshToken !== undefined ? { refreshToken: s.refreshToken } : {}),
      ...extra,
    };
    await this.save(stored);
    return stored;
  }

  async login(email: string, password: string): Promise<StoredSession> {
    return this.adopt(await this.api.auth.login(email, password));
  }

  async loginWithOAuth(provider: OAuthProvider, idToken: string, nonce: string): Promise<StoredSession> {
    return this.adopt(await this.api.auth.oauthExchange(provider, idToken, nonce));
  }

  /**
   * Token supplier for OrbisApiClient.getToken — returns a fresh JWT,
   * refreshing via /api/auth/refresh when within 60s of expiry.
   */
  async getValidToken(): Promise<string | null> {
    const s = await this.load();
    if (!s) return null;
    const exp = jwtExpiresAt(s.token);
    if (exp !== null && exp - this.clock.now().getTime() < 60_000 && s.refreshToken) {
      try {
        const refreshed = await this.api.auth.refresh(s.refreshToken);
        await this.adopt(refreshed, {
          ...(s.deviceId !== undefined ? { deviceId: s.deviceId } : {}),
          ...(s.walletId !== undefined ? { walletId: s.walletId } : {}),
        });
      } catch {
        return s.token; // let the server reject; caller handles 401 → re-auth
      }
    }
    return (await this.load())?.token ?? null;
  }
}
