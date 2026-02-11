import type { Feature, Polygon } from 'geojson'

/** Vancouver parcel GeoJSON feature properties */
export interface ParcelProperties {
  civic_number: string
  streetname: string
  tax_coord: string
  site_id: string
  geo_point_2d: { lon: number; lat: number }
}

export type ParcelFeature = Feature<Polygon, ParcelProperties>

/** Edge classification types */
export type EdgeType = 'frontage' | 'flankage' | 'rear_lane' | 'rear' | 'side'

/** Lot types (priority order: corner > double fronting > standard with lane > standard without lane) */
export type LotType =
  | 'corner'
  | 'double_fronting'
  | 'standard_with_lane'
  | 'standard_without_lane'
  | 'unclassified'

/** Single polygon edge: segment from vertex i to i+1 */
export interface ParcelEdge {
  index: number
  segment: [[number, number], [number, number]]
  midPoint: [number, number]
  lengthMeters: number
  type: EdgeType
  /** Road/lane name from proximity query (if adjacent to street or lane) */
  adjacentName?: string
  /** Whether adjacent feature is a lane (vs street) */
  adjacentIsLane?: boolean
}

/** Result of edge classification for one parcel */
export interface EdgeClassificationResult {
  edges: ParcelEdge[]
  /** Index of the edge opposite to frontage (for Rear) */
  frontageOppositeEdgeIndex: number | null
}

/** Full analysis result for a selected parcel */
export interface ParcelAnalysis {
  feature: ParcelFeature
  address: string
  areaM2: number
  primaryStreet: string
  lotType: LotType
  edgeClassification: EdgeClassificationResult
}

/** Search history item: address + site_id for fly-to */
export interface SearchHistoryItem {
  address: string
  siteId: string
  timestamp: number
}
