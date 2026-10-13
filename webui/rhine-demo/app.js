/* RhinE · HTML translation — isometric archive array.
   Projection & geometry ported 1:1 from the theme's js/archive.js + assets/render/case/aurora/case.json. */
"use strict";

// ============ 几何参数（出自 case.json / archive.js）============
const CASE = {
  res: 600,
  origin: [300, 431.62],          // 世界原点在精灵内的锚点
  center: [300, 300],
  cover:  [[148.6,136.66],[369.09,239.25],[369.09,448.34],[148.6,345.74]],   // 封面四边形（精灵坐标）
  label:  [[381.6,328.88],[424.43,348.81],[424.43,372.88],[381.6,352.95]],   // 书脊标签
  axes: { x: [79.31, 36.9], y: [57.56, -50.85], z: [0, -75.21] },            // 世界轴 → 屏幕方向
};
const RAIL = { res: 900, origin: [450, 581.62] };
const PITCH = 1.0;        // 同排槽位间距（世界 y）
const ROWP  = 4.7;        // 相邻架子间距（世界 x）
const SLOTS = 20;         // 每架槽位数
const CLOSE = [.45, -.62, .64];   // 后始排序向量
const LIFT_OUT = 2.2;     // 选中盒上浮高度（世界单位）

// ============ 演示数据：5 架 × 20 盒 ============
const TITLES = ["Field Recordings Vol. 2","Tidal Harbour","Signal Drift","Glass Rooms","Night Ferries","Cold Front","Index","Harbour Lights","Static Bloom","Aurora Study","Low Orbit","Pale Deck","Night Watch","Quiet Engine","Salt Air","Beacon","Still Water","North Light","Slow Signal","End of Archive"];
const ARTISTS = ["ILSE MARTEN","R. OKONKWO","HALDANE","M. SERRA","VELA","K. ONO","BRENT","ARNO","S. LI","FEN","MAER","ODA","RUSK","KETE","LOM","———","VOSS","BEL","IRA","NUL"];
const SCHEMES = [[28,90,32],[210,60,20],[160,40,28],[280,70,25],[0,0,0],[45,80,30],[190,90,15],[320,50,25]];
const N_COVER_HUES = 24;

const ALBUMS = [];
for (let i = 0; i < 100; i++) {
  ALBUMS.push({
    no: 1012 - i,
    title: TITLES[i % TITLES.length],
    artist: ARTISTS[(i * 7) % ARTISTS.length],
    hue: (i * 37) % 360,
    tracks: 4 + (i % 9),
  });
}

