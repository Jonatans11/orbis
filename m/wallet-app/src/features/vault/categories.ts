/** Vault category definitions (spec 07 §1.4). Identity renders as a full-width row. */
import type { Ionicons } from '@expo/vector-icons';

import type { VaultCategoryId } from '@/services/walletApi';

export interface VaultCategoryDef {
  id: VaultCategoryId;
  label: string;
  /** Ionicons stand-in for the design-system SVG (heart-pulse, bank-card, vault, folder, id-card). */
  icon: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
}

export const CATEGORY_DEFS: VaultCategoryDef[] = [
  { id: 'medical', label: 'Medical', icon: 'pulse' },
  { id: 'financial', label: 'Financial', icon: 'card' },
  { id: 'assets', label: 'Assets', icon: 'diamond' },
  { id: 'documents', label: 'Documents', icon: 'folder' },
  { id: 'identity', label: 'Identity', icon: 'id-card', fullWidth: true },
];

export function categoryDef(id: string): VaultCategoryDef {
  return (
    CATEGORY_DEFS.find((c) => c.id === id) ?? {
      id: 'documents',
      label: 'Documents',
      icon: 'folder',
    }
  );
}
