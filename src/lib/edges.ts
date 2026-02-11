import type { ParcelEdge } from '@/types'
import type { Position } from 'geojson'

/** Approximate length in meters between two lon/lat points. */
function lengthMetersBetween(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLon = ((b[0] - a[0]) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a[1] * Math.PI) / 180) *
    Math.cos((b[1] * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

/** Extract edges from polygon outer ring (coordinates[0]). */
export function extractEdgesFromPolygon(
  ring: Position[]
): Omit<ParcelEdge, 'type' | 'adjacentName' | 'adjacentIsLane'>[] {
  const edges: Omit<ParcelEdge, 'type' | 'adjacentName' | 'adjacentIsLane'>[] = []
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i] as [number, number]
    const b = ring[i + 1] as [number, number]
    const midPoint: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const lengthMeters = lengthMetersBetween(a, b)
    edges.push({
      index: i,
      segment: [a, b],
      midPoint,
      lengthMeters,
    })
  }
  return edges
}

/** Merge when angle between consecutive edge vectors <= this (same direction = straight). */
const COLLINEAR_ANGLE_DEG_MAX = 10

/** Angle in degrees between two 2D vectors (0–180). Exported for frontage expansion. */
export function angleBetweenVectorsDeg(
  v1: [number, number],
  v2: [number, number]
): number {
  const len1 = Math.hypot(v1[0], v1[1])
  const len2 = Math.hypot(v2[0], v2[1])
  if (len1 < 1e-10 || len2 < 1e-10) return 0
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (len1 * len2)
  const clamped = Math.max(-1, Math.min(1, cos))
  return (Math.acos(clamped) * 180) / Math.PI
}

/**
 * Adjacency kind for "don't merge across lane/street" boundary.
 * When provided, consecutive edges with different kinds are not merged.
 */
export type AdjacencyKind = 'frontage' | 'flankage' | 'lane' | 'none'

/**
 * Merge consecutive edges that are collinear (angle ≤ 10°) and, when adjacencyKindByIndex
 * is provided, have the same adjacency kind (so we don't merge lane segments with street segments).
 */
export interface MergedEdge {
  index: number
  segment: [[number, number], [number, number]]
  midPoint: [number, number]
  lengthMeters: number
  subEdgeIndices: number[]
}

export function mergeCollinearEdges(
  rawEdges: Omit<ParcelEdge, 'type' | 'adjacentName' | 'adjacentIsLane'>[],
  adjacencyKindByIndex?: AdjacencyKind[]
): MergedEdge[] {
  if (rawEdges.length === 0) return []
  if (rawEdges.length === 1) {
    const e = rawEdges[0]
    return [
      {
        index: 0,
        segment: e.segment,
        midPoint: e.midPoint,
        lengthMeters: e.lengthMeters,
        subEdgeIndices: [e.index],
      },
    ]
  }

  const groups: number[][] = []
  let current: number[] = [0]

  for (let i = 1; i < rawEdges.length; i++) {
    const prev = rawEdges[i - 1]
    const curr = rawEdges[i]
    const v1: [number, number] = [
      prev.segment[1][0] - prev.segment[0][0],
      prev.segment[1][1] - prev.segment[0][1],
    ]
    const v2: [number, number] = [
      curr.segment[1][0] - curr.segment[0][0],
      curr.segment[1][1] - curr.segment[0][1],
    ]
    const angleDeg = angleBetweenVectorsDeg(v1, v2)
    const sameKind =
      !adjacencyKindByIndex ||
      adjacencyKindByIndex[i] === adjacencyKindByIndex[i - 1]
    if (angleDeg <= COLLINEAR_ANGLE_DEG_MAX && sameKind) {
      current.push(i)
    } else {
      groups.push(current)
      current = [i]
    }
  }
  groups.push(current)

  return groups.map((indices, gi) => {
    const first = rawEdges[indices[0]]
    const last = rawEdges[indices[indices.length - 1]]
    const segment: [[number, number], [number, number]] = [
      first.segment[0],
      last.segment[1],
    ]
    const midPoint: [number, number] = [
      (segment[0][0] + segment[1][0]) / 2,
      (segment[0][1] + segment[1][1]) / 2,
    ]
    const lengthMeters = indices.reduce(
      (sum, j) => sum + rawEdges[j].lengthMeters,
      0
    )
    return {
      index: gi,
      segment,
      midPoint,
      lengthMeters,
      subEdgeIndices: indices.map((j) => rawEdges[j].index),
    }
  })
}

export { lengthMetersBetween as lengthMeters }
