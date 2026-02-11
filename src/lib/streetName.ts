/** Normalize street name for matching (Vancouver style: "E 2ND AV" vs "2nd Avenue"). */
export function normalizeStreetName(name: string): string {
  if (!name || typeof name !== 'string') return ''
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\bAV\b/g, 'AVENUE')
    .replace(/\bST\b/g, 'STREET')
    .replace(/\bDR\b/g, 'DRIVE')
    .replace(/\bBLVD\b/g, 'BOULEVARD')
    .replace(/\bLN\b/g, 'LANE')
    .replace(/\bRD\b/g, 'ROAD')
    .replace(/\bPL\b/g, 'PLACE')
    .replace(/\bCT\b/g, 'COURT')
    .replace(/\bCRES\b/g, 'CRESCENT')
    .replace(/\bHWY\b/g, 'HIGHWAY')
    .replace(/\bN\b/g, 'NORTH')
    .replace(/\bS\b/g, 'SOUTH')
    .replace(/\bE\b/g, 'EAST')
    .replace(/\bW\b/g, 'WEST')
    .replace(/\bAVE\b/g, 'AVENUE')
}

/** Check if two street names match after normalization. */
export function streetNamesMatch(a: string, b: string): boolean {
  const na = normalizeStreetName(a)
  const nb = normalizeStreetName(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}
