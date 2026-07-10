/**
 * ORBIS.ID backend API client.
 *
 * Thin typed fetch wrapper over the ORBIS REST API (see /docs/API-GUIDE.md
 * and openapi.yaml in the repo root). The base URL comes from app.json
 * `extra.apiBaseUrl` and can be overridden for local development.
 */
import Constants from 'expo-constants';

import { SecureKeys, secureGet } from '@/storage/secureStore';

const DEFAULT_BASE_URL = 'https://orbis.ctonew.app';

export function getBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  return extra?.apiBaseUrl ?? DEFAULT_BASE_URL;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await secureGet(SecureKeys.sessionToken);
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }

  if (!res.ok) {
    const message =
      (json as { error?: string; message?: string })?.error ??
      (json as { error?: string; message?: string })?.message ??
      `Request failed (${res.status})`;
    throw new ApiError(res.status, message, json);
  }
  return json as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);

// ---------------------------------------------------------------------------
// Types (aligned with web/src/lib/api.ts)
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  did?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: UserProfile;
}

export interface DidRecord {
  did: string;
  method: 'key' | 'web';
  created_at?: string;
}

export interface VerifiableCredential {
  '@context': string[];
  id?: string;
  type: string[];
  issuer: string | { id: string };
  validFrom?: string;
  validUntil?: string;
  credentialSubject: Record<string, unknown>;
  proof?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const api = {
  health: () => get<{ status: string }>('/api/health'),

  auth: {
    register: (body: { email: string; password: string; name?: string }) =>
      post<AuthResponse>('/api/auth/register', body),
    login: (body: { email: string; password: string }) =>
      post<AuthResponse>('/api/auth/login', body),
    me: () => get<{ user: UserProfile }>('/api/auth/me'),
  },

  did: {
    create: (body: { method: 'key' | 'web'; domain?: string }) =>
      post<{ success: boolean; did: string; didDocument: Record<string, unknown> }>(
        '/api/did/create',
        body,
      ),
    resolve: (did: string) =>
      get<{ didDocument: Record<string, unknown> }>(`/api/did/resolve/${encodeURIComponent(did)}`),
  },

  vc: {
    verify: (body: { credential: VerifiableCredential }) =>
      post<{ verified: boolean; checks?: unknown[] }>('/api/vc/verify', body),
  },

  didcomm: {
    send: (body: { to: string; from?: string; type: string; body: Record<string, unknown> }) =>
      post<{ success: boolean; id: string }>('/api/didcomm/send', body),
  },
};
