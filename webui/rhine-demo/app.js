/* RhinE · HTML translation — behaviour for every visible control.
   Geometry of the isometric array is ported from the theme's js/archive.js + js/grid.js and the case
   sprites' case.json; the palettes are the theme's own tokens (theme/tokens/tokens.json); the case
   pull-out animation plays the theme's 60 pre-rendered inspect frames (data-inspect.js). */
"use strict";

/* =====================================================================================
   1 · DESIGN TOKENS — theme/tokens/tokens.json, verbatim
   ===================================================================================== */
const SCHEMES = {
  archive: { name: "ARCHIVE", light: { bg:"#eeede7", fg:"#252821", "fg-soft":"#4d4f49", "text-muted":"#63665d", mark:"#8d9185", "line-dim":"#8a8a84", "line-faint":"#cacac3", hair:"#d2d1cb", panel:"#f4f3ee", "panel-hi":"#faf9f4", case:"#e4e2da", "case-hi":"#fbfaf5", well:"#e3e2db", accent:"#ff7a01", "on-accent":"#0b0b0b" },
                              dark:  { bg:"#0b0b0b", fg:"#f2f0ea", "fg-soft":"#bbb9b4", "text-muted":"#8c8b88", mark:"#8a8984", "line-dim":"#73726f", "line-faint":"#393938", hair:"#30302f", panel:"#111110", "panel-hi":"#181817", case:"#1b1b1a", "case-hi":"#2b2b29", well:"#121212", accent:"#ff7a01", "on-accent":"#0b0b0b" } },
  hazard:  { name: "HAZARD",  light: { bg:"#ebe8dc", fg:"#1a1a16", "fg-soft":"#45443c", "text-muted":"#5f5d53", "line-dim":"#8a877c", accent:"#f2b800", mark:"#86857d", "line-faint":"#c5c3b8", hair:"#cecbc0", panel:"#f2efe2", "panel-hi":"#f8f5e8", case:"#dfdcd1", "case-hi":"#f9f6e9", well:"#dfdcd1", "on-accent":"#1a1a16" },
                              dark:  { bg:"#0d0d0b", fg:"#f2efe4", "fg-soft":"#bcb8ab", "text-muted":"#8f8b7f", "line-dim":"#6f6c62", accent:"#ffcf1a", mark:"#8a8982", "line-faint":"#3b3a37", hair:"#32312e", panel:"#131310", "panel-hi":"#1a1a17", case:"#1d1d1a", "case-hi":"#2d2c29", well:"#141412", "on-accent":"#0d0d0b" } },
  flare:   { name: "FLARE",   light: { bg:"#ff6b1a", fg:"#060403", "fg-soft":"#3b1f0f", "text-muted":"#4a2610", "line-dim":"#7a3810", accent:"#ffffff", mark:"#87390f", "line-faint":"#d25916", hair:"#dc5c17", panel:"#ff6e1b", "panel-hi":"#ff711b", case:"#f16519", "case-hi":"#ff721c", well:"#f16519", "on-accent":"#060403" },
                              dark:  { bg:"#140a05", fg:"#ffe9da", "fg-soft":"#ffb991", "text-muted":"#d98a5c", "line-dim":"#9a5a35", accent:"#ff6b1a", mark:"#95847a", "line-faint":"#433730", hair:"#3a2e27", panel:"#1a100a", "panel-hi":"#211611", case:"#241914", "case-hi":"#342922", well:"#1b110c", "on-accent":"#140a05" } },
  field:   { name: "FIELD",   light: { bg:"#edf1e6", fg:"#1c261a", "fg-soft":"#435040", "text-muted":"#59665a", "line-dim":"#859183", accent:"#1fa84f", mark:"#888f84", "line-faint":"#c7cdc1", hair:"#d0d4c9", panel:"#f4f7ed", "panel-hi":"#fafef3", case:"#e1e5da", "case-hi":"#fbfff4", well:"#e1e5da", "on-accent":"#1c261a" },
                              dark:  { bg:"#090d09", fg:"#e7f1e3", "fg-soft":"#b2c0ad", "text-muted":"#869683", "line-dim":"#66755f", accent:"#4fdc76", mark:"#838a80", "line-faint":"#363b35", hair:"#2d322c", panel:"#0f130e", "panel-hi":"#151a15", case:"#181d18", "case-hi":"#282c27", well:"#101410", "on-accent":"#090d09" } },
  front:   { name: "COLD FRONT", light: { bg:"#e9eef3", fg:"#15202b", "fg-soft":"#3e4a57", "text-muted":"#56636f", "line-dim":"#84909b", accent:"#1f6fff", mark:"#838b93", "line-faint":"#c3c9cf", hair:"#cbd1d7", panel:"#f0f5f9", "panel-hi":"#f6fbff", case:"#dde2e8", "case-hi":"#f7fcff", well:"#dde2e8", "on-accent":"#e9eef3" },
                              dark:  { bg:"#070a0f", fg:"#e5edf6", "fg-soft":"#aebccb", "text-muted":"#83919f", "line-dim":"#5f6d7b", accent:"#3d8bff", mark:"#81868d", "line-faint":"#34383d", hair:"#2b2f34", panel:"#0d1015", "panel-hi":"#13171c", case:"#161a1f", "case-hi":"#26292f", well:"#0e1116", "on-accent":"#070a0f" } },
  hearth:  { name: "HEARTH",  light: { bg:"#f1e7d8", fg:"#2a1b0f", "fg-soft":"#55402d", "text-muted":"#6c5440", "line-dim":"#9a826b", accent:"#c9631c", mark:"#918577", "line-faint":"#cdc2b4", hair:"#d5cabc", panel:"#f7eede", "panel-hi":"#fdf4e4", case:"#e6dbcd", "case-hi":"#fef5e5", well:"#e6dbcd", "on-accent":"#2a1b0f" },
                              dark:  { bg:"#140b05", fg:"#f5e6d0", "fg-soft":"#cdb497", "text-muted":"#a2876c", "line-dim":"#78604a", accent:"#f29a3f", mark:"#8f8374", "line-faint":"#41372e", hair:"#382e26", panel:"#1a100a", "panel-hi":"#211710", case:"#231a13", "case-hi":"#332921", well:"#1b120b", "on-accent":"#140b05" } },
};
const SCHEME_IDS = Object.keys(SCHEMES);
const TOKEN_KEYS = ["bg","fg","fg-soft","text-muted","mark","line-dim","line-faint","hair","panel","panel-hi","case","case-hi","well","accent","on-accent"];

const SKINS = [
  { id:"aurora", name:"AURORA", desc:"Iridescent lacquer over pale metal; iridescent shift along the frame." },
  { id:"blue",   name:"BLUE",   desc:"Saturated cobalt lacquer with a white metal frame and tab." },
  { id:"coral",  name:"CORAL",  desc:"Warm coral lacquer, cream metal, matte finish." },
  { id:"frost",  name:"FROST",  desc:"Pale frosted silver metal with a translucent cream front." },
  { id:"glass",  name:"GLASS",  desc:"Smoked glass shell over a silver frame, clear window." },
  { id:"hazard", name:"HAZARD", desc:"Black shell with hazard-yellow hazard tape along the frame." },
  { id:"marble", name:"MARBLE", desc:"Soft white plastic, marble-grey gasket, faint veining." },
  { id:"red",    name:"RED",    desc:"Deep signal red lacquer with a white metal frame." },
  { id:"tide",   name:"TIDE",   desc:"Pale tide blue lacquer, cool silver metal." },
  { id:"white",  name:"WHITE",  desc:"Soft matte white plastics and white metal, frosted silver tab." },
];