// ============ 封面生成 ============
const coverCache = new Map();
function coverImage(hue) {
  if (coverCache.has(hue)) return coverCache.get(hue);
  const c = document.createElement("canvas");
  c.width = c.height = 340;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 340, 340);
  grd.addColorStop(0, `hsl(${hue} 62% 66%)`);
  grd.addColorStop(.55, `hsl(${(hue + 24) % 360} 58% 50%)`);
  grd.addColorStop(1, `hsl(${(hue + 48) % 360} 52% 34%)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 340, 340);
  // 装饰：原版封面是实拍/设计图；演示用几何构图，透过磨砂仍可辨识颜色
  g.fillStyle = "rgba(11,11,11,.78)";
  g.beginPath(); g.arc(238, 96, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(11,11,11,.55)";
  g.fillRect(30, 210, 190, 12);
  g.fillRect(30, 236, 130, 12);
  g.fillStyle = "rgba(242,240,234,.95)";
  g.font = "600 28px 'Geist Mono', monospace";
  g.fillText(String((hue * 7) % 997), 30, 300);
  g.strokeStyle = "rgba(11,11,11,.45)"; g.lineWidth = 2;
  g.strokeRect(18, 18, 304, 304);
  coverCache.set(hue, c);
  return c;
}

// ============ 画布 ============
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const imgFrost = new Image(); imgFrost.src = "assets/case/array-frost.png";
const imgClear = new Image(); imgClear.src = "assets/case/array-clear.png";
const imgRail  = new Image(); imgRail.src  = "assets/rail/rail-mid.png";

let W = 0, H = 0, K = 1, OX = 0, OY = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  K = H / 1000;                      // 尺度：以 1080p 视觉为基准
  OX = W * 0.43;                     // 原点（世界 0,0 的屏幕位置）
  OY = H * 0.80;
  render();
}

// 世界坐标 → 屏幕
function toScreen(wx, wy, wz) {
  const a = CASE.axes;
  return [
    OX + (wx * a.x[0] + wy * a.y[0] + wz * a.z[0]) * K,
    OY + (wx * a.x[1] + wy * a.y[1] + wz * a.z[1]) * K,
  ];
}

// 封面贴图：平行四边形仿射
function quadImage(img, quad, ox, oy) {
  const p = quad.map(([x, y]) => [ox + x * K, oy + y * K]);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]);
  ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
  ctx.closePath(); ctx.clip();
  ctx.setTransform(
    (p[1][0] - p[0][0]) / img.width, (p[1][1] - p[0][1]) / img.width,
    (p[3][0] - p[0][0]) / img.height, (p[3][1] - p[0][1]) / img.height,
    p[0][0], p[0][1],
  );
  ctx.drawImage(img, 0, 0);
  ctx.setTransform(window.devicePixelRatio > 1 ? window.devicePixelRatio : 1, 0, 0, window.devicePixelRatio > 1 ? window.devicePixelRatio : 1, 0, 0);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.restore();
}

// ============ 状态 ============
const state = {
  shelf: 3,                 // 前景架子序号（0 = 最近）
  counts: [14, 20, 20, 20, 20],   // 每架盒数（近架留个空位更像原图）
  sel: { row: 0, slot: 4 },
  hover: null,
  lifts: new Map(),         // key:row:slot → 当前上浮量 0..1
};
const SHELF_ROWS = 5;
const keyOf = (row, slot) => row + ":" + slot;

function albumOf(row, slot) { return ALBUMS[(row * SLOTS + slot) % ALBUMS.length]; }

// ============ 渲染 ============
function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, W, H);

  drawFloor();

  // 架子从远到近
  for (let pos = SHELF_ROWS - 1; pos >= 0; pos--) {
    drawShelf(pos);
  }
  drawSelectionPlate();
}

function rowAlpha(pos) {   // 近架清晰，远架融入背景
  return [1, .82, .58, .40, .28][pos] ?? .2;
}
function rowTint(pos) { return pos === 0 ? 0 : Math.min(.72, .22 * pos); }

function drawFloor() {
  // 简化地板：一条从架子底延伸的暗色地平线 + 微光
  const [x0, y0] = toScreen(-SHELF_ROWS * ROWP - 6, -4, -0.02);
  const [x1, y1] = toScreen(-SHELF_ROWS * ROWP - 6, SLOTS + 6, -0.02);
  const [x2, y2] = toScreen(6, SLOTS + 14, -0.02);
  const [x3, y3] = toScreen(6, -12, -0.02);
  const g = ctx.createLinearGradient(0, y1, 0, y2);
  g.addColorStop(0, "rgba(22,22,21,.9)");
  g.addColorStop(1, "rgba(13,13,13,.0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
  ctx.closePath(); ctx.fill();
}

function drawShelf(pos) {
  const wx = -pos * ROWP;
  const alpha = rowAlpha(pos);
  const tint = rowTint(pos);

  // 导轨（整条）
  if (imgRail.complete) {
    const [sx, sy] = toScreen(wx, -0.4, 0);
    const ox = sx - RAIL.origin[0] * K, oy = sy - RAIL.origin[1] * K;
    const S = RAIL.res * K;
    ctx.globalAlpha = alpha;
    ctx.drawImage(imgRail, ox, oy, S, S);
    ctx.globalAlpha = 1;
  }

  // 盒子：按 close 升序（后 → 前）
  const items = [];
  const n = state.counts[pos] ?? SLOTS;
  for (let s = 0; s < n; s++) {
    const lift = state.lifts.get(keyOf(pos, s)) ?? 0;
    const z = LIFT_OUT * lift * 0.3;
    const y = s * PITCH;
    items.push({ s, y, z, close: CLOSE[1] * y + CLOSE[2] * z * .2 });
  }
  items.sort((a, b) => a.close - b.close);

  for (const it of items) {
    drawCase(pos, it.s, it.y, it.z, alpha, tint, w => { it.ox = w.ox; it.oy = w.oy; }, items);
  }
}

function drawCase(pos, slot, wy, wz, alpha, tint, done) {
  const wx = -pos * ROWP;
  const [sx, sy] = toScreen(wx, wy, wz);
  const ox = sx - CASE.origin[0] * K;
  const oy = sy - CASE.origin[1] * K;
  const S = CASE.res * K;
  if (oy > H + S || ox > W + S || ox < -S * 1.4 || oy + S < -80) { done({ ox, oy }); return; }

  ctx.save();
  ctx.globalAlpha = alpha;

  // 1) 封面（在盒壳之下，透过窗口显示）
  const a = albumOf(pos, slot);
  quadImage(coverImage(a.hue), CASE.cover, ox, oy);

  // 2) 盒壳
  if (imgFrost.complete) ctx.drawImage(imgFrost, ox, oy, S, S);
  if (tint > 0) {
    ctx.save();
    ctx.globalAlpha = alpha * tint;
    ctx.fillStyle = "#0b0b0b";
    quadImageFill(CASE.cover, ox, oy);
    ctx.restore();
  }
  if (imgClear.complete) ctx.drawImage(imgClear, ox, oy, S, S);

  // 3) hover 高亮
  if (state.hover && state.hover.row === pos && state.hover.slot === slot) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ff7a01";
    ctx.lineWidth = 2;
    strokeQuad(CASE.cover, ox, oy);
  }
  ctx.restore();
  done({ ox, oy });
}

function quadImageFill(quad, ox, oy) {
  const p = quad.map(([x, y]) => [ox + x * K, oy + y * K]);
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]);
  ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
  ctx.closePath(); ctx.fill();
}

function strokeQuad(quad, ox, oy) {
  const p = quad.map(([x, y]) => [ox + x * K, oy + y * K]);
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]);
  ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]);
  ctx.closePath(); ctx.stroke();
}

// 选中盒的标签板（ARC-####）
let plateAnchor = null;
function drawSelectionPlate() {
  if (!plateAnchor) return;
  const { ox, oy, album } = plateAnchor;
  const top = CASE.cover[1];
  const x1 = ox + top[0] * K + 4, y1 = oy + top[1] * K - 4;
  const lx = x1 + 26, ly = y1 - 26;
  ctx.strokeStyle = "#f2f0ea";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(lx, ly); ctx.lineTo(lx + 54, ly);
  ctx.stroke();
  ctx.font = "500 12px 'Geist Mono', monospace";
  ctx.textBaseline = "middle";
  const text = `ARC-${String(album.no).padStart(4, "0")}`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = "#f2f0ea";
  ctx.fillRect(lx + 54, ly - 9, tw + 16, 18);
  ctx.fillStyle = "#0b0b0b";
  ctx.fillText(text, lx + 62, ly + 1);
}

// ============ 命中检测（点是否在 cover 四边形内）============
function inQuad(px, py, quad, ox, oy) {
  const p = quad.map(([x, y]) => [ox + x * K, oy + y * K]);
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function hitTest(px, py) {
  // 从近到远：pos 小优先，同架 y 小优先（后画的在上）
  for (let pos = 0; pos < SHELF_ROWS; pos++) {
    const n = state.counts[pos] ?? SLOTS;
    for (let s = n - 1; s >= 0; s--) {
      const lift = state.lifts.get(keyOf(pos, s)) ?? 0;
      const [sx, sy] = toScreen(-pos * ROWP, s * PITCH, LIFT_OUT * lift * 0.3);
      const ox = sx - CASE.origin[0] * K, oy = sy - CASE.origin[1] * K;
      if (inQuad(px, py, CASE.cover, ox, oy)) return { row: pos, slot: s, ox, oy };
    }
  }
  return null;
}

// ============ 交互 ============
let anim = null;
function animateLift() {
  cancelAnimationFrame(anim);
  const tick = () => {
    let busy = false;
    for (const [key] of state.lifts) {
      const [r, s] = key.split(":").map(Number);
      const target = (state.sel.row === r && state.sel.slot === s) ? 1 : 0;
      const cur = state.lifts.get(key) ?? 0;
      const next = cur + (target - cur) * 0.18;
      if (Math.abs(next - target) > 0.002) busy = true; else if (target === 0) { state.lifts.delete(key); continue; }
      state.lifts.set(key, next);
    }
    // 保底：选中的那个
    const kk = keyOf(state.sel.row, state.sel.slot);
    if (!state.lifts.has(kk)) { state.lifts.set(kk, 0); busy = true; }
    render();
    if (busy) anim = requestAnimationFrame(tick);
  };
  anim = requestAnimationFrame(tick);
}

canvas.addEventListener("mousemove", e => {
  const hit = hitTest(e.offsetX, e.offsetY);
  const cur = state.hover;
  if ((hit && (!cur || hit.row !== cur.row || hit.slot !== cur.slot)) || (!hit && cur)) {
    state.hover = hit ? { row: hit.row, slot: hit.slot } : null;
    canvas.style.cursor = hit ? "pointer" : "default";
    render();
  }
});

canvas.addEventListener("click", e => {
  const hit = hitTest(e.offsetX, e.offsetY);
  if (!hit) return;
  state.sel = { row: hit.row, slot: hit.slot };
  const album = albumOf(hit.row, hit.slot);
  plateAnchor = { ox: hit.ox, oy: hit.oy, album };
  document.querySelector(".num-big").innerHTML =
    `${String((hit.row * SLOTS + hit.slot + 1)).padStart(2, "0")}<span class="num-of">/&nbsp;20</span>`;
  document.querySelector(".info-title").textContent = album.title;
  document.querySelector(".info-artist").textContent = album.artist;
  document.querySelector(".info-cat").innerHTML =
    `<span class="sq"></span>ALBUM&nbsp;NO.&nbsp;${album.no}`;
  document.querySelector(".profile-head span:last-child").textContent =
    `ARC-${String(album.no).padStart(4, "0")}`;
  animateLift();
});

window.addEventListener("resize", resize);
window.addEventListener("keydown", e => {
  if (e.key === "ArrowRight") { state.sel.slot = Math.min(SLOTS - 1, state.sel.slot + 1); refreshSel(); }
  if (e.key === "ArrowLeft")  { state.sel.slot = Math.max(0, state.sel.slot - 1); refreshSel(); }
});
function refreshSel() {
  const hit = { row: state.sel.row, slot: state.sel.slot };
  const [sx, sy] = toScreen(-hit.row * ROWP, hit.slot * PITCH, 0);
  plateAnchor = { ox: sx - CASE.origin[0] * K, oy: sy - CASE.origin[1] * K, album: albumOf(hit.row, hit.slot) };
  animateLift();
}

// 时钟
setInterval(() => {
  const d = new Date();
  document.querySelector(".clock-time").textContent =
    [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
  const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  document.querySelector(".clock-date").textContent =
    `${days[d.getDay()]} · ${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}, 1000);

// 初始选中（对齐原截图：前景架第 5 盒）
state.sel = { row: 0, slot: 4 };
state.lifts.set(keyOf(0, 4), 1);
resize();
plateAnchor = (() => {
  const [sx, sy] = toScreen(0, 4 * PITCH, 0);
  return { ox: sx - CASE.origin[0] * K, oy: sy - CASE.origin[1] * K, album: albumOf(0, 4) };
})();
render();
