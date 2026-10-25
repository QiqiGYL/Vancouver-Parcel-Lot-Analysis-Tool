/* cf-build-marker: 2026-10-25-v3 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapView } from '@/components/MapView'
import { AddressSearch, type AddressCandidate } from '@/components/AddressSearch'
import { InfoCard } from '@/components/InfoCard'
import { DebugPanel } from '@/components/DebugPanel'
import { useDebounce } from '@/hooks/useDebounce'
import { analyzeParcel } from '@/lib/analyze'
import type { ParcelFeature, ParcelAnalysis } from '@/types'

const DEFAULT_PARCELS_URL =
  'https://raw.githubusercontent.com/QiqiGYL/Vancouver-Parcel-Lot-Analysis-Tool/main/property-parcel-polygons.geojson'
const PARCELS_URL = import.meta.env.VITE_PARCELS_URL || DEFAULT_PARCELS_URL

function buildAddress(s: string, n: string): string {
  return [n, s].filter(Boolean).join(' ').trim()
}

export default function App() {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? ''
  const [parcelIndex, setParcelIndex] = useState<Map<string, ParcelFeature>>(new Map())
  const [addressList, setAddressList] = useState<{ address: string; siteId: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [selectedAnalysis, setSelectedAnalysis] = useState<ParcelAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const mapRef = useRef<import('react-map-gl').MapRef | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetch(PARCELS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((fc: GeoJSON.FeatureCollection<GeoJSON.Polygon>) => {
        if (cancelled) return
        const index = new Map<string, ParcelFeature>()
        const list: { address: string; siteId: string }[] = []
        for (const f of fc.features ?? []) {
          const props = f.properties as ParcelFeature['properties'] | undefined
          if (!props?.site_id || f.geometry?.type !== 'Polygon') continue
          const feat: ParcelFeature = {
            type: 'Feature',
            geometry: f.geometry,
            properties: props,
          }
          index.set(props.site_id, feat)
          list.push({
            address: buildAddress(props.streetname ?? '', props.civic_number ?? ''),
            siteId: props.site_id,
          })
        }
        setParcelIndex(index)
        setAddressList(list)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const candidates: AddressCandidate[] = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    const q = debouncedQuery.trim().toLowerCase()
    const matches = addressList.filter(
      (a) =>
        a.address.toLowerCase().includes(q) || a.siteId.toLowerCase().includes(q)
    )
    return matches.slice(0, 50).map((a) => {
      const f = parcelIndex.get(a.siteId)
      return f ? { address: a.address, siteId: a.siteId, feature: f } : null
    }).filter((c): c is AddressCandidate => c != null)
  }, [debouncedQuery, addressList, parcelIndex])

  const getFeatureBySiteId = useCallback(
    (siteId: string) => parcelIndex.get(siteId) ?? null,
    [parcelIndex]
  )

  const handleParcelSelect = useCallback(
    async (feature: ParcelFeature) => {
      if (!token) {
        setSelectedAnalysis(null)
        return
      }
      setAnalyzing(true)
      setSelectedAnalysis(null)
      try {
        const analysis = await analyzeParcel(feature, token)
        setSelectedAnalysis(analysis)
      } catch (e) {
        console.error(e)
      } finally {
        setAnalyzing(false)
      }
    },
    [token]
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Vancouver Parcel Lot Analysis</h1>
        <div className="app-search-wrap">
          <AddressSearch
            query={query}
            onQueryChange={setQuery}
            candidates={candidates}
            onSelect={handleParcelSelect}
            getFeatureBySiteId={getFeatureBySiteId}
          />
        </div>
        <div className="app-actions">
          <button
            type="button"
            className="debug-toggle"
            onClick={() => setDebugOpen((v) => !v)}
            aria-pressed={debugOpen}
          >
            {debugOpen ? 'Hide Debug' : 'Debug'}
          </button>
        </div>
      </header>
      <div className="app-main">
        <div className="app-map-wrap">
          {loadError && (
            <div className="app-error">
              Failed to load parcel data: {loadError}. Check VITE_PARCELS_URL or network access to the GeoJSON.
            </div>
          )}
          {loading && <div className="app-loading">Loading parcels...</div>}
          {token ? (
            <MapView
              mapboxToken={token}
              onParcelClick={handleParcelSelect}
              selectedAnalysis={selectedAnalysis}
              mapRef={mapRef}
              showEdgeLabels={debugOpen}
            />
          ) : (
            <div className="app-error">
              Set VITE_MAPBOX_ACCESS_TOKEN in .env (see .env.example).
            </div>
          )}
        </div>
        <aside className="app-sidebar">
          {analyzing && <p className="app-analyzing">Analyzing...</p>}
          {selectedAnalysis && !analyzing && <InfoCard analysis={selectedAnalysis} />}
          {debugOpen && <DebugPanel analysis={selectedAnalysis} />}
        </aside>
      </div>
    </div>
  )
}
