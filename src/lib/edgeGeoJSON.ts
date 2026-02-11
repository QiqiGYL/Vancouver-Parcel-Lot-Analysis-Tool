import type { ParcelEdge } from '@/types'
import type { FeatureCollection, LineString } from 'geojson'

export function edgesToGeoJSON(edges: ParcelEdge[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: edges.map((e) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [e.segment[0], e.segment[1]],
      },
      properties: { edgeType: e.type },
    })),
  }
}
