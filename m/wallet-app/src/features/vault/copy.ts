/**
 * Vault & consent copy — verbatim from spec 07 §7 (cross-cutting states & copy)
 * plus mandated strings from §1–§6. Copy rules (§6): verbs are "request
 * compensation", statuses are "pending"; NEVER "earned/paid/balance" until
 * money actually moves.
 */

export const vaultCopy = {
  encryptedPill: 'End-to-end encrypted',
  encryptedInfo:
    "Records are encrypted on your device. ORBIS stores only ciphertext — we can't read your data. Only titles are visible to keep lists fast.",
  titleHelper: 'Visible to ORBIS servers — keep personal details out of the title.',
  quotaWarning: (pct: number) => `Your vault is ${pct}% full`,
  quotaExceeded: 'Your vault is full (50 MB). Delete something or upgrade later.',
  blobTooLarge: 'Files up to 512 KB in this version',
  activeSharesEmpty: 'Nothing is shared right now. Your data is private.',
  compensationLabel: 'Requested compensation',
  compensationCaption: 'Pending — payouts arrive when payments launch',
  compensationFooter: 'Payout setup will appear here when payments launch.',
} as const;

export const shareCopy = {
  whoUnverified: "This recipient isn't verified. Make sure you know them.",
  whoNoKeyAgreement: "This recipient's ID can't receive encrypted shares.",
  scopeFull: 'Everything in this record',
  scopeFullCaption: 'They can view the full contents.',
  scopeMeta: 'Title & type only',
  scopeMetaCaption: "They see that this record exists — not what's inside.",
  scopeV2Note: 'Sharing specific fields is coming soon.',
  durationRevocable: 'You can revoke access at any time — even before it expires.',
  pricePending:
    "Payments aren't live yet. The amount is recorded with this share and payable when payouts launch.",
  linkLockedTo: (recipient: string) =>
    `Only ${recipient} can open this link — it's locked to their ID.`,
} as const;

export const grantCopy = {
  revokeConfirm: (who: string) => `Revoke access for ${who}? They lose access immediately.`,
  expiredGrantee: (owner: string) => `This share has expired. Ask ${owner} to share again.`,
  revokedGrantee: 'The owner revoked this share.',
  didMismatch: 'This share is locked to a different ID.',
  accessLogFooter: 'Every access is logged and visible only to you.',
  privateRecord: 'Private — only you can see this.',
} as const;

export const recordCopy = {
  deleteConfirm: 'Deletes this record and revokes all its shares immediately.',
  exportWarning: 'Exports leave ORBIS encryption',
  decryptFailed: "Couldn't unlock this record on this device",
  monetizeToggle: 'Allow paid access requests',
} as const;

export const monetizeCopy = {
  explainer:
    'You own your data. Monetization lets you request payment when someone asks for access. Nothing is ever shared without your explicit approval of who, what, how long, and price — and you can revoke any time. Payments launch soon; until then amounts are recorded with each share.',
  turnOn: 'Turn on',
  notNow: 'Not now',
} as const;
