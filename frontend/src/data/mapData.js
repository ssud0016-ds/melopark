// src/data/mapData.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for MeloPark data.
// Bays use normalised (0–1) x/y coords matching the canvas grid.
// ─────────────────────────────────────────────────────────────────────────────

// US2: Landmark database for autocomplete search
export const LANDMARKS = [
  { name: 'Melbourne Central',       sub: 'Cnr La Trobe & Swanston St',   icon: '🛍️', x: 0.63, y: 0.50, lat: -37.8102, lng: 144.9628 },
  { name: 'State Library Victoria',  sub: '328 Swanston St, Melbourne',   icon: '📚', x: 0.63, y: 0.48, lat: -37.8098, lng: 144.9652 },
  { name: 'RMIT University',         sub: '124 La Trobe St, Melbourne',   icon: '🎓', x: 0.55, y: 0.42, lat: -37.8083, lng: 144.9632 },
  { name: 'Flinders Street Station', sub: 'Flinders St & Swanston St',    icon: '🚉', x: 0.63, y: 0.84, lat: -37.8183, lng: 144.9671 },
  { name: 'Federation Square',       sub: 'Swanston St & Flinders St',    icon: '🏛️', x: 0.65, y: 0.83, lat: -37.8180, lng: 144.9691 },
  { name: 'Queen Victoria Market',   sub: '513 Elizabeth St, Melbourne',  icon: '🛒', x: 0.50, y: 0.22, lat: -37.8076, lng: 144.9568 },
  { name: 'Melbourne Museum',        sub: '11 Nicholson St, Carlton',     icon: '🏛️', x: 0.70, y: 0.12, lat: -37.8033, lng: 144.9717 },
  { name: 'Crown Casino',            sub: '8 Whiteman St, Southbank',     icon: '🎰', x: 0.45, y: 0.94, lat: -37.8228, lng: 144.9575 },
  { name: 'Old Melbourne Gaol',      sub: '377 Russell St, Melbourne',    icon: '🏚️', x: 0.78, y: 0.42, lat: -37.8078, lng: 144.9654 },
  { name: 'Collins Street',          sub: 'Collins St, Melbourne CBD',    icon: '📍', x: 0.50, y: 0.62, lat: -37.8153, lng: 144.9634 },
  { name: 'Bourke Street Mall',      sub: 'Bourke St, Melbourne CBD',     icon: '📍', x: 0.50, y: 0.55, lat: -37.8136, lng: 144.9653 },
  { name: 'Elizabeth Street',        sub: 'Elizabeth St, Melbourne CBD',  icon: '📍', x: 0.50, y: 0.50, lat: -37.8136, lng: 144.9601 },
  { name: 'Swanston Street',         sub: 'Swanston St, Melbourne CBD',   icon: '📍', x: 0.63, y: 0.50, lat: -37.8136, lng: 144.9663 },
  { name: 'Chinatown Melbourne',     sub: 'Little Bourke St, Melbourne',  icon: '🏮', x: 0.72, y: 0.55, lat: -37.8118, lng: 144.9688 },
  { name: 'Melbourne Town Hall',     sub: '90–120 Swanston St',           icon: '🏛️', x: 0.63, y: 0.60, lat: -37.8148, lng: 144.9665 },
  { name: 'Emporium Melbourne',      sub: '287 Lonsdale St',              icon: '🛍️', x: 0.55, y: 0.50, lat: -37.8120, lng: 144.9644 },
  { name: 'Docklands',               sub: 'Harbour Esplanade, Docklands', icon: '⛵', x: 0.10, y: 0.65, lat: -37.8157, lng: 144.9397 },
  { name: 'GPO Melbourne',           sub: '350 Bourke St, Melbourne',     icon: '📮', x: 0.50, y: 0.55, lat: -37.8131, lng: 144.9636 },
];

