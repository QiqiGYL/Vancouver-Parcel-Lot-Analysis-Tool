import { useCallback, useRef, useEffect } from 'react'
import Map, { Source, Layer } from 'react-map-gl'
import type { MapRef } from 'react-map-gl'
import bbox from '@turf/bbox'
import type { ParcelAnalysis, ParcelFeature } from '@/types'
import { edgesToGeoJSON } from '@/lib/edgeGeoJSON'
import 'mapbox-gl/dist/mapbox-gl.css'

const VANCOUVER_CENTER = { longitude: -123.12, latitude: 49.28, zoom: 12 }
const PARCELS_URL = '/property-parcel-polygons.geojson'

const EDGE_COLORS: Record<string, string> = {
  frontage: '#2563eb',
  flankage: '#ea580c',
  rear_lane: '#7800A3',
  rear: '#16a34a',
  side: '#9ca3af',
}

interface MapViewProps {
  mapboxToken: string
  onParcelClick: (feature: ParcelFeature) => void
  selectedAnalysis: ParcelAnalysis | null
  mapRef?: React.MutableRefObject<MapRef | null>
  /** When true, show edge # labels on the map (e.g. in debug mode). */
  showEdgeLabels?: boolean
}

export function MapView({
  mapboxToken,
  onParcelClick,
  selectedAnalysis,
  mapRef: externalMapRef,
  showEdgeLabels = false,
}: MapViewProps) {
  const internalMapRef = useRef<MapRef | null>(null)
  const mapRef = externalMapRef ?? internalMapRef

  const handleClick = useCallback(
    (evt: { point: { x: number; y: number } }) => {
      const map = mapRef.current?.getMap()
      if (!map) return
      const features = map.queryRenderedFeatures(
        [evt.point.x, evt.point.y],
        { layers: ['parcels-fill'] }
      )
      const f = features[0] as unknown as
        | (GeoJSON.Feature<GeoJSON.Polygon> & { properties: ParcelFeature['properties'] })
        | undefined
      if (f?.properties?.site_id && f.geometry?.type === 'Polygon') {
        onParcelClick({
          type: 'Feature',
          geometry: f.geometry,
          properties: f.properties,
        })
      }
    },
    [onParcelClick, mapRef]
  )

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !selectedAnalysis) return
    const b = bbox(selectedAnalysis.feature)
    map.fitBounds(
      [
        [b[0], b[1]],
        [b[2], b[3]],
      ],
      { padding: 60, duration: 800, maxZoom: 18 }
    )
  }, [selectedAnalysis, mapRef])

  const highlightData =
    selectedAnalysis != null
      ? {
        type: 'Feature' as const,
        geometry: selectedAnalysis.feature.geometry,
        properties: {},
      }
      : null

  const edgesData =
    selectedAnalysis != null
      ? edgesToGeoJSON(selectedAnalysis.edgeClassification.edges)
      : null

  const edgeLabelsData =
    selectedAnalysis != null
      ? {
        type: 'FeatureCollection' as const,
        features: selectedAnalysis.edgeClassification.edges.map((e, i) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: e.midPoint,
          },
          properties: { label: String(i) },
        })),
      }
      : null

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={mapboxToken}
      initialViewState={VANCOUVER_CENTER}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      onClick={handleClick}
      interactiveLayerIds={['parcels-fill']}
    >
      <Source id="parcels" type="geojson" data={PARCELS_URL}>
        <Layer
          id="parcels-fill"
          type="fill"
          paint={{
            'fill-color': '#e0e7ff',
            'fill-opacity': 0.5,
            'fill-outline-color': '#4f46e5',
          }}
        />
      </Source>
      {highlightData && (
        <Source id="parcel-highlight" type="geojson" data={highlightData}>
          <Layer
            id="parcel-highlight-fill"
            type="fill"
            paint={{
              'fill-color': '#818cf8',
              'fill-opacity': 0.4,
              'fill-outline-color': '#4338ca',
            }}
          />
        </Source>
      )}
      {edgesData && edgesData.features.length > 0 && (
        <Source id="parcel-edges" type="geojson" data={edgesData}>
          <Layer
            id="parcel-edges-lines"
            type="line"
            paint={{
              'line-width': 4,
              'line-color': [
                'match',
                ['get', 'edgeType'],
                'frontage',
                EDGE_COLORS.frontage,
                'flankage',
                EDGE_COLORS.flankage,
                'rear_lane',
                EDGE_COLORS.rear_lane,
                'rear',
                EDGE_COLORS.rear,
                EDGE_COLORS.side,
              ],
            }}
          />
        </Source>
      )}
      {showEdgeLabels && edgeLabelsData && edgeLabelsData.features.length > 0 && (
        <Source id="parcel-edge-labels" type="geojson" data={edgeLabelsData}>
          <Layer
            id="parcel-edge-labels-text"
            type="symbol"
            layout={{
              'text-field': ['get', 'label'],
              'text-size': 13,
              'text-anchor': 'center',
            }}
            paint={{
              'text-color': 'rgba(0, 0, 0, 0.55)',
              'text-halo-color': 'rgba(255, 255, 255, 0.9)',
              'text-halo-width': 1.5,
            }}
          />
        </Source>
      )}
    </Map>
  )
}
