import type { ParcelEdge, EdgeType, EdgeClassificationResult } from '@/types'
import type { ParcelFeature } from '@/types'
import {
  extractEdgesFromPolygon,
  mergeCollinearEdges,
  angleBetweenVectorsDeg,
  type AdjacencyKind,
} from './edges'
import { streetNamesMatch } from './streetName'
import { tilequeryPoint, isLaneClass, isStreetClass } from './tilequery'
import type { TilequeryFeature } from './tilequery'
import centroid from '@turf/centroid'
import distance from '@turf/distance'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import type { Feature } from 'geojson'

/** Distance in meters from point to road feature (centerline or first coord). */
function distanceToRoadMeters(
  point: [number, number],
  roadFeature: TilequeryFeature
): number {
  const geom = roadFeature.geometry
  const coords = geom?.coordinates as number[] | number[][] | undefined
  if (!coords || coords.length === 0) return Infinity
  const first = coords[0]
  if (typeof first === 'number') {
    const p = [coords[0], (coords as number[])[1]] as [number, number]
    return distance(point, p, { units: 'meters' })
  }
  const positions = coords as [number, number][]
  if (positions.length === 1) {
    return distance(point, positions[0], { units: 'meters' })
  }
  const line: GeoJSON.LineString = { type: 'LineString', coordinates: positions }
  const nearest = nearestPointOnLine(
    { type: 'Feature', geometry: line, properties: {} },
    point
  )
  return distance(point, nearest.geometry.coordinates, { units: 'meters' })
}

/** Get first coordinate from Tilequery feature geometry (point or line) for distance sort. */
function getFirstCoord(f: TilequeryFeature): [number, number] | null {
  const c = f.geometry?.coordinates as number[] | number[][] | undefined
  if (!c || c.length === 0) return null
  const first = c[0]
  if (typeof first === 'number') return [first, (c as number[])[1] as number]
  if (Array.isArray(first) && first.length >= 2) return [first[0] as number, first[1] as number]
  return null
}

/** Sort road features by distance from point so we prefer the nearest (e.g. "edge nearest to Main St"). */
function sortFeaturesByDistanceToPoint(
  features: TilequeryFeature[],
  point: [number, number]
): TilequeryFeature[] {
  return [...features].sort((a, b) => {
    const pa = getFirstCoord(a)
    const pb = getFirstCoord(b)
    if (!pa) return 1
    if (!pb) return -1
    return distance(point, pa, { units: 'meters' }) - distance(point, pb, { units: 'meters' })
  })
}

function vec(x: number, y: number): [number, number] {
  return [x, y]
}
function dot(a: [number, number], b: [number, number]): number {
  return a[0] * b[0] + a[1] * b[1]
}
function normVec(x: number, y: number): [number, number] {
  const len = Math.hypot(x, y)
  return len > 1e-10 ? [x / len, y / len] : [0, 0]
}

/**
 * Edge classification: Frontage first, then lock the "opposite" edge (B), then Side.
 *
 * Frontage: Seed = edge closest to primary street centerline (name match); then expand to adjacent
 *   name-match edges with angle ≤10° (same run along the street, like flankage).
 * Flankage: Edge adjacent to a secondary street (different from primary); e.g. corner lots.
 *
 * Opposite (B): The single edge geometrically opposite the Frontage (other side of
 *   centroid, most parallel). Only B can be Rear Lane / Rear / or remain Flankage:
 *   - B adjacent to lane/alley → Rear Lane
 *   - B adjacent to another street → Flankage (e.g. double fronting)
 *   - B not adjacent to anything → Rear (only when no Flankage on parcel; else B stays Side)
 * Any other edge adjacent to a lane (but not B) is Side, not Rear Lane.
 *
 * Logical grouping only (no geometry merge): Collinear raw edges are grouped into logical edges
 * for classification; each raw segment keeps its exact boundary geometry. We do not merge across
 * adjacency kind (lane vs street): lane-adjacent and street-adjacent segments stay in separate
 * logical edges. >30% lane → Rear Lane.
 *
 * Side: All edges that are not Frontage, not B (or B when B is Side), and not Flankage.
 *
 * Frontage vs Flankage (both adjacent to a street):
 * 1. Frontage is the edge whose adjacent street name matches the parcel's
 *    address (e.g. parcel "123 Main St" → edge nearest to "Main St" is Frontage).
 * 2. Flankage is any edge adjacent to a different street that does not match
 *    the parcel's address; typically on corner lots where the parcel borders
 *    two intersecting streets.
 * 3. In most cases, the Flankage edge (along the lot's depth) is longer than
 *    the Frontage edge (along the lot's width).
 */