const C = {};                                     // the live palette the canvas paints with
function applyTheme(schemeId, mode) {
  const sch = SCHEMES[schemeId] ? schemeId : "archive";
  const m = mode === "light" ? "light" : "dark";
  const t = SCHEMES[sch][m];
  const root = document.documentElement.style;
  for (const k of TOKEN_KEYS) { root.setProperty("--" + k, t[k]); C[k] = t[k]; }
  C.rgb = hexToRgb(t.bg);
  root.setProperty("--scrim-rgb", `${C.rgb[0]},${C.rgb[1]},${C.rgb[2]}`);
  root.setProperty("--grain", `url("assets/grain-${m === "dark" ? "dark" : "light"}.png")`);
  root.setProperty("--grain-blend", m === "dark" ? "overlay" : "multiply");
  root.setProperty("--grain-opacity", m === "dark" ? ".5" : ".32");
  document.body.dataset.mode = m;
  state.scheme = sch; state.mode = m;
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(hex, a) { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

/* =====================================================================================
   2 · DATA — a demo archive: 100 albums, 8 genres, 6 decades, deterministic
   ===================================================================================== */
const GENRES = ["AMBIENT", "DRONE", "FIELD", "TECHNO", "JAZZ", "CLASSICAL", "FOLK", "EXPERIMENTAL"];
const ARTISTS = ["ILSE MARTEN","R. OKONKWO","HALDANE","M. SERRA","VELA","K. ONO","BRENT","ARNO","S. LI","FEN","MAER","ODA","RUSK","KETE","LOM","VOSS","BEL","IRA","NUL"];
const TITLES = ["Field Recordings Vol. 2","Tidal Harbour","Signal Drift","Glass Rooms","Night Ferries","Cold Front","Index","Harbour Lights","Static Bloom","Aurora Study","Low Orbit","Pale Deck","Night Watch","Quiet Engine","Salt Air","Beacon","Still Water","North Light","Slow Signal","End of Archive"];
const TRACK_NAMES = ["Tidal Harbour","Index","Glass","Room","Engines Orbit Ferries","Static Bloom","Cold Front","Night Ferries","Signal Drift","Salt Air","Beacon","Low Orbit","Pale Deck","Quiet Engine","North Light","Still Water","Slow Signal","Aurora Study","Harbour Lights","End of Archive"];
const YEARS = [1968,1972,1977,1981,1984,1989,1991,1993,1996,1998,2001,2004,2007,2011,2014,2017,2019,2021,2023,2025];

function hash(n) { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; return (x >>> 0) / 4294967295; }
function len(n) { return 168 + Math.floor(hash(n * 31 + 7) * 130); }
function mmss(s) { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
function mmssLong(s) { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600); return (h ? h + ":" : "") + String(Math.floor(s % 3600 / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }

const ALBUMS = [];
for (let i = 0; i < 100; i++) {
  const n = i + 1;
  const a = {
    idx: i, no: 1012 - i,
    title: TITLES[i % TITLES.length], artist: ARTISTS[(i * 7) % ARTISTS.length],
    year: YEARS[(i * 13) % YEARS.length], genre: GENRES[(i * 11) % GENRES.length],
    hue: (i * 37) % 360, plays: 3 + Math.floor(hash(n * 17) * 220),
    bitrate: 780 + Math.floor(hash(n * 5) * 240),
    length: len(n),
  };
  a.trackCount = 4 + (i % 9);
  a.tracks = [];
  let used = 0;
  for (let t = 0; t < a.trackCount; t++) {
    const secs = len(n * 91 + t) % 62 + 18;
    used += secs;
    a.tracks.push({ no: t + 1, name: TRACK_NAMES[(i + t * 3) % TRACK_NAMES.length], len: secs });
  }
  a.length = used;
  ALBUMS.push(a);
}
ALBUMS.forEach((a, i) => { a.arc = "ARC-" + String(a.no).padStart(4, "0"); a.added = `0${(i % 9) + 1} · ${String((i % 28) + 1).padStart(2, "0")} SEP`; });

const LYRICS = [
  { t: 0,  zh: "第三次退潮的时候",            en: "ON THE THIRD EBB TIDE" },
  { t: 1,  zh: "我终于听见了海",              en: "I FINALLY HEARD THE SEA" },
  { t: 2,  zh: "灯塔把夜晚折成两半",          en: "THE LIGHTHOUSE FOLDS THE NIGHT IN HALF" },
  { t: 3,  zh: "风从信号塔经过",              en: "THE WIND PASSES THE SIGNAL TOWER" },
  { t: 4,  zh: "我们在潮声里等待",            en: "WE WAIT INSIDE THE SOUND OF THE TIDE" },
  { t: 5,  zh: "天亮之前",                    en: "BEFORE DAYBREAK" },
];

/* =====================================================================================
   3 · STATE + URL PARAMETERS (?view= &layout= &scheme= &mode= &t= &play=)
   ===================================================================================== */
const qs = new URLSearchParams(location.search);
const state = {
  view: qs.get("view") || "archive",
  layout: qs.get("layout") === "grid" ? "grid" : "array",
  scheme: qs.get("scheme") || "archive",
  mode: qs.get("mode") === "light" ? "light" : "dark",
  skin: qs.get("skin") || "white",
  unit: qs.get("unit") === "tracks" ? "tracks" : "albums",
  group: qs.get("group") === "decade" ? "decade" : "genre",
  sort: ["artist", "title", "year"].includes(qs.get("sort")) ? qs.get("sort") : "artist",
  gi: 0,                                             // current group index
  sel: { row: 0, slot: 4 },                          // position in the array (row = shelf, 0 = front)
  album: 0,                                          // selected album index
  hover: null,
  lifts: new Map(),
  filter: qs.get("q") || "",
  play: { on: false, pos: Number(qs.get("t")) || 0, len: 205, shuffle: true, order: 0, vol: 100 },
  plmode: "album",
  model: qs.get("model") || "3d",
  pl: 1,
  playlists: [],
  track: 0,
  t0: performance.now(),
};
if (qs.get("play") === "1") state.play.on = true;

/* =====================================================================================
   4 · COVERS — one deterministic composition per hue, drawn on a 340 px canvas
   ===================================================================================== */
const coverCache = new Map(), coverUrlCache = new Map();
function coverImage(hue) {
  if (coverCache.has(hue)) return coverCache.get(hue);
  const c = document.createElement("canvas");
  c.width = c.height = 340;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 340, 340);
  grd.addColorStop(0, `hsl(${hue} 62% 66%)`);
  grd.addColorStop(.55, `hsl(${(hue + 24) % 360} 58% 50%)`);
  grd.addColorStop(1, `hsl(${(hue + 48) % 360} 52% 34%)`);
  g.fillStyle = grd; g.fillRect(0, 0, 340, 340);
  g.fillStyle = "rgba(11,11,11,.78)";
  g.beginPath(); g.arc(238, 96, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(11,11,11,.55)";
  g.fillRect(30, 210, 190, 12); g.fillRect(30, 236, 130, 12);
  g.fillStyle = "rgba(242,240,234,.95)";
  g.font = "600 28px 'Geist Mono', monospace";
  g.fillText(String((hue * 7) % 997), 30, 300);
  g.strokeStyle = "rgba(11,11,11,.45)"; g.lineWidth = 2;
  g.strokeRect(18, 18, 304, 304);
  coverCache.set(hue, c);
  return c;
}
function coverURL(hue) {
  if (!coverUrlCache.has(hue)) coverUrlCache.set(hue, coverImage(hue).toDataURL("image/png"));
  return coverUrlCache.get(hue);
}
/* the spine label is drawn on a small offscreen sheet, then mapped onto the case like the theme does */
const labelCache = new Map();
function labelImage(text) {
  if (labelCache.has(text)) return labelCache.get(text);
  const c = document.createElement("canvas"); c.width = 120; c.height = 150;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 120, 150);
  g.fillStyle = "#1c1c1a"; g.font = "600 30px 'Geist Mono', monospace";
  g.fillText("ARC", 8, 58);
  g.font = "500 30px 'Geist Mono', monospace";
  g.fillText(text, 8, 92);
  labelCache.set(text, c);
  return c;
}

/* =====================================================================================
   5 · CASE GEOMETRY — the case.json of each skin under theme/assets/render/case
   ===================================================================================== */
const CASE = {
  res: 600, origin: [300, 431.62], center: [300, 300],
  cover: [[148.6,136.66],[369.09,239.25],[369.09,448.34],[148.6,345.74]],
  label: [[381.6,328.88],[424.43,348.81],[424.43,372.88],[381.6,352.95]],
  axes: { x: [79.31, 36.9], y: [57.56, -50.85], z: [0, -75.21] },
};
const RAIL = { res: 900, origin: [450, 581.62] };
const HERO = {                                        // case.json → hero (front-on, 1000 units)
  res: 1000, cover: [[122,208.1],[705.8,208.1],[705.8,791.9],[122,791.9]],
  label: [[749.9,426.5],[863.3,426.5],[863.3,493.7],[749.9,493.7]],
};
const RING_META = { res: [1400, 900], bounds: [147.22, 182.21, 1252.78, 738.6] };
const SLOTS = 20, PITCH = 1.0, ROWP = 4.7, SHELF_ROWS = 5, LIFT_OUT = 2.2;
const CLOSE = [.45, -.62, .64];

const skinImages = new Map();
function onAssetLoad() { dirty = true; if (state.view === "style") syncStyle(); syncProfiles(); }
function skinImg(skin, part) {
  const k = skin + "|" + part;
  if (!skinImages.has(k)) {
    const im = new Image();
    im.onload = onAssetLoad; im.onerror = onAssetLoad;
    im.src = `assets/case/${skin}-${part}.png`;
    skinImages.set(k, im);
  }
  return skinImages.get(k);
}
const heroImg = new Image(); heroImg.onload = onAssetLoad; heroImg.src = "assets/case/hero-frost.png";
const railMid = new Image(); railMid.onload = onAssetLoad; railMid.src = "assets/rail/rail-mid.png";
function railImg() { return railMid; }
const ringDay = new Image(); ringDay.src = "assets/ring/ring-day.png";
const ringNight = new Image(); ringNight.src = "assets/ring/ring-night.png";
const inspectFrames = [];                             // loaded lazily, only when a case is inspected

/* =====================================================================================
   6 · CANVAS
   ===================================================================================== */
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, K = 1, OX = 0, OY = 0, dirty = true;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  K = H / 1000; OX = W * 0.43; OY = H * 0.80;
  gridGeometry();
  heroCanvas.width = 620; heroCanvas.height = 620;
  dirty = true;
}
function toScreen(wx, wy, wz) {
  const a = CASE.axes;
  return [ OX + (wx * a.x[0] + wy * a.y[0] + wz * a.z[0]) * K,
           OY + (wx * a.x[1] + wy * a.y[1] + wz * a.z[1]) * K ];
}
/* map an image onto a parallelogram (the theme's quadImage, with the scale passed in) */
function quadImage(img, quad, ox, oy, k) {
  const p = quad.map(([x, y]) => [ox + x * k, oy + y * k]);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]);
  ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
  ctx.closePath(); ctx.clip();
  ctx.transform((p[1][0]-p[0][0])/img.width, (p[1][1]-p[0][1])/img.width,
                (p[3][0]-p[0][0])/img.height, (p[3][1]-p[0][1])/img.height, p[0][0], p[0][1]);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
function quadPath(quad, ox, oy, k) {
  const p = quad.map(([x, y]) => [ox + x * k, oy + y * k]);
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]);
  ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
  ctx.closePath();
}
function inQuad(px, py, quad, ox, oy, k) {
  const p = quad.map(([x, y]) => [ox + x * k, oy + y * k]);
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* =====================================================================================
   7 · THE ARRAY — groups, shelves, projection, hit testing, the pull-out animation
   ===================================================================================== */
let filtered = ALBUMS.slice();
function applyFilter() {
  const f = state.filter.trim().toLowerCase();
  filtered = !f ? ALBUMS.slice() : ALBUMS.filter(a =>
    a.title.toLowerCase().includes(f) || a.artist.toLowerCase().includes(f) ||
    a.genre.toLowerCase().includes(f) || String(a.year).includes(f) || a.arc.toLowerCase().includes(f));
}
function decadeOf(a) { return String(Math.floor(a.year / 10) * 10) + "S"; }
function sortAlbums(list) {
  const c = list.slice();
  if (state.sort === "title")  c.sort((a, b) => a.title.localeCompare(b.title) || a.no - b.no);
  else if (state.sort === "year") c.sort((a, b) => b.year - a.year || a.no - b.no);
  else c.sort((a, b) => a.artist.localeCompare(b.artist) || a.year - b.year);
  return c;
}
function groups() {
  const map = new Map();
  for (const a of filtered) {
    const key = state.group === "decade" ? decadeOf(a) : a.genre;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(a);
  }
  let out = [...map.entries()].map(([name, albums]) => ({ name, albums: sortAlbums(albums) }));
  if (state.group === "decade") out.sort((a, b) => a.name.localeCompare(b.name));
  else out.sort((a, b) => GENRES.indexOf(a.name) - GENRES.indexOf(b.name));
  return out;
}
function groupItems(g) {
  if (state.unit === "tracks")
    return g.albums.flatMap(a => a.tracks.map((t, i) => ({ album: a, track: t, ti: i })));
  return g.albums.map(a => ({ album: a, track: null }));
}
/* which group and which slot sits at shelf row `row` */
function shelfPlan() {
  const gs = groups();
  if (!gs.length) return { gs, rows: [] };
  const rows = [];
  let gi = Math.min(state.gi, gs.length - 1), from = 0;
  for (let r = 0; r < SHELF_ROWS; r++) {
    const items = groupItems(gs[gi]);
    const n = Math.min(SLOTS, items.length - from);
    rows.push({ gi, from, count: n });
    from += n;
    if (from >= items.length) { gi++; from = 0; if (gi >= gs.length) break; }
  }
  return { gs, rows };
}
function itemAt(row, slot) {
  const { gs, rows } = shelfPlan();
  const p = rows[row]; if (!p) return null;
  const items = groupItems(gs[p.gi]);
  const it = items[p.from + slot]; if (!it) return null;
  return { ...it, gi: p.gi, indexInGroup: p.from + slot, groupName: gs[p.gi].name, total: items.length };
}
function currentItem() { return itemAt(state.sel.row, state.sel.slot); }
function currentAlbum() { const it = currentItem(); return it ? it.album : (filtered[0] || ALBUMS[0]); }

function rowAlpha(pos) { return [1, .82, .58, .40, .28][pos] ?? .2; }
function rowTint(pos, mode) { return pos === 0 ? 0 : Math.min(.72, .22 * pos) * (mode === "light" ? .8 : 1); }
function blend(hex, amount) {                          // blend a token colour towards the page
  const a = hexToRgb(hex), b = C.rgb;
  return `rgb(${Math.round(b[0] + (a[0]-b[0])*(1-amount))},${Math.round(b[1] + (a[1]-b[1])*(1-amount))},${Math.round(b[2] + (a[2]-b[2])*(1-amount))})`;
}

function drawArray() {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  drawFloor();
  const { rows } = shelfPlan();
  for (let pos = SHELF_ROWS - 1; pos >= 0; pos--) if (rows[pos] && rows[pos].count) drawShelf(pos, rows[pos]);
  const insp = state.insp;
  if (insp) { ctx.fillStyle = rgba(C.bg, .82 * insp.e); ctx.fillRect(0, 0, W, H); }
  if (insp && insp.e > 0) { drawInspection(insp); return; }
  drawSelectionPlate();
}
function drawFloor() {
  const [x0, y0] = toScreen(-SHELF_ROWS * ROWP - 6, -4, -0.02);
  const [x1, y1] = toScreen(-SHELF_ROWS * ROWP - 6, SLOTS + 6, -0.02);
  const [x2, y2] = toScreen(6, SLOTS + 14, -0.02);
  const [x3, y3] = toScreen(6, -12, -0.02);
  const g = ctx.createLinearGradient(0, y1, 0, y2);
  g.addColorStop(0, rgba(C["panel-hi"], state.mode === "light" ? .55 : .9));
  g.addColorStop(1, rgba(C.bg, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
  ctx.closePath(); ctx.fill();
}
function drawShelf(pos, plan) {
  const g = groups()[plan.gi];
  const items = groupItems(g).slice(plan.from, plan.from + plan.count);
  const wx = -pos * ROWP, alpha = rowAlpha(pos), tint = rowTint(pos, state.mode);
  const rail = railImg();
  if (rail.complete && rail.naturalWidth) {
    const [sx, sy] = toScreen(wx, -0.4, 0);
    ctx.globalAlpha = alpha * (state.mode === "light" ? .85 : 1);
    ctx.drawImage(rail, sx - RAIL.origin[0] * K, sy - RAIL.origin[1] * K, RAIL.res * K, RAIL.res * K);
    ctx.globalAlpha = 1;
  }
  const list = items.map((it, s) => {
    const lift = state.lifts.get(pos + ":" + s) ?? 0;
    const y = s * PITCH, z = LIFT_OUT * lift * .3;
    return { it, s, y, z, close: CLOSE[1] * y + CLOSE[2] * z * .2 };
  });
  list.sort((a, b) => a.close - b.close);
  let sel = null;
  for (const box of list) {
    const drawn = drawCase(pos, box.s, box.y, box.z, alpha, tint, box.it);
    if (state.sel.row === pos && state.sel.slot === box.s) sel = drawn;
  }
  if (sel) plateAnchor = sel;
}
function drawCase(pos, slot, wy, wz, alpha, tint, it) {
  const wx = -pos * ROWP;
  const [sx, sy] = toScreen(wx, wy, wz);
  const ox = sx - CASE.origin[0] * K, oy = sy - CASE.origin[1] * K, S = CASE.res * K;
  if (oy > H + S || ox > W + S || ox < -S * 1.4 || oy + S < -80) return { ox, oy, album: it.album };
  const a = it.album;
  ctx.save();
  ctx.globalAlpha = alpha;
  quadImage(coverImage(a.hue), CASE.cover, ox, oy, K);
  const frost = skinImg(state.skin, "array-frost"), clear = skinImg(state.skin, "array-clear");
  if (frost.complete && frost.naturalWidth) ctx.drawImage(frost, ox, oy, S, S);
  if (tint > 0) { ctx.save(); ctx.globalAlpha = alpha * tint; ctx.fillStyle = C.bg; quadPath(CASE.cover, ox, oy, K); ctx.fill(); ctx.restore(); }
  if (clear.complete && clear.naturalWidth) ctx.drawImage(clear, ox, oy, S, S);
  quadImage(labelImage(String(a.no)), CASE.label, ox, oy, K);
  const hov = state.hover && state.hover.row === pos && state.hover.slot === slot;
  if (hov || (state.sel.row === pos && state.sel.slot === slot)) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = hov ? 2 : 1;
    quadPath(CASE.cover, ox, oy, K); ctx.stroke();
  }
  ctx.restore();
  return { ox, oy, album: a, slot };
}
let plateAnchor = null;
function drawSelectionPlate() {
  if (!plateAnchor || state.layout !== "array") return;
  const { ox, oy, album } = plateAnchor;
  const top = CASE.cover[1];
  const x1 = ox + top[0] * K + 4, y1 = oy + top[1] * K - 4;
  const lx = x1 + 26, ly = y1 - 26;
  ctx.strokeStyle = C.fg; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lx, ly); ctx.lineTo(lx + 54, ly); ctx.stroke();
  ctx.font = "500 12px 'Geist Mono', monospace"; ctx.textBaseline = "middle";
  const text = album.arc;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = C.fg; ctx.fillRect(lx + 54, ly - 9, tw + 16, 18);
  ctx.fillStyle = C.bg; ctx.fillText(text, lx + 62, ly + 1);
}
function hitTest(px, py) {
  const { rows } = shelfPlan();
  for (let pos = 0; pos < SHELF_ROWS; pos++) {
    const p = rows[pos]; if (!p) continue;
    for (let s = p.count - 1; s >= 0; s--) {
      const lift = state.lifts.get(pos + ":" + s) ?? 0;
      const [sx, sy] = toScreen(-pos * ROWP, s * PITCH, LIFT_OUT * lift * .3);
      const ox = sx - CASE.origin[0] * K, oy = sy - CASE.origin[1] * K;
      if (inQuad(px, py, CASE.cover, ox, oy, K)) return { row: pos, slot: s };
    }
  }
  return null;
}

/* ---------- the pull-out animation: 60 pre-rendered frames, cover and label interpolated ---------- */
function loadInspectFrames() {
  if (inspectFrames.length) return true;
  if (state.inspLoading) return false;
  state.inspLoading = true;
  let left = INS.length;
  for (let i = 0; i < INS.length; i++) {
    const im = new Image();
    im.onload = im.onerror = () => { if (--left === 0) { state.inspLoading = false; dirty = true; } };
    im.src = `assets/case/inspect/inspect-${String(i).padStart(2, "0")}.png`;
    inspectFrames.push(im);
  }
  return false;
}
function drawInspection(insp) {
  const e = insp.e, n = INS.length, x = e * (n - 1);
  const i0 = Math.min(n - 2, Math.floor(x)), f = Math.min(1, x - i0);
  const M0 = INS[i0], M1 = INS[i0 + 1];
  const k0 = K * .60, k1 = K * .88, k = k0 + (k1 - k0) * e;
  const cx = insp.from[0] + (W * .49 - insp.from[0]) * e;
  const cy = insp.from[1] + (H * .50 - insp.from[1]) * e;
  const ox = cx - INS_RES / 2 * k, oy = cy - INS_RES / 2 * k;
  const mix = (i) => M0[i] + (M1[i] - M0[i]) * f;
  const quad = (base) => [[mix(base), mix(base + 1)], [mix(base + 2), mix(base + 3)],
                          [mix(base + 4), mix(base + 5)], [mix(base + 6), mix(base + 7)]];
  const coverQ = quad(4), labelQ = quad(12);
  const a = insp.album;
  quadImage(coverImage(a.hue), coverQ, ox, oy, k);
  if (!inspectFrames.length) { loadInspectFrames(); }
  const frame = (img, M, alpha) => {
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.drawImage(img, ox + M[0] * k, oy + M[1] * k, M[2] * k, M[3] * k);
    ctx.restore();
  };
  frame(inspectFrames[i0], M0, 1);
  if (f > .01) frame(inspectFrames[i0 + 1], M1, f);
  quadImage(labelImage(String(a.no)), labelQ, ox, oy, k);
  if (e > .55) {
    const q = coverQ.map(([px, py]) => [ox + px * k, oy + py * k]);
    ctx.fillStyle = C.accent;
    for (const [px, py] of q) ctx.fillRect(Math.round(px - 2), Math.round(py - 2), 5, 5);
  }
  insp.rect = { x: ox + M1[0] * k, y: oy + M1[1] * k, w: M1[2] * k, h: M1[3] * k };
}

/* =====================================================================================
   8 · GRID LAYOUT — flat covers in sections (theme/js/grid.js: covers in sections by group)
   ===================================================================================== */
const gridScroll = document.getElementById("grid-scroll");
const gridBody = document.getElementById("grid-body");
function gridCols() { return Math.max(4, Math.min(11, Math.round((gridScroll.clientWidth - 48) / 152))); }
function gridGeometry() {
  gridBody.querySelectorAll(".grid-rows").forEach(r => r.style.gridTemplateColumns = `repeat(${gridCols()}, minmax(0,1fr))`);
}
function renderGrid() {
  applyFilter();
  const gs = groups();
  const frag = document.createDocumentFragment();
  if (!gs.length) {
    const d = document.createElement("div");
    d.className = "grid-empty";
    d.textContent = `NOTHING MATCHES "${state.filter.toUpperCase()}"`;
    frag.appendChild(d);
  }
  const sel = currentAlbum();
  gs.forEach((g, gi) => {
    const head = document.createElement("div");
    head.className = "grid-sec";
    head.innerHTML = `<i>${String(gi + 1).padStart(2, "0")}</i>${g.name}<span>${g.albums.length} ALBUMS</span>`;
    frag.appendChild(head);
    const rows = document.createElement("div");
    rows.className = "grid-rows";
    rows.style.gridTemplateColumns = `repeat(${gridCols()}, minmax(0,1fr))`;
    g.albums.forEach(a => {
      const cell = document.createElement("div");
      cell.className = "cell" + (a === sel ? " is-sel" : "");
      cell.dataset.idx = a.idx;
      cell.innerHTML =
        `<div class="cell-cover" style="background-image:url(${coverURL(a.hue)})">
           <span class="cell-year">${a.year}</span></div>
         <div class="cell-title">${a.title}</div>
         <div class="cell-artist">${a.artist} · ${a.arc}</div>`;
      cell.addEventListener("mouseenter", () => { state.hover = { cell: a.idx }; });
      cell.addEventListener("click", () => { selectAlbum(a, { gi, slot: g.albums.indexOf(a) }); });
      cell.addEventListener("dblclick", () => { selectAlbum(a, { gi, slot: g.albums.indexOf(a) }); openInspect(); });
      rows.appendChild(cell);
    });
    frag.appendChild(rows);
  });
  gridBody.replaceChildren(frag);
  const sc = document.getElementById("gh-count");
  if (sc) sc.textContent = `${filtered.length.toLocaleString("en-US")} ALBUMS`;
  document.getElementById("gh-by").textContent = "BY " + (state.group === "decade" ? "DECADE" : "GENRE");
}

/* =====================================================================================
   9 · SELECTION + the panels that follow it
   ===================================================================================== */
function selectAlbum(a, at) {
  if (state.album !== a.idx) state.track = 0;
  state.album = a.idx;
  if (at) { state.gi = at.gi; state.sel = { row: 0, slot: at.slot }; }
  else {
    const gs = groups();
    for (let gi = 0; gi < gs.length; gi++) {
      const at2 = groupItems(gs[gi]).findIndex(it => it.album === a);
      if (at2 >= 0) { state.gi = gi; state.sel = { row: Math.floor(at2 / SLOTS), slot: at2 % SLOTS }; break; }
    }
  }
  plateAnchor = null;
  state.lifts.clear();
  state.lifts.set(state.sel.row + ":" + state.sel.slot, 1);
  syncAll();
  dirty = true;
}
function selectAt(row, slot) {
  const it = itemAt(row, slot); if (!it) return;
  state.sel = { row, slot }; state.album = it.album.idx;
  animateLift();
  syncAll();
}
function syncAll() {
  syncInfo(); syncNumerals(); syncGroupPanel(); syncTransport(); syncProfiles();
  syncPlaylists(); syncGridSel();
  if (state.view === "lyrics") { renderLyrics(); lastLyric = -1; syncLyrics(); }
}
function syncGridSel() {
  if (state.layout !== "grid") return;
  gridBody.querySelectorAll(".cell").forEach(c => c.classList.toggle("is-sel", Number(c.dataset.idx) === state.album));
}
function syncInfo() {
  const a = currentAlbum();
  const it = currentItem();
  document.getElementById("info-group").textContent = it ? it.groupName : "—";
  document.getElementById("info-no").textContent = a.no;
  document.getElementById("info-title").textContent = a.title;
  document.getElementById("info-artist").textContent = a.artist;
  document.getElementById("info-meta").innerHTML =
    `${a.year}&nbsp;&nbsp;/&nbsp;&nbsp;${String(a.tracks.length).padStart(2, "0")}&nbsp;TRACKS&nbsp;&nbsp;/&nbsp;&nbsp;${mmss(a.length)}`;
  document.getElementById("info-arc").textContent = a.arc;
  document.getElementById("info-genre").textContent = a.genre;
  document.getElementById("info-added").textContent = a.added;
  document.getElementById("info-plays").textContent = a.plays;
  const ul = document.getElementById("info-tracks");
  ul.replaceChildren(...a.tracks.map((t, i) => {
    const li = document.createElement("li");
    li.className = i === state.track ? "is-current" : "";
    li.innerHTML = `<span class="t-no">${String(t.no).padStart(2, "0")}</span><span class="t-name">${t.name}</span><span class="t-len">${mmss(t.len)}</span>`;
    li.addEventListener("click", () => { state.track = i; state.play.pos = 0; syncTransport(); syncInfo(); });
    return li;
  }));
  const ghost = document.getElementById("info-ghost");
  if (ghost) ghost.textContent = it ? it.groupName : "";
}
function syncNumerals() {
  const it = currentItem();
  const n = it ? it.indexInGroup + 1 : 0, total = it ? it.total : 0;
  document.getElementById("num-big").innerHTML =
    `${String(n).padStart(2, "0")}<span class="num-of">/&nbsp;${total}</span>`;
  document.getElementById("ruler-mark").style.left = ((state.sel.slot + .5) / SLOTS * 100) + "%";
}
function syncGroupPanel() {
  const gs = groups();
  const gi = Math.min(state.gi, Math.max(0, gs.length - 1));
  document.getElementById("shelf-num").innerHTML = `${String(gi + 1).padStart(2, "0")}&nbsp;/&nbsp;${gs.length}`;
  document.getElementById("shelf-cur").textContent = gs[gi] ? gs[gi].name : "—";
  document.getElementById("shelf-next").textContent = gs[gi + 1] ? gs[gi + 1].name : "—";
  document.getElementById("shelf-prev").disabled = gi <= 0;
  document.getElementById("shelf-go").disabled = gi >= gs.length - 1;
  const sLeft = document.getElementById("status-left");
  if (state.filter.trim() && state.view === "archive")
    sLeft.innerHTML = `FILTER&nbsp;·&nbsp;"${state.filter.toUpperCase()}"&nbsp;·&nbsp;${filtered.length}&nbsp;ALBUM${filtered.length === 1 ? "" : "S"}`;
  else sLeft.innerHTML = STATUS_LABEL[state.view];
}
const STATUS_LABEL = {
  archive: "ARCHIVE&nbsp;SECTION&nbsp;·&nbsp;BROWSE",
  playlists: "PLAYLIST&nbsp;SECTION&nbsp;·&nbsp;002&nbsp;ARCHIVE&nbsp;·&nbsp;ALBUM",
  lyrics: "LYRICS&nbsp;SECTION&nbsp;·&nbsp;PLAYBACK",
  signal: "SIGNAL&nbsp;SECTION&nbsp;·&nbsp;MONITOR",
  style: "STYLE&nbsp;SECTION&nbsp;·&nbsp;APPEARANCE",
};

/* =====================================================================================
   10 · THE SHELF'S OWN CLOCK: lift animation + one repaint pump
   ===================================================================================== */
let anim = null;
function animateLift() {
  cancelAnimationFrame(anim);
  const tick = () => {
    let busy = false;
    for (const [key] of state.lifts) {
      const [r, s] = key.split(":").map(Number);
      const target = (state.sel.row === r && state.sel.slot === s) ? 1 : 0;
      const cur = state.lifts.get(key) ?? 0;
      const next = cur + (target - cur) * .18;
      if (Math.abs(next - target) > .002) busy = true; else if (target === 0) { state.lifts.delete(key); continue; }
      state.lifts.set(key, next);
    }
    const kk = state.sel.row + ":" + state.sel.slot;
    if (!state.lifts.has(kk)) { state.lifts.set(kk, 0); busy = true; }
    dirty = true;
    if (busy) anim = requestAnimationFrame(tick);
  };
  anim = requestAnimationFrame(tick);
}
let last = performance.now();
function pump(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (state.play.on) {
    state.play.pos += dt;
    if (state.play.pos >= state.play.len) { state.play.pos = 0; nextTrack(1); }
    onTick();
  }
  if (state.insp && state.insp.e < 1) {
    const p = Math.min(1, (now - state.insp.start) / (state.insp.back ? 520 : 900));
    state.insp.e = state.insp.back ? 1 - p : p;
    if (p >= 1 && state.insp.back) closeInspectNow();
    dirty = true;
  }
  if (state.view === "signal") dirty = true;
  if (state.intro) stepIntro(now);
  if (state.insp) { positionInspectText(); dirty = true; }
  if (dirty) { dirty = false; render(); }
  requestAnimationFrame(pump);
}
function render() {
  if (state.view === "signal") drawSignal();
  else if (state.view === "archive" && state.layout === "array") drawArray();
}

/* =====================================================================================
   11 · SIGNAL — the ∞ ring + 48-band spectrum + the whole-track trace (theme/js/signal.js)
   ===================================================================================== */
function signalGeom() {
  const m = 48, cx = Math.round(W / 2);
  const traceW = Math.min(W - 2 * m - 80, 1100), traceH = 44, traceY = H - 64 - 44 - 46;
  const ringW = Math.round(Math.min(860, W - 240, (traceY - 150) / .56));
  const ringY = Math.round(40 + (traceY - 110) * .46);
  return { m, cx, ringW, ringY, specY: Math.round(ringY + ringW * .36), specW: Math.round(ringW * .62), traceW, traceH, traceY };
}
function traceOf(a) {
  if (a.__trace) return a.__trace;
  const n = 320, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const env = .35 + .5 * Math.abs(Math.sin(p * 5.2 + a.idx)) * (.6 + .4 * Math.sin(p * 31));
    out[i] = Math.max(.03, Math.min(1, env * (.55 + .45 * hash(a.idx * 977 + i))));
  }
  a.__trace = out;
  return out;
}
function regCross(x, y) {
  ctx.strokeStyle = C["line-dim"]; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 5.5, y); ctx.lineTo(x + 5.5, y);
  ctx.moveTo(x, y - 5.5); ctx.lineTo(x, y + 5.5);
  ctx.stroke();
}
function bracket(x, y, sx, sy) {
  const L = 18;
  ctx.fillStyle = C["line-dim"];
  ctx.fillRect(Math.round(sx > 0 ? x : x - L), Math.round(y), L, 1);
  ctx.fillRect(Math.round(x), Math.round(sy > 0 ? y : y - L), 1, L);
}
function drawSignal() {
  const g = signalGeom(), playing = state.play.on;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  for (const [x, y] of [[16, 16], [W - 27, 16], [16, H - 27], [W - 27, H - 27]]) regCross(x, y);
  if (state.model === "classic") { drawClassic(g); drawTrace(g); drawSigHead(g); return; }
  const b = RING_META.bounds, s = g.ringW / (b[2] - b[0]);
  const bx0 = Math.round(g.cx - g.ringW / 2 - 48), bx1 = Math.round(g.cx + g.ringW / 2 + 48);
  const by0 = Math.round(g.ringY - (460.4 - b[1]) * s + 8), by1 = Math.round(g.specY + 24);
  bracket(bx0, by0, 1, 1); bracket(bx1, by0, -1, 1); bracket(bx0, by1, 1, -1); bracket(bx1, by1, -1, -1);
  drawRing(g, s);
  drawSpectrum(g, playing);
  drawTrace(g);
  drawSigHead(g);
}
function drawSigHead(g) {
  ctx.fillStyle = C.fg;
  ctx.fillRect(g.m, 32, 5, 5);
  ctx.font = "600 9px 'Geist Mono', monospace"; ctx.textBaseline = "alphabetic";
  const state_ = !state.play.on ? "STANDBY" : "LIVE";
  const el = document.getElementById("sig-state");
  if (el) { el.textContent = state_; el.classList.toggle("chip-acc", state_ !== "STANDBY"); }
  const a = currentAlbum();
  const lenEl = document.getElementById("sig-len"), tEl = document.getElementById("sig-time");
  if (lenEl) lenEl.textContent = mmss(state.play.len);
  if (tEl) tEl.textContent = mmss(state.play.pos);
}
function drawRing(g, s) {
  const img = state.mode === "dark" ? ringNight : ringDay;
  const cy = g.ringY;
  if (state.model === "2d" || !img.complete || !img.naturalWidth) {
    // 2D model: the ring as stroke art (two lobes of a lemniscate) — no sprite
    ctx.save();
    ctx.strokeStyle = C["line-dim"]; ctx.lineWidth = Math.max(2, g.ringW * .012);
    for (const dir of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const t = i / 200 * Math.PI * 2;
        const px = g.cx + dir * (g.ringW / 2) * Math.cos(t) * .5 + (g.ringW / 4) * (dir > 0 ? 1 : -1);
        const py = cy + (g.ringW / 4) * Math.sin(2 * t);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  } else {
    const W2 = RING_META.res[0] * s, H2 = RING_META.res[1] * s;
    const ox = g.cx - 700 * s, oy = cy - 460.4 * s;
    ctx.globalAlpha = state.mode === "light" ? .92 : 1;
    ctx.drawImage(img, ox, oy, W2, H2);
    ctx.globalAlpha = 1;
  }
  // light pulses travelling the fibre: a lemniscate matched to the ring's drawn bounds
  const n = 14, base = performance.now() / (state.play.on ? 1900 : 4200);
  for (let i = 0; i < n; i++) {
    const t = (base + i / n) * Math.PI * 2;
    const px = g.cx + (g.ringW / 2) * .93 * Math.cos(t);
    const py = cy + (g.ringW / 4) * .93 * Math.sin(2 * t);
    const k = (i / n);
    ctx.globalAlpha = (state.play.on ? .85 : .28) * (0.35 + .65 * (1 - Math.abs(.5 - k) * 2));
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, g.ringW * .006), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawSpectrum(g, playing) {
  const n = 48, half = g.specW / 2, step = half / (n / 2), bw = Math.max(1, Math.round(step * .55)), hmax = 26;
  ctx.globalAlpha = 1;
  ctx.fillStyle = rgba(C["line-dim"], .7);
  ctx.fillRect(g.cx - half, g.specY, g.specW, 1);
  const t = performance.now() / 1000;
  for (let i = 0; i < n / 2; i++) {
    const phase = i * .55 + t * (playing ? 2.1 : .12);
    let v = playing
      ? Math.max(0, (.35 + .65 * Math.abs(Math.sin(phase))) * (1 - i / (n / 2) * .55) * (.6 + .4 * hash(i * 31 + Math.floor(t * 2))))
      : 0;
    v = Math.min(1, v);
    const h = Math.max(1, Math.round(v * hmax));
    const col = i < 3 ? C.accent : rgba(C.fg, .35 + .55 * v);
    for (const sx of [-1, 1]) {
      const x = Math.round(g.cx + sx * (i + .5) * step - bw / 2);
      ctx.fillStyle = col;
      ctx.fillRect(x, g.specY - h, bw, h);
      ctx.fillStyle = rgba(typeof col === "string" && col.startsWith("#") ? col : C.fg, .35 * (playing ? 1 : 0));
      ctx.fillRect(x, g.specY + 1, bw, Math.round(h * .45));
    }
  }
}
function drawTrace(g) {
  const a = currentAlbum(), tr = traceOf(a), x0 = g.cx - g.traceW / 2, y = g.traceY, h = g.traceH;
  ctx.save();
  ctx.fillStyle = C["line-dim"];
  const n = tr.length, cw = g.traceW / n;
  for (let i = 0; i < n; i++) {
    const v = tr[i], bh = Math.max(1, v * h / 2);
    ctx.globalAlpha = .85;
    ctx.fillRect(x0 + i * cw, y + h / 2 - bh, Math.max(1, cw * .55), bh * 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.accent;
  const px = x0 + g.traceW * Math.min(1, state.play.pos / Math.max(1, state.play.len));
  ctx.fillRect(Math.round(px), y - 6, 2, h + 12);
  ctx.beginPath(); ctx.arc(Math.round(px) + 1, y - 6, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  document.getElementById("sig-len").textContent = mmss(state.play.len);
  document.getElementById("sig-time").textContent = mmss(state.play.pos);
}
function drawClassic(g) {
  const a = currentAlbum();
  const R = Math.min(g.ringW * .34, 210), cx = g.cx, cy = g.ringY + R * .28;
  const pr = Math.max(2, R * .03);
  ctx.strokeStyle = C["line-faint"]; ctx.lineWidth = pr;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = C.accent;
  ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (state.play.pos / Math.max(1, state.play.len))); ctx.stroke();
  // the cover inside the dial
  const side = R * 1.18, ox = cx - side / 2, oy = cy - side / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, side, side); ctx.clip();
  ctx.drawImage(coverImage(a.hue), ox, oy, side, side);
  ctx.restore();
  ctx.strokeStyle = C["line-dim"]; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, side, side);
  // spectrum around the dial
  const t = performance.now() / 1000, n = 64;
  for (let i = 0; i < n; i++) {
    const ang = i / n * Math.PI * 2 - Math.PI / 2;
    const v = state.play.on ? Math.abs(Math.sin(i * .7 + t * 2.4)) * .8 + .1 : .06;
    const r0 = R + pr * 3, r1 = r0 + v * 44;
    ctx.strokeStyle = i % 8 === 0 ? C.accent : rgba(C.fg, .5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    ctx.stroke();
  }
  ctx.fillStyle = C.fg;
  ctx.font = "600 26px 'Geist Mono', monospace"; ctx.textAlign = "center";
  ctx.fillText(a.title, cx, cy + R + 74);
  ctx.fillStyle = C["text-muted"];
  ctx.font = "500 12px 'Geist Mono', monospace";
  ctx.fillText(`${mmss(state.play.pos)}  /  ${mmss(state.play.len)}`, cx, cy + R + 98);
  const l = LYRICS[Math.min(LYRICS.length - 1, Math.floor(state.play.pos / Math.max(1, state.play.len) * LYRICS.length))];
  ctx.fillStyle = C["fg-soft"];
  ctx.font = "400 15px 'Geist Mono', monospace";
  ctx.fillText(l.zh, cx, cy + R + 132);
  ctx.textAlign = "start";
}

/* =====================================================================================
   12 · PLAYLISTS
   ===================================================================================== */
function buildPlaylists() {
  state.playlists = [
    { name: "Default Playlist", rows: ALBUMS.map(a => ({ album: a, track: null })), count: 20059 },
    { name: "Archive · Album",  rows: null, count: null },
    { name: "Night Shelf",      rows: ALBUMS.filter(a => a.genre === "AMBIENT" || a.genre === "DRONE").map(a => ({ album: a, track: null })), count: null },
  ];
}
function playlistRows(pl) {
  if (pl.rows) return pl.rows;
  const a = currentAlbum();
  return a.tracks.map((t, i) => ({ album: a, track: t, ti: i }));
}
function renderPlaylists() {
  const list = document.getElementById("pl-list");
  list.replaceChildren(...state.playlists.map((p, i) => {
    const li = document.createElement("li");
    li.className = "mgr-row" + (i === state.pl ? " is-sel" : "");
    li.innerHTML = `<i>${String(i + 1).padStart(2, "0")}</i><span>${p.name === "Archive · Album" ? currentAlbum().title : p.name}</span><em>${p.count != null ? p.count.toLocaleString("en-US") : playlistRows(p).length}</em>`;
    li.addEventListener("click", () => { state.pl = i; syncPlaylists(); });
    return li;
  }));
  document.getElementById("pl-count").textContent = String(state.playlists.length).padStart(2, "0");
}
function syncPlaylists() {
  renderPlaylists();
  const pl = state.playlists[state.pl];
  const rows = playlistRows(pl);
  const total = rows.reduce((s, r) => s + (r.track ? r.track.len : r.album.length), 0);
  document.getElementById("pl-no").textContent = String(rows.length).padStart(3, "0");
  document.getElementById("pl-no2").textContent = String(state.pl + 1).padStart(3, "0");
  document.getElementById("pl-title").textContent = pl.name === "Archive · Album" ? `${currentAlbum().title}` : pl.name;
  document.getElementById("pl-meta").innerHTML =
    `${String(rows.length).padStart(3, "0")}&nbsp;TRACKS&nbsp;&nbsp;·&nbsp;&nbsp;${mmss(total)}&nbsp;&nbsp;·&nbsp;&nbsp;${Math.max(1, Math.round(total * .13))}&nbsp;MB`;
  document.getElementById("pl-playing").classList.toggle("is-on", state.play.on);
  document.getElementById("pl-playing").innerHTML = `${state.play.on ? "●" : "○"}&nbsp;PLAYING`;
  const box = document.getElementById("pl-rows");
  box.classList.toggle("is-index", state.plmode === "index");
  const frag = document.createDocumentFragment();
  let lastAlbum = null;
  rows.slice(0, 400).forEach((r, i) => {
    if (r.album !== lastAlbum) {
      lastAlbum = r.album;
      const gh = document.createElement("div");
      gh.className = "pl-group";
      gh.innerHTML = `<span>${r.album.artist} — ${r.album.title}</span><em>${r.album.year}&nbsp;&nbsp;FLAC&nbsp;24/96&nbsp;&nbsp;${String(r.album.tracks.length).padStart(2, "0")}&nbsp;TRK</em>`;
      frag.appendChild(gh);
    }
    const row = document.createElement("div");
    row.className = "pl-row" + (r.track && r.album === currentAlbum() && r.ti === state.track ? " is-sel" : "")
      + (r.album === currentAlbum() && (!r.track || r.ti === state.track) ? " is-playing" : "");
    row.innerHTML =
      `<span class="c-no">${String(r.track ? r.track.no : i + 1).padStart(2, "0")}</span>
       <span class="c-title">${r.track ? r.track.name : r.album.title}</span>
       <span class="c-artist">${r.album.artist}</span>
       <span class="c-time">${mmss(r.track ? r.track.len : r.album.length)}</span>
       <span class="c-pos">${String(i + 1).padStart(3, "0")}</span>`;
    row.addEventListener("click", () => {
      selectAlbum(r.album);
      if (r.track) state.track = r.ti;
      state.play.pos = 0; syncPlaylists(); syncTransport(); syncLyrics();
    });
    row.addEventListener("dblclick", () => { state.play.on = true; syncTransport(); });
    frag.appendChild(row);
  });
  box.replaceChildren(frag);
}

/* =====================================================================================
   13 · LYRICS — the line list, the current line, the seek-by-line
   ===================================================================================== */
function renderLyrics() {
  const box = document.getElementById("ly-lines");
  box.replaceChildren(...LYRICS.map((l, i) => {
    const d = document.createElement("div");
    d.className = "ly-line";
    d.dataset.i = i;
    d.innerHTML = `<span class="l-time">${String(i + 1).padStart(2, "0")} ${mmss(state.play.len / LYRICS.length * i)}</span>
                   <span><span class="l-zh">${l.zh}</span><span class="l-en">${l.en}</span></span>`;
    d.addEventListener("click", () => { state.play.pos = state.play.len / LYRICS.length * i + .01; syncLyrics(); dirty = true; });
    return d;
  }));
}
function lyricIndex() {
  const L = Math.max(1, state.play.len);
  return Math.min(LYRICS.length - 1, Math.floor(state.play.pos / L * LYRICS.length));
}
let lastLyric = -1;
function syncLyrics() {
  const cur = lyricIndex();
  if (cur !== lastLyric) {
    const box = document.getElementById("ly-lines");
    [...box.children].forEach((el, i) => {
      el.classList.toggle("is-cur", i === cur);
      el.classList.toggle("is-past", i < cur);
    });
    const el = box.children[cur];
    if (el && state.view === "lyrics") el.scrollIntoView({ block: "center", behavior: "smooth" });
    lastLyric = cur;
  }
  document.getElementById("ly-foot").innerHTML = `LYRICS&nbsp;/&nbsp;LRC&nbsp;·&nbsp;LINE&nbsp;${String(cur + 1).padStart(2, "0")}&nbsp;OF&nbsp;${String(LYRICS.length).padStart(2, "0")}`;
  document.getElementById("ly-session").textContent = mmssLong(state.play.pos + 112);
  const next = ALBUMS[(currentAlbum().idx + 1) % ALBUMS.length];
  document.getElementById("ly-next").innerHTML = `${String(next.tracks.length).padStart(3, "0")}&nbsp;${next.genre}`;
}

/* =====================================================================================
   14 · THE PROFILE PANEL (playlists + lyrics) — the front-on case, hero-frost + cover
   ===================================================================================== */
function profileHTML() {
  return `
    <div class="prof-head"><span class="sec-head"><span class="sq"></span>SIGNAL&nbsp;PROFILE</span>
      <span class="chip chip-pl" id="prof-file"></span></div>
    <div class="prof-hero"><canvas width="700" height="700"></canvas></div>
    <div class="prof-now"><span class="chip chip-pl is-on">●&nbsp;NOW&nbsp;PLAYING</span>
      <span class="chip chip-pl">HI-RES</span><span id="prof-idx"></span></div>
    <div class="prof-title" id="prof-title"></div>
    <div class="prof-line"><span class="sq"></span>TRACK&nbsp;INFORMATION&nbsp;LOADED</div>
    <div class="prof-line"><span id="prof-artist"></span><span id="prof-meta"></span></div>
    <div class="prof-sub"><span>PROFILE</span> <span id="prof-arc"></span></div>
    <div class="prof-block">
      <div class="prof-kv">
        <div><i>FORMAT</i><b>FLAC</b></div><div><i>BITRATE</i><b id="prof-bitrate"></b></div>
        <div><i>PLAYS</i><b id="prof-plays"></b></div><div><i>GAIN</i><b>—</b></div>
      </div>
    </div>
    <div class="prof-block">
      <div class="prof-block-head"><span>QUEUE&nbsp;/&nbsp;NEXT</span><span id="prof-que"></span></div>
      <div id="prof-queue"></div>
    </div>`;
}
function initProfiles() {
  for (const id of ["prof-playlists", "prof-lyrics"]) {
    const host = document.getElementById(id);
    host.innerHTML = profileHTML();
    host.querySelector(".prof-sub").style.display = "flex";
    host.querySelector(".prof-sub").style.justifyContent = "space-between";
    host.querySelector(".prof-sub").style.fontSize = "10.5px";
    host.querySelector(".prof-sub").style.letterSpacing = ".2em";
  }
}
function syncProfiles() {
  const a = currentAlbum();
  for (const id of ["prof-playlists", "prof-lyrics"]) {
    const host = document.getElementById(id);
    if (!host || !host.firstChild) continue;
    host.querySelector("#prof-file").textContent = "FILE " + String(a.idx + 1).padStart(3, "0");
    host.querySelector("#prof-title").textContent = a.title;
    host.querySelector("#prof-artist").textContent = a.artist.toUpperCase().replace(/\./g, "");
    host.querySelector("#prof-meta").textContent = `${a.year}  ·  ${a.genre}  ·  ${String(a.tracks.length).padStart(2, "0")} TRK`;
    host.querySelector("#prof-arc").textContent = a.arc;
    host.querySelector("#prof-bitrate").textContent = a.bitrate;
    host.querySelector("#prof-plays").textContent = a.plays;
    host.querySelector("#prof-idx").textContent = `${String(state.track + 1).padStart(2, "0")} / ${String(a.tracks.length).padStart(2, "0")}`;
    host.querySelector("#prof-que").textContent = String(Math.max(0, a.tracks.length - state.track - 1)).padStart(2, "0");
    const q = host.querySelector("#prof-queue");
    q.replaceChildren(...a.tracks.map((t, i) => {
      if (i <= state.track) return null;
      const d = document.createElement("div");
      d.className = "que-row";
      d.innerHTML = `<span class="c-no">${String(t.no).padStart(3, "0")}</span><span class="c-title">${t.name}</span><span class="c-time">${mmss(t.len)}</span>`;
      d.addEventListener("click", () => { state.track = i; state.play.pos = 0; syncAll(); });
      return d;
    }).filter(Boolean));
    drawProfileCase(host.querySelector(".prof-hero canvas"));
  }
}
function drawProfileCase(cv) {
  if (!cv) return;
  const g = cv.getContext("2d"), S = cv.width, a = currentAlbum();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  const k = S / HERO.res;
  const ox = 0, oy = 0;
  const q = HERO.cover.map(([x, y]) => [ox + x * k, oy + y * k]);
  g.save(); g.beginPath();
  g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]);
  g.closePath(); g.clip();
  g.drawImage(coverImage(a.hue), q[0][0], q[0][1], q[1][0] - q[0][0], q[3][1] - q[0][1]);
  g.restore();
  if (heroImg.complete && heroImg.naturalWidth) g.drawImage(heroImg, 0, 0, S, S);
  else if (heroImg.complete) g.drawImage(heroImg, 0, 0, S, S);
}

/* =====================================================================================
   15 · STYLE — 10 case skins, the 6 colour schemes × light / dark
   ===================================================================================== */
const heroCanvas = document.getElementById("st-hero");
function skinName(id) { const s = SKINS.find(s => s.id === id); return s ? s.name : "WHITE"; }
function skinDesc(id) { const s = SKINS.find(s => s.id === id); return s ? s.desc : ""; }
function renderStyle() {
  const wrap = document.getElementById("st-skins");
  const frag = document.createDocumentFragment();
  SKINS.forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "st-cell" + (s.id === state.skin ? " is-sel" : "");
    d.innerHTML = `<canvas width="420" height="420"></canvas>
      <div class="st-cell-foot"><i>${String(i + 1).padStart(2, "0")}</i>${s.name}${s.id === state.skin ? '<span class="badge">IN USE</span>' : ""}</div>`;
    d.addEventListener("click", () => { state.skin = s.id; syncStyle(); dirty = true; });
    frag.appendChild(d);
  });
  wrap.replaceChildren(frag);
  [...wrap.children].forEach((el, i) => drawMiniCase(el.querySelector("canvas"), SKINS[i].id));

  const sw = document.getElementById("st-schemes");
  const frag2 = document.createDocumentFragment();
  SCHEME_IDS.forEach((id, i) => {
    const sc = SCHEMES[id];
    const d = document.createElement("div");
    d.className = "st-scheme" + (id === state.scheme ? " is-sel" : "");
    const side = m => {
      const t = sc[m];
      return `<div style="background:${t.bg};color:${t.fg}">
        <span class="b" style="background:${t.fg}"></span>
        <i style="background:${t["text-muted"]}"></i>
        <i style="background:${t["line-faint"]}"></i>
        <i style="background:${t.accent};width:60%"></i>
        <i style="background:${t.hair};width:80%"></i>
      </div>`;
    };
    d.innerHTML = `<div class="st-sw">${side("light")}${side("dark")}</div>
      <div class="st-scheme-foot"><i>${String(i + 1).padStart(2, "0")}</i>${sc.name}${id === state.scheme ? '<span class="badge">IN USE</span>' : ""}</div>`;
    d.addEventListener("click", () => { applyTheme(id, state.mode); syncStyle(); dirty = true; rebuildCurrentView(); });
    frag2.appendChild(d);
  });
  sw.replaceChildren(frag2);
  document.getElementById("st-scheme-count").textContent = String(SCHEME_IDS.length).padStart(2, "0");
  document.getElementById("st-inuse-name").textContent = skinName(state.skin);
  document.getElementById("st-inuse-desc").textContent = skinDesc(state.skin);
  document.getElementById("st-inuse-foot").innerHTML =
    `CASE&nbsp;SKIN&nbsp;&nbsp;${String(SKINS.findIndex(s => s.id === state.skin) + 1).padStart(2, "0")}&nbsp;/&nbsp;${String(SKINS.length).padStart(2, "0")}`;
  document.getElementById("st-skin-chip").textContent = skinName(state.skin);
  document.getElementById("st-scheme-chip").textContent = SCHEMES[state.scheme].name;
  document.getElementById("st-mode-chip").textContent = state.mode.toUpperCase();
  document.getElementById("st-skin-count").textContent = String(SKINS.length).padStart(2, "0");
}
function syncStyle() {
  renderStyle();
  drawStyleHero();
  dirty = true;
}
function drawMiniCase(cv, skin) {
  if (!cv) return;
  const g = cv.getContext("2d"), S = cv.width;
  const k = S / CASE.res;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  g.fillStyle = C.bg; g.fillRect(0, 0, S, S);
  const a = currentAlbum();
  const ox = -CASE.origin[0] * k + S * .5 + 26, oy = -CASE.origin[1] * k + S * .66;
  const q = CASE.cover.map(([x, y]) => [ox + x * k, oy + y * k]);
  g.save(); g.beginPath();
  g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]);
  g.closePath(); g.clip();
  const dx = q[1][0] - q[0][0], dy = q[1][1] - q[0][1], ex = q[3][0] - q[0][0], ey = q[3][1] - q[0][1];
  g.transform(dx / 340, dy / 340, ex / 340, ey / 340, q[0][0], q[0][1]);
  g.drawImage(coverImage(a.hue), 0, 0);
  g.restore();
  const frost = skinImg(skin, "array-frost"), clear = skinImg(skin, "array-clear");
  if (frost.complete && frost.naturalWidth) g.drawImage(frost, ox, oy, CASE.res * k, CASE.res * k);
  if (clear.complete && clear.naturalWidth) g.drawImage(clear, ox, oy, CASE.res * k, CASE.res * k);
}
function drawStyleHero(t) {
  const S = heroCanvas.width, g = heroCanvas.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  g.fillStyle = C.bg; g.fillRect(0, 0, S, S);
  if (t != null) {
    // PLAY INTRO: the case pulled out of its shelf along the frames' own turn, on a plate
    const i = Math.min(INS.length - 1, Math.round(t * (INS.length - 1)));
    const M = INS[i], k = S / INS_RES * .95;
    const ox = S / 2 - INS_RES / 2 * k, oy = S / 2 - INS_RES / 2 * k;
    const cv2 = document.createElement("canvas"); cv2.width = cv2.height = 340;
    const cg = cv2.getContext("2d"); cg.drawImage(coverImage(currentAlbum().hue), 0, 0);
    const q = [[M[4], M[5]], [M[6], M[7]], [M[8], M[9]], [M[10], M[11]]].map(([x, y]) => [ox + x * k, oy + y * k]);
    g.save(); g.beginPath();
    g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]);
    g.closePath(); g.clip();
    g.transform((q[1][0]-q[0][0])/340, (q[1][1]-q[0][1])/340, (q[3][0]-q[0][0])/340, (q[3][1]-q[0][1])/340, q[0][0], q[0][1]);
    g.drawImage(cv2, 0, 0);
    g.restore();
    const im = inspectFrames[i];
    if (im && im.complete && im.naturalWidth) g.drawImage(im, ox + M[0] * k, oy + M[1] * k, M[2] * k, M[3] * k);
    else { loadInspectFrames(); g.fillStyle = C["text-muted"]; g.font = "500 12px 'Geist Mono', monospace"; g.textAlign = "center"; g.fillText("LOADING FRAMES …", S / 2, S - 18); g.textAlign = "start"; }
    return;
  }
  const k = S / CASE.res * 1.55;
  const ctr = [286, 292];                             // centre of the whole case box, in sprite units
  const ox = S * .5 - ctr[0] * k - 24, oy = S * .5 - ctr[1] * k;
  const q = CASE.cover.map(([x, y]) => [ox + x * k, oy + y * k]);
  g.save(); g.beginPath();
  g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]);
  g.closePath(); g.clip();
  g.transform((q[1][0]-q[0][0])/340, (q[1][1]-q[0][1])/340, (q[3][0]-q[0][0])/340, (q[3][1]-q[0][1])/340, q[0][0], q[0][1]);
  g.drawImage(coverImage(currentAlbum().hue), 0, 0);
  g.restore();
  const frost = skinImg(state.skin, "array-frost"), clear = skinImg(state.skin, "array-clear");
  if (frost.complete && frost.naturalWidth) g.drawImage(frost, ox, oy, CASE.res * k, CASE.res * k);
  if (clear.complete && clear.naturalWidth) g.drawImage(clear, ox, oy, CASE.res * k, CASE.res * k);
}
let introT = null;
function stepIntro(now) {
  if (introT == null) { introT = now; loadInspectFrames(); }
  const t = (now - introT) / 2600;
  if (t >= 1) { state.intro = false; introT = null; drawStyleHero(); return; }
  drawStyleHero(t);
}

