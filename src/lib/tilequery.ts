/** Mapbox Tilequery API response feature (road layer). */
export interface TilequeryFeature {
  type: 'Feature'
  geometry: { type: string; coordinates: number[] }
  properties: {
    name?: string | null
    class?: string
    type?: string
    [key: string]: unknown
  }
  layer: { id: string }
}

export interface TilequeryResponse {
  type: 'FeatureCollection'
  features: TilequeryFeature[]
}

const TILEQUERY_RADIUS_M = 25
const TILESET = 'mapbox.mapbox-streets-v8'

/** Query Mapbox Tilequery for road/lane features near a point. */
export async function tilequeryPoint(
  lon: number,
  lat: number,
  accessToken: string
): Promise<TilequeryResponse> {
  const url = new URL(
    `https://api.mapbox.com/v4/${TILESET}/tilequery/${lon},${lat}.json`
  )
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('radius', String(TILEQUERY_RADIUS_M))
  url.searchParams.set('geometry', 'linestring')
  url.searchParams.set('limit', '10')
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Tilequery failed: ${res.status}`)
  return res.json() as Promise<TilequeryResponse>
}

/** Heuristic: Mapbox road class that we treat as lane/alley (service, etc.). */
export function isLaneClass(roadClass: string | undefined): boolean {
  if (!roadClass) return false
  const c = roadClass.toLowerCase()
  return c === 'service' || c === 'lane' || c === 'path' || c === 'track'
}

/** Mapbox road class for main streets (non-lane). Used for Flankage / "other street" detection. */
export function isStreetClass(roadClass: string | undefined): boolean {
  if (!roadClass) return false
  const c = roadClass.toLowerCase()
  return ['street', 'primary', 'secondary', 'tertiary', 'motorway', 'trunk'].includes(c)
}
