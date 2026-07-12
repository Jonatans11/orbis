import React from 'react';

import { Badge } from '@/components/Badge';

interface ShareStatusPillProps {
  grantCount: number;
  monetizable?: boolean;
}

/**
 * Trailing consent pill on vault rows (spec 07 §2):
 *   Private (muted) · Shared (success, +count) · Earning (premium).
 */
export function ShareStatusPill({ grantCount, monetizable = false }: ShareStatusPillProps) {
  if (monetizable) return <Badge label="Earning" tone="premium" />;
  if (grantCount > 0) {
    return <Badge label={grantCount > 1 ? `Shared · ${grantCount}` : 'Shared'} tone="success" />;
  }
  return <Badge label="Private" tone="neutral" />;
}
