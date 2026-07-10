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
    password: { method: "PUT", path: "/api/auth/password", status: "live" },
    linkDid: { method: "PUT", path: "/api/auth/did", status: "live" },
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
    zkProve: { method: "POST", path: "/api/vc/zk/prove", status: "live" },
    zkVerify: { method: "POST", path: "/api/vc/zk/verify", status: "live" },
  },
  trust: {
    register: { method: "POST", path: "/api/trust/register", status: "live" },
    check: { method: "GET", path: "/api/trust/check/:did", status: "live" },
    issuers: { method: "GET", path: "/api/trust/issuers", status: "live" },
  },
  didcomm: {
    send: { method: "POST", path: "/api/didcomm/send", status: "live" },
    inbox: { method: "GET", path: "/api/didcomm/inbox", status: "live" },
    message: { method: "GET", path: "/api/didcomm/messages/:id", status: "live" },
    updateStatus: { method: "PUT", path: "/api/didcomm/messages/:id/status", status: "live" },
    trustPing: { method: "POST", path: "/api/didcomm/trust-ping", status: "live" },
    oobCreate: { method: "POST", path: "/api/didcomm/oob/create", status: "live" },
    oobParse: { method: "GET", path: "/api/didcomm/oob/parse", status: "live" },
  },
  wallet: {
    register: { method: "POST", path: "/api/wallet/register", status: "planned" },
    status: { method: "GET", path: "/api/wallet/status", status: "planned" },
    deleteDevice: { method: "DELETE", path: "/api/wallet/device/:deviceId", status: "planned" },
    pushToken: { method: "PUT", path: "/api/wallet/push-token", status: "planned" },
    backup: { method: "POST", path: "/api/wallet/credentials/backup", status: "planned" },
    listBackups: { method: "GET", path: "/api/wallet/credentials/backup", status: "planned" },
    deleteBackup: { method: "DELETE", path: "/api/wallet/credentials/backup/:localId", status: "planned" },
    storeData: { method: "POST", path: "/api/wallet/data/store", status: "planned" },
    listData: { method: "GET", path: "/api/wallet/data/:category", status: "planned" },
    getRecord: { method: "GET", path: "/api/wallet/data/record/:recordId", status: "planned" },
    deleteRecord: { method: "DELETE", path: "/api/wallet/data/record/:recordId", status: "planned" },
    createGrant: { method: "POST", path: "/api/wallet/data/share", status: "planned" },
    redeemGrant: { method: "GET", path: "/api/wallet/share/:grantId", status: "planned" },
    listGrants: { method: "GET", path: "/api/wallet/data/grants", status: "planned" },
    revokeGrant: { method: "DELETE", path: "/api/wallet/data/grants/:grantId", status: "planned" },
  },
  admin: {
    walletUsers: { method: "GET", path: "/api/admin/wallet/users", status: "planned" },
    walletStats: { method: "GET", path: "/api/admin/wallet/stats", status: "planned" },
    wipeWallet: { method: "PUT", path: "/api/admin/wallet/:walletId/wipe", status: "planned" },
    grants: { method: "GET", path: "/api/admin/wallet/grants", status: "planned" },
  },
} as const;
