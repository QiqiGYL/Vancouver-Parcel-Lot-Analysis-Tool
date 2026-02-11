import type { ParcelAnalysis } from '@/types'
import centroid from '@turf/centroid'
import type { Feature } from 'geojson'

interface DebugPanelProps {
  analysis: ParcelAnalysis | null
}

export function DebugPanel({ analysis }: DebugPanelProps) {
  if (!analysis) {
    return (
      <div className="debug-panel">
        <p>Select a parcel to see debug info.</p>
      </div>
    )
  }

  const cent = centroid(analysis.feature as Feature)
  const [lon, lat] = cent.geometry.coordinates
  const { edgeClassification, feature } = analysis

  const props = feature.properties ?? {}
  let geoPointDisplay: unknown = props.geo_point_2d
  if (typeof props.geo_point_2d === 'string') {
    try {
      geoPointDisplay = JSON.parse(props.geo_point_2d) as { lon?: number; lat?: number }
    } catch {
      // leave as raw string if not valid JSON
    }
  }
  const displayProps = { ...props, geo_point_2d: geoPointDisplay }

  return (
    <div className="debug-panel">
      <h4>Debug</h4>
      <section>
        <h5>Centroid</h5>
        <pre>{`lon: ${lon}\nlat: ${lat}`}</pre>
      </section>
      <section>
        <h5>Properties</h5>
        <pre>{JSON.stringify(displayProps, null, 2)}</pre>
      </section>
      <section>
        <h5>Edges</h5>
        <table className="debug-edges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Midpoint</th>
              <th>Adjacent</th>
              <th>Lane?</th>
            </tr>
          </thead>
          <tbody>
            {edgeClassification.edges.map((e, i) => (
              <tr key={e.index}>
                <td>{i}</td>
                <td>{e.type}</td>
                <td>{e.midPoint.map((n) => n.toFixed(5)).join(', ')}</td>
                <td>{e.adjacentName ?? '—'}</td>
                <td>{e.adjacentIsLane ? 'yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h5>Frontage opposite edge index</h5>
        <pre>{String(edgeClassification.frontageOppositeEdgeIndex)}</pre>
      </section>
    </div>
  )
}
