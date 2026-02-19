import type { LotType, EdgeClassificationResult } from '@/types'

/**
 * Lot types (priority order):
 * - Corner Lot: Frontage + Flankage (two different streets; flankage on the side, not opposite).
 * - Double Fronting: Has 2+ Frontage edges facing different streets (opposite sides both face streets, not lanes).
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

  // Double Fronting: 2+ frontages, and opposite edge is also frontage
  if (frontages.length >= 2 && opposite?.type === 'frontage') {
    return 'double_fronting'
  }
  // Corner Lot: has frontage and flankage (flankage is on the side, not opposite)
  if (frontages.length >= 1 && flankages.length >= 1) {
    return 'corner'
  }
  // Standard with/without lane: 1 frontage, opposite is rear_lane or rear
  if (frontages.length >= 1 && opposite != null) {
    if (opposite.type === 'rear_lane') return 'standard_with_lane'
    if (opposite.type === 'rear') return 'standard_without_lane'
  }
  return 'unclassified'
}
