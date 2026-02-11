import type { ParcelAnalysis, ParcelFeature } from '@/types'
import { getAreaM2 } from './area'
import { classifyParcelEdges } from './classifyEdges'
import { getLotType } from './lotType'

export function formatAddress(props: ParcelFeature['properties']): string {
  const n = props?.civic_number ?? ''
  const s = props?.streetname ?? ''
  return [n, s].filter(Boolean).join(' ').trim() || 'Unknown'
}

/** Run full analysis: edges + lot type + area + address. */
export async function analyzeParcel(
  feature: ParcelFeature,
  mapboxToken: string
): Promise<ParcelAnalysis> {
  const edgeClassification = await classifyParcelEdges(feature, mapboxToken)
  const lotType = getLotType(edgeClassification)
  const address = formatAddress(feature.properties)
  const areaM2 = getAreaM2(feature.geometry)
  const primaryStreet = feature.properties?.streetname ?? ''

  return {
    feature,
    address,
    areaM2,
    primaryStreet,
    lotType,
    edgeClassification,
  }
}