export async function classifyParcelEdges(
  feature: ParcelFeature,
  accessToken: string
): Promise<EdgeClassificationResult> {
  const geom = feature.geometry
  const ring = geom.coordinates[0]
  if (!ring || ring.length < 3) {
    return { edges: [], frontageOppositeEdgeIndex: null }
  }

  const parcelStreet = feature.properties?.streetname ?? ''
  const rawEdges = extractEdgesFromPolygon(ring)

  const edgeAdjacent: { isLane: boolean; name: string | null; type: EdgeType }[] = []
  const frontageCandidates: { index: number; distanceMeters: number; adjacentName: string }[] = []

  for (let i = 0; i < rawEdges.length; i++) {
    const e = rawEdges[i]
    const [lon, lat] = e.midPoint
    const res = await tilequeryPoint(lon, lat, accessToken)
    let adjacentName: string | null = null
    let adjacentIsLane = false
    let type: EdgeType = 'side'
    const filtered = (res.features ?? []).filter(
      (f) => f.layer?.id === 'road' || f.properties?.class
    )
    const roadFeatures = sortFeaturesByDistanceToPoint(filtered, e.midPoint)

    // 1. Frontage candidate: name match; record distance to centerline, assign frontage later to closest only
    for (const f of roadFeatures) {
      const name = f.properties?.name ?? null
      if (name && streetNamesMatch(parcelStreet, name)) {
        const distanceMeters = distanceToRoadMeters(e.midPoint, f)
        frontageCandidates.push({ index: i, distanceMeters, adjacentName: name })
        adjacentName = name
        adjacentIsLane = false
        break
      }
    }

    // 2. Flankage: secondary street (different from primary); skip if already primary-street match
    if (type === 'side' && !(adjacentName && streetNamesMatch(parcelStreet, adjacentName))) {
      for (const f of roadFeatures) {
        const name = f.properties?.name ?? null
        const cls = f.properties?.class ?? ''
        if (isLaneClass(cls)) continue
        if (name || isStreetClass(cls)) {
          type = 'flankage'
          adjacentName = name ?? null
          adjacentIsLane = false
          break
        }
      }
    }

    // 3. Lane-adjacent: record only (Rear Lane assigned later only to the "opposite" edge B)
    if (type === 'side' && !(adjacentName && streetNamesMatch(parcelStreet, adjacentName))) {
      for (const f of roadFeatures) {
        const cls = f.properties?.class ?? ''
        const name = f.properties?.name ?? null
        if (isLaneClass(cls)) {
          adjacentName = name ?? 'Lane'
          adjacentIsLane = true
          break
        }
      }
    }

    edgeAdjacent.push({ isLane: adjacentIsLane, name: adjacentName, type })
  }

  // Frontage seed = edge closest to primary street centerline; then expand to collinear (angle ≤10°) name-match neighbors
  const FRONTAGE_COLLINEAR_DEG = 10
  if (frontageCandidates.length > 0) {
    let best = frontageCandidates[0]
    for (let k = 1; k < frontageCandidates.length; k++) {
      if (frontageCandidates[k].distanceMeters < best.distanceMeters) {
        best = frontageCandidates[k]
      }
    }
    const frontageCandidateSet = new Set(frontageCandidates.map((c) => c.index))
    const n = rawEdges.length

    const setFrontage = (idx: number, adjacentName: string) => {
      edgeAdjacent[idx].type = 'frontage'
      edgeAdjacent[idx].name = adjacentName
      edgeAdjacent[idx].isLane = false
    }
    setFrontage(best.index, best.adjacentName)

    const angleBetweenEdges = (i: number, j: number): number => {
      const a = rawEdges[i].segment
      const b = rawEdges[j].segment
      const v1: [number, number] = [a[1][0] - a[0][0], a[1][1] - a[0][1]]
      const v2: [number, number] = [b[1][0] - b[0][0], b[1][1] - b[0][1]]
      return angleBetweenVectorsDeg(v1, v2)
    }

    let j = (best.index - 1 + n) % n
    while (j !== best.index) {
      if (!frontageCandidateSet.has(j)) break
      if (angleBetweenEdges(j, (j + 1) % n) > FRONTAGE_COLLINEAR_DEG) break
      const cand = frontageCandidates.find((c) => c.index === j)
      setFrontage(j, cand?.adjacentName ?? best.adjacentName)
      j = (j - 1 + n) % n
    }

    j = (best.index + 1) % n
    while (j !== best.index) {
      if (!frontageCandidateSet.has(j)) break
      if (angleBetweenEdges((j - 1 + n) % n, j) > FRONTAGE_COLLINEAR_DEG) break
      const cand = frontageCandidates.find((c) => c.index === j)
      setFrontage(j, cand?.adjacentName ?? best.adjacentName)
      j = (j + 1) % n
    }
  }

  const adjacencyKindByIndex: AdjacencyKind[] = edgeAdjacent.map((adj) => {
    if (adj.type === 'frontage') return 'frontage'
    if (adj.type === 'flankage') return 'flankage'
    if (adj.isLane) return 'lane'
    return 'none'
  })
  const mergedEdges = mergeCollinearEdges(rawEdges, adjacencyKindByIndex)

  type MergedAgg = {
    lengthLane: number
    lengthTotal: number
    hasFrontage: boolean
    hasFlankage: boolean
    adjacentName: string | null
    adjacentIsLane: boolean
  }
  const mergedAgg: MergedAgg[] = mergedEdges.map((m) => {
    let lengthLane = 0
    let lengthTotal = 0
    let hasFrontage = false
    let hasFlankage = false
    let adjacentName: string | null = null
    let adjacentIsLane = false
    for (const j of m.subEdgeIndices) {
      const len = rawEdges[j].lengthMeters
      lengthTotal += len
      const adj = edgeAdjacent[j]
      if (adj.isLane) lengthLane += len
      if (adj.type === 'frontage') {
        hasFrontage = true
        if (adjacentName == null) adjacentName = adj.name
      }
      if (adj.type === 'flankage') {
        hasFlankage = true
        if (adjacentName == null) adjacentName = adj.name
      }
      if (adj.isLane && adjacentName == null) adjacentName = adj.name ?? 'Lane'
      if (adj.isLane) adjacentIsLane = true
    }
    return {
      lengthLane,
      lengthTotal,
      hasFrontage,
      hasFlankage,
      adjacentName,
      adjacentIsLane,
    }
  })

  const LANE_FRACTION_FOR_REAR_LANE = 0.3
  const frontageMergedIndices: number[] = []
  for (let i = 0; i < mergedEdges.length; i++) {
    if (mergedAgg[i].hasFrontage) frontageMergedIndices.push(i)
  }
  const flankageCount = mergedAgg.filter((a) => a.hasFlankage).length
  const nonFrontageMergedIndices = mergedEdges
    .map((_, i) => i)
    .filter((i) => !frontageMergedIndices.includes(i))

  const cent = centroid(feature as Feature)
  const centCoord = cent.geometry.coordinates as [number, number]

  let frontageOppositeEdgeIndex: number | null = null
  const mergedTypes: EdgeType[] = mergedEdges.map(() => 'side')
  const mergedAdjacentName: (string | undefined)[] = mergedEdges.map(() => undefined)
  const mergedAdjacentIsLane: (boolean | undefined)[] = mergedEdges.map(() => undefined)

  for (let i = 0; i < mergedEdges.length; i++) {
    const agg = mergedAgg[i]
    if (agg.hasFrontage) {
      mergedTypes[i] = 'frontage'
      mergedAdjacentName[i] = agg.adjacentName ?? undefined
      mergedAdjacentIsLane[i] = false
    } else if (agg.hasFlankage) {
      mergedTypes[i] = 'flankage'
      mergedAdjacentName[i] = agg.adjacentName ?? undefined
      mergedAdjacentIsLane[i] = false
    }
  }

  if (frontageMergedIndices.length >= 1 && nonFrontageMergedIndices.length >= 1) {
    const fi = frontageMergedIndices[0]
    const frontSeg = mergedEdges[fi].segment
    const frontMid = mergedEdges[fi].midPoint
    const frontDir = normVec(frontSeg[1][0] - frontSeg[0][0], frontSeg[1][1] - frontSeg[0][1])
    const toFront = vec(frontMid[0] - centCoord[0], frontMid[1] - centCoord[1])

    let bestBIdx: number | null = null
    let bestParallel = -1

    for (const idx of nonFrontageMergedIndices) {
      const seg = mergedEdges[idx].segment
      const mid = mergedEdges[idx].midPoint
      const edgeDir = normVec(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1])
      const toMid = vec(mid[0] - centCoord[0], mid[1] - centCoord[1])
      const parallelScore = Math.abs(dot(frontDir, edgeDir))
      const onOppositeSide = dot(toMid, toFront) <= 0
      if (onOppositeSide && parallelScore > bestParallel) {
        bestParallel = parallelScore
        bestBIdx = idx
      }
    }

    if (bestBIdx !== null) {
      const agg = mergedAgg[bestBIdx]
      const laneFraction = agg.lengthTotal > 0 ? agg.lengthLane / agg.lengthTotal : 0
      if (laneFraction > LANE_FRACTION_FOR_REAR_LANE) {
        mergedTypes[bestBIdx] = 'rear_lane'
        mergedAdjacentName[bestBIdx] = agg.adjacentName ?? undefined
        mergedAdjacentIsLane[bestBIdx] = true
        frontageOppositeEdgeIndex = mergedEdges[bestBIdx].subEdgeIndices[0]
      } else if (agg.hasFlankage) {
        mergedTypes[bestBIdx] = 'flankage'
        mergedAdjacentName[bestBIdx] = agg.adjacentName ?? undefined
        mergedAdjacentIsLane[bestBIdx] = false
        frontageOppositeEdgeIndex = mergedEdges[bestBIdx].subEdgeIndices[0]
      } else {
        if (flankageCount === 0) {
          mergedTypes[bestBIdx] = 'rear'
          mergedAdjacentName[bestBIdx] = undefined
          mergedAdjacentIsLane[bestBIdx] = undefined
          frontageOppositeEdgeIndex = mergedEdges[bestBIdx].subEdgeIndices[0]
        }
      }
    }
  }

  // Map each raw edge to its logical group (merged edge index)
  const logicalGroupByRawIndex: number[] = Array(rawEdges.length).fill(0)
  for (let j = 0; j < mergedEdges.length; j++) {
    for (const idx of mergedEdges[j].subEdgeIndices) {
      logicalGroupByRawIndex[idx] = j
    }
  }

  // Output raw edges with geometry unchanged; assign type from logical group so collinear segments share one classification
  const edges: ParcelEdge[] = rawEdges.map((e, i) => {
    const j = logicalGroupByRawIndex[i]
    return {
      ...e,
      type: mergedTypes[j],
      adjacentName: mergedAdjacentName[j],
      adjacentIsLane: mergedAdjacentIsLane[j],
    }
  })

  return { edges, frontageOppositeEdgeIndex }
}