/* =====================================================================================
   16 · TRANSPORT
   ===================================================================================== */
function syncTransport() {
  const a = currentAlbum();
  document.body.classList.toggle("is-playing", state.play.on);
  document.getElementById("tr-title").textContent = a.tracks[state.track] ? a.tracks[state.track].name : a.title;
  document.getElementById("tr-artist").textContent = a.artist;
  document.getElementById("tr-clock").textContent = mmss(state.play.pos);
  document.getElementById("tr-tail").textContent = "-" + mmss(Math.max(0, state.play.len - state.play.pos));
  const pct = Math.min(1, state.play.pos / Math.max(1, state.play.len));
  document.getElementById("tr-fill").style.width = (pct * 100) + "%";
  document.getElementById("tr-head").style.left = (pct * 100) + "%";
  document.getElementById("tr-shuffle").classList.toggle("is-on", state.play.shuffle);
  document.getElementById("tr-order").classList.toggle("is-on", state.play.order === 1);
  document.getElementById("tr-order").innerHTML = `<span class="bx"></span>${state.play.order ? "ORDER RANDOM" : "ORDER DEFAULT"}`;
  document.getElementById("tr-light").classList.toggle("is-on", state.mode === "light");
  document.getElementById("tr-dark").classList.toggle("is-on", state.mode === "dark");
  const v = document.getElementById("tr-vol");
  v.style.setProperty("--vol", state.play.vol + "%");
  document.getElementById("tr-vol-fill").style.width = state.play.vol + "%";
  document.getElementById("tr-vol-num").textContent = state.play.vol;
  document.getElementById("st-mode-chip") && (document.getElementById("st-mode-chip").textContent = state.mode.toUpperCase());
  drawThumb();
}
function drawThumb() {
  const cv = document.querySelector("#tr-thumb canvas");
  if (!cv) return;
  const g = cv.getContext("2d"), a = currentAlbum();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, 96, 96);
  g.drawImage(coverImage(a.hue), 0, 0, 96, 96);
}
function nextTrack(dir) {
  const a = currentAlbum();
  const rows = playlistRows(state.playlists[state.pl]);
  let i = rows.findIndex(r => r.album === a && (!r.track || r.ti === state.track));
  if (i < 0) i = 0;
  let n = i + dir;
  if (state.play.shuffle && dir > 0) n = (i + 7) % rows.length;
  n = (n + rows.length) % rows.length;
  const r = rows[n];
  selectAlbum(r.album);
  state.track = r.ti != null ? r.ti : 0;
  state.play.len = r.track ? r.track.len : r.album.length;
  state.play.pos = 0;
  syncAll();
}
function onTick() {
  syncTransport();
  if (state.view === "lyrics") syncLyrics();
  if (state.view === "playlists") {
    const rows = document.querySelectorAll(".pl-row");
    if (rows.length) {
      const idx = Math.floor(state.play.pos / Math.max(1, state.play.len) * rows.length);
      rows.forEach((r, i) => r.classList.toggle("is-sel", i === idx));
    }
  }
}
function initTransport() {
  document.getElementById("tr-play").addEventListener("click", () => {
    state.play.on = !state.play.on;
    if (state.play.on && !state.play.len) state.play.len = currentAlbum().length;
    syncAll(); dirty = true;
  });
  document.getElementById("tr-stop").addEventListener("click", () => {
    state.play.on = false; state.play.pos = 0; syncAll(); dirty = true;
  });
  document.getElementById("tr-prev").addEventListener("click", () => {
    if (state.play.pos > 3) { state.play.pos = 0; syncAll(); } else nextTrack(-1);
  });
  document.getElementById("tr-next").addEventListener("click", () => nextTrack(1));
  const bar = document.getElementById("tr-bar");
  const seek = e => {
    const r = bar.getBoundingClientRect();
    state.play.pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * state.play.len;
    syncTransport(); if (state.view === "lyrics") syncLyrics(); dirty = true;
  };
  let drag = false;
  bar.addEventListener("mousedown", e => { drag = true; seek(e); });
  window.addEventListener("mousemove", e => { if (drag) seek(e); });
  window.addEventListener("mouseup", () => { drag = false; });
  const vol = document.getElementById("tr-vol");
  const setVol = e => {
    const r = vol.getBoundingClientRect();
    state.play.vol = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100);
    syncTransport();
  };
  let vdrag = false;
  vol.addEventListener("mousedown", e => { vdrag = true; setVol(e); });
  window.addEventListener("mousemove", e => { if (vdrag) setVol(e); });
  window.addEventListener("mouseup", () => { vdrag = false; });
  document.getElementById("tr-shuffle").addEventListener("click", () => {
    state.play.shuffle = !state.play.shuffle; syncTransport();
  });
  document.getElementById("tr-order").addEventListener("click", () => {
    state.play.order = state.play.order ? 0 : 1; syncTransport();
  });
  for (const id of ["tr-light", "tr-dark"]) {
    document.getElementById(id).addEventListener("click", () => setMode(id === "tr-dark" ? "dark" : "light"));
  }
}

