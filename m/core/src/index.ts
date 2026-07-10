// @orbis/wallet-core — shared SSI wallet logic for m/wallet-app (native) and m/web (PWA).
// No UI. No platform APIs. Platform capabilities are injected via ./platform/interfaces.

export * from "./platform/interfaces.js";
export * from "./keys/keygen.js";
export * from "./keys/hkdf.js";
export * from "./vault/crypto.js";
export * from "./vault/seal.js";
export * from "./did/didkey.js";
export * from "./api/errors.js";
export * from "./api/types.js";
export * from "./api/client.js";
export * from "./api/endpoints.js";
export * from "./auth/session.js";
export * from "./vc/store.js";
export * from "./didcomm/client.js";