// US1 + US2: Bay data – all fields required by ACs
// type: 'available' | 'trap' | 'occupied'
// limitType: '2p' | '3p' | '4p' (for filter chips)
// spots / free: for the availability count marker
// warn: clearway / rule trap warning shown in detail panel
export const INITIAL_BAYS = [
  {
    id: '2313', name: 'Flinders Lane',
    type: 'available', limitType: '2p',
    desc: 'Park here up to 2 hours. $3.70/hr. Window expires 4:15 today.',
    tags: ['$3.70/hr', '2P', '3 min walk'],
    safe: 'Until 4:15 PM', limit: '2 Hours', cost: '$3.70/hr',
    applies: 'Mon–Fri 8AM–6PM',
    x: 0.52, y: 0.68, spots: 5, free: 3, warn: null,
    timeline: [
      { time: 'Now – 2:00 PM',     desc: 'Travel time to bay',   on: true  },
      { time: '2:00 – 4:15 PM',    desc: 'Parking window open',  on: false },
      { time: '4:15 PM',           desc: 'Parking ends',         on: false },
      { time: '6:00 PM',           desc: 'Free parking begins',  on: false },
    ],
  },
  {
    id: '0934', name: 'Collins St (E)',
    type: 'trap', limitType: '2p',
    desc: 'Available now but clearway starts 5:30 – only 1h 42m usable.',
    tags: ['$4.00/hr', '2P', '5 min walk'],
    safe: 'Until 5:30 PM', limit: '1h 42m usable', cost: '$4.00/hr',
    applies: 'Mon–Fri, all day',
    x: 0.38, y: 0.55, spots: 4, free: 2,
    warn: 'Clearway begins at 5:30PM – move your car or risk a $350 fine.',
    timeline: [
      { time: 'Now – 3:48 PM',     desc: 'Safe to park',         on: true  },
      { time: '5:30 PM',           desc: 'Clearway begins',      on: false },
      { time: '6:00 PM',           desc: 'Free parking begins',  on: false },
    ],
  },
  {
    id: '1092', name: 'Swanston St',
    type: 'available', limitType: '4p',
    desc: '4-hour bay. $2.50/hr. Good availability near State Library.',
    tags: ['$2.50/hr', '4P', '3 min walk'],
    safe: 'Until 6:00 PM', limit: '4 Hours', cost: '$2.50/hr',
    applies: 'Mon–Fri 8AM–6PM',
    x: 0.45, y: 0.72, spots: 6, free: 4, warn: null,
    timeline: [
      { time: 'Now – 2:00 PM',     desc: 'Travel time to bay',   on: true  },
      { time: '2:00 – 6:00 PM',    desc: 'Parking window open',  on: false },
      { time: '6:00 PM',           desc: 'Free parking begins',  on: false },
    ],
  },
  {
    id: '2057', name: 'Elizabeth St',
    type: 'available', limitType: '2p',
    desc: '2-hour bay, meter payment. Central CBD location.',
    tags: ['$3.70/hr', '2P', '4 min walk'],
    safe: 'Until 4:30 PM', limit: '2 Hours', cost: '$3.70/hr',
    applies: 'Mon–Fri 8AM–6PM',
    x: 0.30, y: 0.60, spots: 3, free: 1, warn: null,
    timeline: [
      { time: 'Now – 2:30 PM',     desc: 'Travel time to bay',   on: true  },
      { time: '2:30 – 4:30 PM',    desc: 'Parking window open',  on: false },
      { time: '4:30 PM',           desc: 'Parking ends',         on: false },
    ],
  },
  {
    id: '3124', name: 'Lonsdale St',
    type: 'available', limitType: '3p',
    desc: '3-hour bay. Free parking after 6PM.',
    tags: ['$2.50/hr', '3P', '6 min walk'],
    safe: 'Until 6:00 PM', limit: '3 Hours', cost: '$2.50/hr',
    applies: 'Mon–Fri 8AM–6PM',
    x: 0.60, y: 0.42, spots: 4, free: 4, warn: null,
    timeline: [
      { time: 'Now – 6:00 PM',     desc: 'Timed parking',        on: true  },
      { time: '6:00 PM',           desc: 'Free parking begins',  on: false },
    ],
  },
  {
    id: '0781', name: 'La Trobe St',
    type: 'trap', limitType: '2p',
    desc: 'Loading zone 7–10AM. Currently available – check signage.',
    tags: ['Free', '2P', '8 min walk'],
    safe: 'Now until 7AM', limit: 'Overnight only', cost: 'Free after 6PM',
    applies: 'Complex – see sign',
    x: 0.55, y: 0.30, spots: 2, free: 1,
    warn: 'Loading zone applies 7–10AM weekdays. Do not park overnight.',
    timeline: [
      { time: 'Now – 7:00 AM',     desc: 'Overnight parking OK', on: true  },
      { time: '7:00 – 10:00 AM',   desc: 'Loading zone – clear', on: false },
      { time: '10:00 AM',          desc: 'Normal parking resumes',on: false },
    ],
  },
  {
    id: '4013', name: 'Bourke St',
    type: 'available', limitType: '3p',
    desc: '3-hour spot. Pay-by-phone or card.',
    tags: ['$4.50/hr', '3P', '2 min walk'],
    safe: 'Until 4:00 PM', limit: '3 Hours', cost: '$4.50/hr',
    applies: 'Mon–Sat 8AM–6PM',
    x: 0.42, y: 0.62, spots: 5, free: 2, warn: null,
    timeline: [
      { time: 'Now – 4:00 PM',     desc: 'Parking window open',  on: true  },
      { time: '4:00 PM',           desc: 'Parking ends',         on: false },
      { time: '6:00 PM',           desc: 'Free parking begins',  on: false },
    ],
  },
  {
    id: '1884', name: 'Little Collins St',
    type: 'available', limitType: '2p',
    desc: '2-hour bay. Good turnover in this block.',
    tags: ['$3.00/hr', '2P', '2 min walk'],
    safe: 'Until 5:30 PM', limit: '2 Hours', cost: '$3.00/hr',
    applies: 'Mon–Fri 8AM–6PM',
    x: 0.35, y: 0.65, spots: 3, free: 3, warn: null,
    timeline: [
      { time: 'Now – 5:30 PM',     desc: 'Parking window open',  on: true  },
      { time: '5:30 PM',           desc: 'Parking ends',         on: false },
      { time: '6:00 PM',           desc: 'Free parking begins',  on: false },
    ],
  },
  {
    id: '2906', name: 'Russell St',
    type: 'available', limitType: '4p',
    desc: '4-hour limit. Quiet side street, usually a space free.',
    tags: ['$3.00/hr', '4P', '7 min walk'],
    safe: 'Until 5:00 PM', limit: '4 Hours', cost: '$3.00/hr',
    applies: 'Mon–Fri 8AM–6PM',
    x: 0.72, y: 0.58, spots: 6, free: 5, warn: null,
    timeline: [
      { time: 'Now – 5:00 PM',     desc: 'Parking window open',  on: true  },
      { time: '5:00 PM',           desc: 'Parking ends',         on: false },
      { time: '6:00 PM',           desc: 'Free parking begins',  on: false },
    ],
  },
];