/* =====================================================================================
   17 · ROUTER + rebuilt-on-theme-change views
   ===================================================================================== */
function setView(v, opts) {
  if (!STATUS_LABEL[v]) v = "archive";
  state.view = v;
  document.body.dataset.view = v;
  document.body.dataset.layout = state.layout;
  for (const b of document.querySelectorAll(".nav-item")) b.classList.toggle("is-active", b.dataset.view === v);
  const arr = v === "archive" && state.layout === "array";
  document.getElementById("shelf-switch").style.display = arr ? "" : "none";
  document.getElementById("ruler").style.display = arr ? "" : "none";
  document.getElementById("select-numeral").style.display = arr ? "" : "none";
  document.getElementById("toolrow").style.display = v === "archive" ? "" : "none";
  document.getElementById("grid-head").style.display = v === "archive" && state.layout === "grid" ? "" : "none";
  document.getElementById("grid-scroll").style.display = v === "archive" && state.layout === "grid" ? "" : "none";
  document.getElementById("info").style.display = v === "archive" ? "" : "none";
  document.getElementById("search-wrap").style.display = v === "archive" ? "" : "none";
  if (v === "archive" && state.layout === "grid") renderGrid();
  if (v === "playlists") syncPlaylists();
  if (v === "lyrics") { renderLyrics(); lastLyric = -1; syncLyrics(); }
  if (v === "style") syncStyle();
  syncGroupPanel();
  dirty = true;
  updateURL();
}
function rebuildCurrentView() {
  document.body.classList.toggle("is-playing", state.play.on);
  if (state.view === "style") syncStyle();
  if (state.view === "playlists") syncPlaylists();
  if (state.view === "archive" && state.layout === "grid") renderGrid();
}
function setMode(m) { applyTheme(state.scheme, m); document.body.dataset.mode = m; syncTransport(); rebuildCurrentView(); dirty = true; rebuildAllCanvases(); updateURL(); }
function rebuildAllCanvases() { syncProfiles(); if (state.view === "style") syncStyle(); }
function updateURL() {
  const p = new URLSearchParams();
  if (state.view !== "archive") p.set("view", state.view);
  if (state.layout === "grid") p.set("layout", "grid");
  if (state.scheme !== "archive") p.set("scheme", state.scheme);
  if (state.mode !== "dark") p.set("mode", state.mode);
  if (state.skin !== "white") p.set("skin", state.skin);
  if (state.unit !== "albums") p.set("unit", state.unit);
  if (state.group !== "genre") p.set("group", state.group);
  if (state.sort !== "artist") p.set("sort", state.sort);
  const s = p.toString();
  history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
}

