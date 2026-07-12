/** API error surface — mirrors the backend error shape { error: { code, message } }. */

export const WalletErrorCodes = {
  WALLET_NOT_REGISTERED: "WALLET_NOT_REGISTERED",
  WALLET_WIPED: "WALLET_WIPED",
  DEVICE_MISMATCH: "DEVICE_MISMATCH",
  GRANT_EXPIRED: "GRANT_EXPIRED",
  GRANT_REVOKED: "GRANT_REVOKED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
} as const;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** Remote wipe flag — caller must erase local state and return to onboarding. */
  get isWalletWiped(): boolean {
    return this.status === 410 || this.code === WalletErrorCodes.WALLET_WIPED;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }
}

export class NetworkError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "NetworkError";
  }
}