// Map geometry – streets and city blocks
export const MAP_STREETS = [
  { x1:0, y1:0.20, x2:1, y2:0.20, w:20, c:'#e2e4e0', label:'Victoria St' },
  { x1:0, y1:0.36, x2:1, y2:0.36, w:14, c:'#e8eae6', label:'Therry St'   },
  { x1:0, y1:0.50, x2:1, y2:0.50, w:16, c:'#e4e6e2', label:'La Trobe St' },
  { x1:0, y1:0.62, x2:1, y2:0.62, w:18, c:'#dcdeda', label:'Collins St'  },
  { x1:0, y1:0.72, x2:1, y2:0.72, w:14, c:'#e8eae6', label:'Flinders Ln' },
  { x1:0, y1:0.84, x2:1, y2:0.84, w:20, c:'#e2e4e0', label:'Flinders St' },
  { x1:0.20, y1:0, x2:0.20, y2:1, w:14, c:'#e8eae6', label: null },
  { x1:0.35, y1:0, x2:0.35, y2:1, w:14, c:'#e8eae6', label: null },
  { x1:0.50, y1:0, x2:0.50, y2:1, w:20, c:'#dcdeda', label: null },
  { x1:0.63, y1:0, x2:0.63, y2:1, w:14, c:'#e8eae6', label: null },
  { x1:0.76, y1:0, x2:0.76, y2:1, w:14, c:'#e8eae6', label: null },
];

export const MAP_BLOCKS = [
  [0.21,0.37,0.13,0.12,'#f4f5f2'],[0.36,0.37,0.13,0.12,'#eef5ee'],
  [0.51,0.37,0.11,0.12,'#f4f5f2'],[0.21,0.51,0.13,0.10,'#f7f5ef'],
  [0.36,0.51,0.13,0.10,'#f4f5f2'],[0.51,0.51,0.11,0.10,'#f4f5f2'],
  [0.64,0.51,0.11,0.10,'#eef5ee'],[0.21,0.63,0.13,0.08,'#f4f5f2'],
  [0.36,0.63,0.13,0.08,'#f4f5f2'],[0.51,0.63,0.11,0.08,'#f7f5ef'],
  [0.64,0.63,0.11,0.08,'#f4f5f2'],
];

// US2: ~400m walking radius in normalised map units
export const RADIUS = 0.20;

// Home page fact cards
export const FACT_CARDS = [
  { num:'30',   unit:'%',   desc:'of inner-city traffic is drivers searching for a parking spot – not actually going anywhere.',             source:'UITP Global Parking Study, 2023',        color:'green' },
  { num:'17',   unit:'min', desc:'average time Melbourne CBD commuters spend hunting for parking on a weekday morning.',                     source:'RACV Melbourne Parking Report',           color:'teal'  },
  { num:'$350', unit:'',    desc:'fine for stopping in a clearway zone – easily avoided with MeloPark Trap alerts.',                         source:'VicRoads Infringement Schedule',          color:'amber' },
  { num:'900',  unit:'t',   desc:'of CO₂ emitted annually in Melbourne\'s CBD just from vehicles searching for parking.',                   source:'City of Melbourne Emissions Model',       color:'red'   },
  { num:'2x',   unit:'',    desc:'Drivers with parking info before departure find a spot twice as fast as those without guidance.',          source:'Deakin Smart Cities Lab',                 color:'green' },
  { num:'31K+', unit:'',    desc:'parking bays across Melbourne\'s CBD already have sensor infrastructure – zero new hardware needed.',      source:'City of Melbourne Open Data',             color:'teal'  },
];

// Colours by bay type
export const BAY_COLORS = {
  available: { border: '#a3ec48', bg: '#dce8ff', count: '#6d9d2f', dot: '#a3ec48' },
  trap:      { border: '#8388c6', bg: '#f4f6ff', count: '#8388c6', dot: '#8388c6' },
  occupied:  { border: '#ed6868', bg: '#f4f6ff', count: '#ed6868', dot: '#ed6868' },
};