/* =====================================================================================
   18 · MENU POPOVER + the INSPECT overlay
   ===================================================================================== */
const pop = document.getElementById("menu-pop");
function toggleMenu(open) {
  const on = open ?? !pop.classList.contains("is-open");
  pop.classList.toggle("is-open", on);
  document.getElementById("menu-btn").setAttribute("aria-expanded", String(on));
}
const inspEl = document.getElementById("inspect");
function openInspect() {
  const it = currentItem();
  if (!it || !it.album) return;
  const a = it.album;
  const p = plateAnchor || { ox: 0, oy: 0 };
  state.insp = { album: a, e: 0, back: false, start: performance.now(), from: [p.ox + CASE.center[0] * K, p.oy + CASE.center[1] * K] };
  inspEl.hidden = false;
  document.body.classList.add("is-inspecting");
  document.getElementById("insp-arc").textContent = a.arc;
  const role = it.track ? `${String(it.track.no).padStart(2, "0")} TRACKS` : `FLAC 24/96`;
  document.getElementById("insp-sub").innerHTML =
    `${role}&nbsp;&nbsp;·&nbsp;&nbsp;<b>${a.title}</b>&nbsp;&nbsp;·&nbsp;&nbsp;${a.genre}`;
  loadInspectFrames();
  dirty = true;
}
function closeInspect() {
  if (!state.insp || state.insp.back) return;
  state.insp.back = true; state.insp.start = performance.now();
  dirty = true;
}
function closeInspectNow() {
  state.insp = null;
  inspEl.hidden = true;
  document.body.classList.remove("is-inspecting");
  dirty = true;
}
function positionInspectText() {
  const insp = state.insp;
  if (!insp || !insp.rect) return;
  const t = document.getElementById("insp-text");
  t.style.left = insp.rect.x + "px";
  t.style.top = Math.max(96, insp.rect.y - 52) + "px";
  const b = document.getElementById("insp-back");
  b.style.left = insp.rect.x + "px";
  b.style.top = Math.min(window.innerHeight - 110, insp.rect.y + insp.rect.h + 18) + "px";
}

