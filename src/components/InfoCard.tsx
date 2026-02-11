import type { ParcelAnalysis, LotType } from '@/types'

const LOT_TYPE_LABELS: Record<LotType, string> = {
  corner: 'Corner Lot',
  double_fronting: 'Double Fronting',
  standard_with_lane: 'Standard with Lane',
  standard_without_lane: 'Standard without Lane',
  unclassified: 'Unclassified',
}

interface InfoCardProps {
  analysis: ParcelAnalysis
}

export function InfoCard({ analysis }: InfoCardProps) {
  const { address, areaM2, primaryStreet, lotType } = analysis
  const label = LOT_TYPE_LABELS[lotType]

  return (
    <div className="info-card">
      <h3 className="info-card-title">Parcel</h3>
      <dl className="info-card-list">
        <dt>Address</dt>
        <dd>{address}</dd>
        <dt>Area</dt>
        <dd>{areaM2.toFixed(1)} m²</dd>
        <dt>Primary street</dt>
        <dd>{primaryStreet}</dd>
        <dt>Lot type</dt>
        <dd>
          <span className="info-card-lot-type" data-lot-type={lotType}>
            {label}
          </span>
        </dd>
      </dl>
      <div className="info-card-legend">
        <span className="legend-item" style={{ color: '#2563eb' }}>Frontage</span>
        <span className="legend-item" style={{ color: '#ea580c' }}>Flankage</span>
        <span className="legend-item" style={{ color: '#7800A3' }}>Rear Lane</span>
        <span className="legend-item" style={{ color: '#16a34a' }}>Rear</span>
        <span className="legend-item" style={{ color: '#9ca3af' }}>Side</span>
      </div>
    </div>
  )
}
