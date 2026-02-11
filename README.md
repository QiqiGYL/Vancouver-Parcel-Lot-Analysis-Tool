# Vancouver Parcel Lot Analysis Tool

React 18 + TypeScript (strict) + Vite + Mapbox GL JS application for analyzing Vancouver parcel lots: edge classification (Frontage, Flankage, Rear Lane, Rear, Side) and lot type (Corner, Double Fronting, Standard with/without Lane).

## Setup

1. **Node.js**  
   Ensure Node.js 18+ and npm are installed.

2. **Mapbox token**  
   Create a [Mapbox account](https://account.mapbox.com/) and copy your default public token. Create a file `.env` in the project root:

   ```
   VITE_MAPBOX_ACCESS_TOKEN=pk.your_token_here
   ```

   (See `.env.example`.)

3. **Parcel data**  
   Place `property-parcel-polygons.geojson` in the `public/` folder so it is served at `/property-parcel-polygons.geojson`. A copy step is included in the project (e.g. copy from repo root into `public/` if needed).

4. **Install and run**

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:5173.

## Build

```bash
npm run build
npm run preview   # optional: preview production build
```

## Features

- **Map**: Vancouver downtown parcels from Vancouver Open Data (GeoJSON); Mapbox Streets base map. Click a parcel to highlight, fly to it, and run analysis.
- **Address search**: Autocomplete scoped to Vancouver, debounced input, keyboard (arrows, Enter, Esc). Search history when the field is focused and empty, with “Clear history”.
- **Info card**: Address, area (m²), primary street, lot type. Edge legend; selected parcel edges colored on the map (Frontage=blue, Flankage=orange, Rear Lane=purple, Rear=green, Side=gray).
- **Debug mode**: Toggle to show centroid, properties, per-edge table, and frontage-opposite index. Edge numbers on the map are shown only when Debug is on.

## Data and logic

- **Parcel data**: [Vancouver Open Data – Property parcel polygons](https://opendata.vancouver.ca/explore/dataset/property-parcel-polygons) (GeoJSON).
- **Road/lane proximity**: Mapbox Tilequery API (`mapbox.mapbox-streets-v8`) to detect adjacent street/lane and name matching.

### Edge classification

- **Frontage**: One seed = edge whose midpoint is closest to the primary street centerline (name match); then expanded to adjacent name-match edges with angle ≤10° (one run along the street).
- **Flankage**: Edges adjacent to a different street (non-lane); collinear segments (angle ≤10°, same adjacency) form one logical flankage run.
- **Rear Lane / Rear**: Only the edge geometrically opposite the frontage (“B”) can be Rear Lane or Rear. If that edge has >30% of its length adjacent to a lane, it is Rear Lane; else (no road/lane) it is Rear when the parcel has no Flankage. Other lane-adjacent edges stay Side.
- **Side**: All other edges. Collinear segments are grouped by adjacency kind (lane vs street) so we do not merge across lane/street boundaries; each segment keeps its exact boundary geometry and gets the same type as its logical group.

### Lot types (priority order)

- **Corner Lot**: Has Frontage and Flankage (two different streets); Flankage on the side.
- **Double Fronting**: Frontage + opposite side faces a different street (B is Flankage).
- **Standard with Lane**: One Frontage + opposite edge is Rear Lane.
- **Standard without Lane**: One Frontage + opposite edge is Rear (no adjacent lane).