/* =====================================================================================
   19 · WIRING
   ===================================================================================== */
function initControls() {
  // navigation
  for (const b of document.querySelectorAll(".nav-item"))
    b.addEventListener("click", () => setView(b.dataset.view));
  // toolbar: SHOW / LAYOUT / GROUP / SORT
  for (const b of document.querySelectorAll("#toolrow .tool"))
    b.addEventListener("click", () => {
      const k = b.dataset.key, v = b.dataset.val;
      if (state[k] === v) return;
      state[k] = v;
      if (k === "layout") { setView("archive"); markTools(); rebuildCurrentView(); }
      else {
        applyFilter();
        if (k === "group") { state.gi = 0; state.sel = { row: 0, slot: 0 }; }
        if (k === "unit") { state.sel = { row: 0, slot: 0 }; }
        state.lifts.clear();
        markTools();
        syncAll();
        if (state.layout === "grid" && state.view === "archive") renderGrid();
        dirty = true;
      }
      updateURL();
    });
  // playlist page LAYOUT tabs
  for (const b of document.querySelectorAll("[data-key='plmode']"))
    b.addEventListener("click", () => { state.plmode = b.dataset.val; markTools(); syncPlaylists(); });
  // signal MODEL
  for (const b of document.querySelectorAll("[data-key='model']"))
    b.addEventListener("click", () => { state.model = b.dataset.val; markTools(); dirty = true; });
  // MODE chips anywhere (style view + transport)
  for (const b of document.querySelectorAll("[data-key='mode']"))
    b.addEventListener("click", () => setMode(b.dataset.val));

  // search
  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    state.filter = search.value;
    applyFilter();
    document.getElementById("search-wrap").classList.toggle("is-hit", !!state.filter.trim());
    if (state.gi >= groups().length) state.gi = 0;
    state.sel = { row: 0, slot: 0 };
    if (filtered.length) state.album = filtered[0].idx;
    state.lifts.clear();
    if (state.view !== "archive") setView("archive");
    if (state.layout === "grid") renderGrid();
    syncAll(); dirty = true;
  });
  search.addEventListener("keydown", e => { if (e.key === "Escape") { search.value = ""; search.dispatchEvent(new Event("input")); search.blur(); } });

  // shelf navigation
  document.getElementById("shelf-go").addEventListener("click", () => moveGroup(1));
  document.getElementById("shelf-prev").addEventListener("click", () => moveGroup(-1));
  document.getElementById("ruler-up").addEventListener("click", () => moveGroup(-1));
  document.getElementById("ruler-down").addEventListener("click", () => moveGroup(1));

  // canvas interaction
  canvas.addEventListener("mousemove", e => {
    if (state.view !== "archive" || state.layout !== "array" || state.insp) return;
    const hit = hitTest(e.offsetX, e.offsetY);
    const cur = state.hover;
    if ((hit && (!cur || hit.row !== cur.row || hit.slot !== cur.slot)) || (!hit && cur)) {
      state.hover = hit;
      canvas.style.cursor = hit ? "pointer" : "default";
      dirty = true;
    }
  });
  canvas.addEventListener("click", e => {
    if (state.view === "signal") {
      const g = signalGeom(), x0 = g.cx - g.traceW / 2;
      if (e.offsetY > g.traceY - 30) {
        state.play.pos = Math.max(0, Math.min(1, (e.offsetX - x0) / g.traceW)) * state.play.len;
        syncAll();
      }
      return;
    }
    const hit = hitTest(e.offsetX, e.offsetY);
    if (hit) selectAt(hit.row, hit.slot);
  });
  canvas.addEventListener("dblclick", e => {
    if (state.view !== "archive" || state.layout !== "array") return;
    const hit = hitTest(e.offsetX, e.offsetY);
    if (hit) { selectAt(hit.row, hit.slot); openInspect(); }
  });

  // info panel actions
  document.getElementById("btn-play-album").addEventListener("click", () => {
    state.play.on = true; state.play.pos = 0; state.play.len = currentAlbum().length;
    syncAll(); dirty = true;
  });
  document.getElementById("btn-open-album").addEventListener("click", () => {
    state.pl = 1; setView("playlists"); syncPlaylists();
  });

  // menu popover
  document.getElementById("menu-btn").addEventListener("click", e => { e.stopPropagation(); toggleMenu(); });
  document.getElementById("pop-x").addEventListener("click", e => { e.stopPropagation(); toggleMenu(false); });
  pop.addEventListener("click", e => e.stopPropagation());
  document.addEventListener("click", () => toggleMenu(false));

  // inspect overlay
  document.getElementById("insp-back").addEventListener("click", closeInspect);
  inspEl.addEventListener("click", e => { if (e.target === inspEl) closeInspect(); });

  // style view: PLAY INTRO
  document.getElementById("st-intro").addEventListener("click", () => { state.intro = true; introT = null; });

  // playlists: NEW PLAYLIST — a real playlist made of the selected album's tracks
  document.getElementById("pl-new").addEventListener("click", () => {
    const a = currentAlbum();
    state.playlists.push({ name: `Shelf ${String(state.playlists.length + 1).padStart(2, "0")} · ${a.genre}`, rows: null, count: null, album: a });
    state.pl = state.playlists.length - 1;
    syncPlaylists();
  });
  document.getElementById("pl-playing").addEventListener("click", () => {
    state.play.on = !state.play.on; syncAll(); dirty = true;
  });

  window.addEventListener("resize", () => {
    resize(); gridGeometry();
    if (state.layout === "grid" && state.view === "archive") renderGrid();
    syncProfiles(); drawThumb();
    if (state.view === "style") syncStyle();
    dirty = true;
  });
  window.addEventListener("keydown", onKey);
}
function markTools() {
  for (const b of document.querySelectorAll("[data-key]")) {
    const k = b.dataset.key, v = b.dataset.val;
    if (k === "mode") { b.classList.toggle("is-on", state.mode === v); continue; }
    if (k === "plmode") { b.classList.toggle("is-on", state.plmode === v); continue; }
    if (k === "model") { b.classList.toggle("is-on", state.model === v); continue; }
    b.classList.toggle("is-on", state[k] === v);
  }
}
function moveGroup(dir) {
  const gs = groups();
  const n = Math.min(Math.max(0, state.gi + dir), Math.max(0, gs.length - 1));
  if (n === state.gi) return;
  state.gi = n;
  state.sel = { row: 0, slot: 0 };
  state.lifts.clear();
  const it = itemAt(0, 0);
  if (it) state.album = it.album.idx;
  syncAll();
  if (state.layout === "grid") {
    const secs = gridBody.querySelectorAll(".grid-sec");
    if (secs[n]) secs[n].scrollIntoView({ block: "start", behavior: "smooth" });
  }
  animateLift();
  updateURL();
}
function onKey(e) {
  if (e.target.tagName === "INPUT") return;
  const k = e.key;
  if (k === "Escape") { if (state.insp) { closeInspect(); return; } if (pop.classList.contains("is-open")) { toggleMenu(false); return; } document.getElementById("tr-stop").click(); return; }
  if (k === "1" || k === "2" || k === "3" || k === "4" || k === "5") { setView(["archive","playlists","lyrics","signal","style"][Number(k) - 1]); return; }
  if (k === "g" || k === "G") { state.layout = state.layout === "array" ? "grid" : "array"; markTools(); setView("archive"); rebuildCurrentView(); updateURL(); return; }
  if (k === "d" || k === "D") { setMode(state.mode === "dark" ? "light" : "dark"); return; }
  if (k === "/") { e.preventDefault(); document.getElementById("search").focus(); return; }
  if (k === " ") { e.preventDefault(); document.getElementById("tr-play").click(); return; }
  if (k === ",") { document.getElementById("tr-prev").click(); return; }
  if (k === ".") { document.getElementById("tr-next").click(); return; }
  if (k === "Enter" && state.view === "archive") { openInspect(); return; }
  if (state.view !== "archive" || state.layout !== "array") return;
  if (k === "ArrowRight") { const p = shelfPlan().rows[state.sel.row]; if (p && state.sel.slot + 1 < p.count) selectAt(state.sel.row, state.sel.slot + 1); }
  if (k === "ArrowLeft")  { if (state.sel.slot > 0) selectAt(state.sel.row, state.sel.slot - 1); }
  if (k === "ArrowUp") moveGroup(-1);
  if (k === "ArrowDown") moveGroup(1);
}

