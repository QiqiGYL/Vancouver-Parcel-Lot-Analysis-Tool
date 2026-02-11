import area from '@turf/area'
import type { Polygon } from 'geojson'

/** Area of polygon in square meters (Turf uses WGS84, returns m²). */
export function getAreaM2(polygon: Polygon): number {
  return area(polygon)
}
