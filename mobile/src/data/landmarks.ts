// Port of frontend/src/data/mapData.js LANDMARKS. Icons dropped (no emoji in native chrome — §1 anti-pattern).
// Category drives SVG glyph lookup in SearchBar dropdown row.

export type LandmarkCategory =
  | 'shop'
  | 'library'
  | 'school'
  | 'station'
  | 'civic'
  | 'market'
  | 'museum'
  | 'casino'
  | 'historic'
  | 'street'
  | 'food'
  | 'docks'
  | 'post';

export type Landmark = {
  name: string;
  sub: string;
  lat: number;
  lng: number;
  category: LandmarkCategory;
};

export const LANDMARKS: Landmark[] = [
  { name: 'Melbourne Central', sub: 'Cnr La Trobe & Swanston St', lat: -37.8102, lng: 144.9628, category: 'shop' },
  { name: 'State Library Victoria', sub: '328 Swanston St, Melbourne', lat: -37.8098, lng: 144.9652, category: 'library' },
  { name: 'RMIT University', sub: '124 La Trobe St, Melbourne', lat: -37.8083, lng: 144.9632, category: 'school' },
  { name: 'Flinders Street Station', sub: 'Flinders St & Swanston St', lat: -37.8183, lng: 144.9671, category: 'station' },
  { name: 'Federation Square', sub: 'Swanston St & Flinders St', lat: -37.8180, lng: 144.9691, category: 'civic' },
  { name: 'Queen Victoria Market', sub: '513 Elizabeth St, Melbourne', lat: -37.8076, lng: 144.9568, category: 'market' },
  { name: 'Melbourne Museum', sub: '11 Nicholson St, Carlton', lat: -37.8033, lng: 144.9717, category: 'museum' },
  { name: 'Crown Casino', sub: '8 Whiteman St, Southbank', lat: -37.8228, lng: 144.9575, category: 'casino' },
  { name: 'Old Melbourne Gaol', sub: '377 Russell St, Melbourne', lat: -37.8078, lng: 144.9654, category: 'historic' },
  { name: 'Collins Street', sub: 'Collins St, Melbourne CBD', lat: -37.8153, lng: 144.9634, category: 'street' },
  { name: 'Bourke Street Mall', sub: 'Bourke St, Melbourne CBD', lat: -37.8136, lng: 144.9653, category: 'street' },
  { name: 'Elizabeth Street', sub: 'Elizabeth St, Melbourne CBD', lat: -37.8136, lng: 144.9601, category: 'street' },
  { name: 'Swanston Street', sub: 'Swanston St, Melbourne CBD', lat: -37.8136, lng: 144.9663, category: 'street' },
  { name: 'Chinatown Melbourne', sub: 'Little Bourke St, Melbourne', lat: -37.8118, lng: 144.9688, category: 'food' },
  { name: 'Melbourne Town Hall', sub: '90–120 Swanston St', lat: -37.8148, lng: 144.9665, category: 'civic' },
  { name: 'Emporium Melbourne', sub: '287 Lonsdale St', lat: -37.8120, lng: 144.9644, category: 'shop' },
  { name: 'Docklands', sub: 'Harbour Esplanade, Docklands', lat: -37.8157, lng: 144.9397, category: 'docks' },
  { name: 'GPO Melbourne', sub: '350 Bourke St, Melbourne', lat: -37.8131, lng: 144.9636, category: 'post' },
];