/* =====================================================================================
   20 · BOOT
   ===================================================================================== */
function initClock() {
  const tick = () => {
    const d = new Date();
    document.querySelector(".clock-time").textContent =
      [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
    const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    document.querySelector(".clock-date").textContent =
      `${days[d.getDay()]} · ${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  tick(); setInterval(tick, 1000);
}
function boot() {
  applyTheme(state.scheme, state.mode);
  document.body.dataset.mode = state.mode;
  buildPlaylists();
  applyFilter();
  initProfiles();
  initTransport();
  initClock();
  const ghost = document.createElement("div");
  ghost.id = "info-ghost";
  ghost.style.cssText = "position:absolute;right:8px;bottom:96px;font-size:150px;font-weight:600;letter-spacing:.02em;color:var(--line-faint);opacity:.28;pointer-events:none;z-index:3";
  document.getElementById("view-archive").appendChild(ghost);
  state.album = 4;
  const gs = groups();
  state.gi = Math.min(2, Math.max(0, gs.length - 1));
  let at = groupItems(gs[state.gi]).findIndex(it => it.album.idx === state.album);
  if (at < 0) { state.gi = 0; at = 0; }
  state.sel = { row: Math.floor(at / SLOTS), slot: at % SLOTS };
  state.album = itemAt(state.sel.row, state.sel.slot).album.idx;
  if (state.filter) { const el = document.getElementById("search"); el.value = state.filter; applyFilter();
    document.getElementById("search-wrap").classList.add("is-hit"); }
  state.play.len = currentAlbum().length;
  if (state.play.pos > state.play.len) state.play.pos = 0;
  resize();
  state.lifts.set(state.sel.row + ":" + state.sel.slot, 1);
  const [sx, sy] = toScreen(0, state.sel.slot * PITCH, 0);
  plateAnchor = { ox: sx - CASE.origin[0] * K, oy: sy - CASE.origin[1] * K, album: currentAlbum() };
  initControls();
  markTools();
  syncAll();
  setView(state.view);
  if (qs.get("inspect") === "1" && state.view === "archive") { openInspect(); state.insp.e = .999; }
  if (qs.get("menu") === "1") toggleMenu(true);
  document.getElementById("pop-source").innerHTML =
    "foobar2000 theme <b>RhinE</b> · sprites from <i>theme/assets/render/</i> · tokens from <i>theme/tokens/tokens.json</i> · " +
    "array &amp; grid logic from <i>theme/js/archive.js</i> + <i>grid.js</i> · 6 schemes × light/dark, 10 case skins.";
  requestAnimationFrame(pump);
}
window.addEventListener("load", boot);
