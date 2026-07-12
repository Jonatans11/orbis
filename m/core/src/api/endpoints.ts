/**
 * Canonical endpoint catalogue. The typed methods on OrbisApiClient are the primary
 * interface; this map exists for docs, logging, and route-coverage checks.
 * "live" = implemented in orbis-repo src today; "planned" = wallet-specs/02-API-SPEC.md.
 */
export const ENDPOINTS = {
  auth: {
    register: { method: "POST", path: "/api/auth/register", status: "live" },
    login: { method: "POST", path: "/api/auth/login", status: "live" },
    me: { method: "GET", path: "/api/auth/me", status: "live" },
    changePassword: { method: "POST", path: "/api/auth/change-password", status: "live" },
    linkDid: { method: "POST", path: "/api/auth/link-did", status: "live" },
    oauthExchange: { method: "POST", path: "/api/auth/oauth/exchange", status: "planned" },
    refresh: { method: "POST", path: "/api/auth/refresh", status: "planned" },
  },
  did: {
    create: { method: "POST", path: "/api/did/create", status: "live" },
    resolve: { method: "GET", path: "/api/did/resolve/:did", status: "live" },
    list: { method: "GET", path: "/api/did/list", status: "live" },
    revoke: { method: "PUT", path: "/api/did/:id/revoke", status: "live" },
  },
  vc: {
    issue: { method: "POST", path: "/api/vc/issue", status: "live" },
    verify: { method: "POST", path: "/api/vc/verify", status: "live" },
    list: { method: "GET", path: "/api/vc/credentials", status: "live" },
    zkChallenge: { method: "POST", path: "/api/vc/zk/challenge", status: "live" },
    // SECURITY: server-side prove is a verifier/test utility only — wallets prove on-device.
    zkProve: { method: "POST", path: "/api/vc/zk/prove", status: "live" },
    zkVerify: { method: "POST", path: "/api/vc/zk/verify", status: "live" },
  },
  trust: {
    register: { method: "POST", path: "/api/trust/register", status: "live" },
    check: { method: "GET", path: "/api/trust/check/:did", status: "live" },
    issuers: { method: "GET", path: "/api/trust/issuers", status: "live" },
    entities: { method: "GET", path: "/api/trust/entities", status: "live" },
  },
  didcomm: {
    send: { method: "POST", path: "/api/didcomm/send", status: "live" },
    inbox: { method: "GET", path: "/api/didcomm/inbox", status: "live" },
    message: { method: "GET", path: "/api/didcomm/messages/:id", status: "live" },
    updateStatus: { method: "PUT", path: "/api/didcomm/messages/:id/status", status: "live" },
    trustPing: { method: "POST", path: "/api/didcomm/trust-ping", status: "live" },
    oobCreate: { method: "POST", path: "/api/didcomm/oob/create", status: "live" },
    oobParse: { method: "GET", path: "/api/didcomm/oob/parse", status: "live" },
    oobInvitations: { method: "GET", path: "/api/didcomm/oob/invitations", status: "live" },
    oobConsume: { method: "PUT", path: "/api/didcomm/oob/:id/consume", status: "live" },
  },
  wallet: {
    register: { method: "POST", path: "/api/wallet/register", status: "live" },
    status: { method: "GET", path: "/api/wallet/status", status: "live" },
    deleteDevice: { method: "DELETE", path: "/api/wallet/device/:deviceId", status: "live" },
    pushToken: { method: "PUT", path: "/api/wallet/push-token", status: "live" },
    backup: { method: "POST", path: "/api/wallet/credentials/backup", status: "live" },
    listBackups: { method: "GET", path: "/api/wallet/credentials/backup", status: "live" },
    deleteBackup: { method: "DELETE", path: "/api/wallet/credentials/backup/:localId", status: "live" },
    storeData: { method: "POST", path: "/api/wallet/data/store", status: "live" },
    listData: { method: "GET", path: "/api/wallet/data/:category", status: "live" },
    getRecord: { method: "GET", path: "/api/wallet/data/record/:recordId", status: "live" },
    deleteRecord: { method: "DELETE", path: "/api/wallet/data/record/:recordId", status: "live" },
    createGrant: { method: "POST", path: "/api/wallet/data/share", status: "live" },
    redeemGrant: { method: "GET", path: "/api/wallet/share/:grantId", status: "live" },
    listGrants: { method: "GET", path: "/api/wallet/data/grants", status: "live" },
    revokeGrant: { method: "DELETE", path: "/api/wallet/data/grants/:grantId", status: "live" },
    presentVc: { method: "POST", path: "/api/wallet/vc/present", status: "live" },
    messagesWaiting: { method: "GET", path: "/api/wallet/messages/waiting", status: "live" },
    ackMessages: { method: "PUT", path: "/api/wallet/messages/waiting", status: "live" },
  },
  admin: {
    walletUsers: { method: "GET", path: "/api/wallet/admin/users", status: "live" },
    walletCredentials: { method: "GET", path: "/api/wallet/admin/credentials", status: "live" },
    remoteWipe: { method: "DELETE", path: "/api/wallet/admin/remote-wipe/:walletId", status: "live" },
  },
} as const;
