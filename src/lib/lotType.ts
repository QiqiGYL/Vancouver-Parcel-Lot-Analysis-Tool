import type { LotType, EdgeClassificationResult } from '@/types'

/**
 * Lot types (priority order):
 * - Corner Lot: Frontage + Flankage (two different streets; flankage on the side, not opposite).
 * - Double Fronting: Frontage + opposite side faces a different street (not lane).
 * - Standard with Lane: 1 Frontage + Rear Lane on opposite side.
 * - Standard without Lane: 1 Frontage + Rear on opposite side (no adjacent lane).
 */
export function getLotType(
  edgeClassification: EdgeClassificationResult
): LotType {
  const { edges, frontageOppositeEdgeIndex } = edgeClassification
  const frontages = edges.filter((e) => e.type === 'frontage')
  const flankages = edges.filter((e) => e.type === 'flankage')
  const opposite =
    frontageOppositeEdgeIndex != null ? edges[frontageOppositeEdgeIndex] : null

  if (frontages.length >= 1 && flankages.length >= 1) {
    if (opposite?.type === 'flankage') return 'double_fronting'
    return 'corner'
  }
  if (frontages.length >= 1 && opposite != null) {
    if (opposite.type === 'rear_lane') return 'standard_with_lane'
    if (opposite.type === 'rear') return 'standard_without_lane'
  }
  return 'unclassified'
}
