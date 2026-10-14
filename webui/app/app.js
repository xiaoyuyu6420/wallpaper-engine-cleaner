/* WE Cleaner · RhinE 档案架前端（pywebview 生产版）。
   等距标本架渲染、设计 tokens、视图切换机制移植自 webui/rhine-demo/（RhinE 主题的 HTML 翻译）；
   领域映射：壁纸 = 标本盒，封面 = get_thumbs 返回的 dataURL，详情面板 = 壁纸档案。
   后端契约：webui/CONTRACT.md（与 wecleaner/bridge.py 逐字一致）。 */
"use strict";

/* =====================================================================================
   1 · DESIGN TOKENS — 与 rhine-demo/app.js 逐字一致（6 方案 × 明暗）
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
  { id:"aurora", name:"AURORA", desc:"虹彩漆面配淡色金属，框体沿光变色。" },
  { id:"blue",   name:"BLUE",   desc:"饱和钴蓝漆面，白色金属框与标牌。" },
  { id:"coral",  name:"CORAL",  desc:"暖珊瑚漆面，奶油色金属，哑光。" },
  { id:"frost",  name:"FROST",  desc:"淡霜银金属，半透明奶油前面板。" },
  { id:"glass",  name:"GLASS",  desc:"烟熏玻璃外壳罩银色框架，透明窗。" },
  { id:"hazard", name:"HAZARD", desc:"黑色壳体，框体带警示黄斜纹。" },
  { id:"marble", name:"MARBLE", desc:"软白塑料，大理石灰垫圈，细纹理。" },
  { id:"red",    name:"RED",    desc:"深信号红漆面，白色金属框。" },
  { id:"tide",   name:"TIDE",   desc:"淡潮蓝漆面，冷银色金属。" },
  { id:"white",  name:"WHITE",  desc:"软哑光白塑料与白金属，霜银标牌。" },
];

const C = {};                                     // canvas 用的实时调色板
function applyTheme(schemeId, mode) {
  const sch = SCHEMES[schemeId] ? schemeId : "archive";
  const m = mode === "light" ? "light" : "dark";
  const t = SCHEMES[sch][m];
  const root = document.documentElement.style;
  for (const k of TOKEN_KEYS) { root.setProperty("--" + k, t[k]); C[k] = t[k]; }
  C.rgb = hexToRgb(t.bg);
  root.setProperty("--scrim-rgb", `${C.rgb[0]},${C.rgb[1]},${C.rgb[2]}`);
  root.setProperty("--grain", `url("../rhine-demo/assets/grain-${m === "dark" ? "dark" : "light"}.png")`);
  root.setProperty("--grain-blend", m === "dark" ? "overlay" : "multiply");
  root.setProperty("--grain-opacity", m === "dark" ? ".5" : ".32");
  document.body.dataset.mode = m;
  state.scheme = sch; state.mode = m;
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(hex, a) { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

/* =====================================================================================
   2 · STATE + URL 参数（?view=archive|cleanup|history|style & mock=1 & …）
   ===================================================================================== */
const qs = new URLSearchParams(location.search);
const state = {
  view: ["archive","cleanup","history","style"].includes(qs.get("view")) ? qs.get("view") : "archive",
  scheme: qs.get("scheme") || "archive",
  mode: qs.get("mode") === "light" ? "light" : "dark",
  skin: qs.get("skin") || "white",
  stateFilter: ["all","sub","unsub"].includes(qs.get("filter")) ? qs.get("filter") : "all",
  sort: ["sub","size","time"].includes(qs.get("sort")) ? qs.get("sort") : "sub",
  layout: qs.get("layout") === "grid" ? "grid" : "array",
  filter: qs.get("q") || "",
  gi: 0,
  sel: { row: 0, slot: 0 },                          // 架子上的选中位置
  lifts: new Map(),
  hover: null,
  // 领域数据（契约 §4）
  items: [], byWid: new Map(), thumbs: new Map(),    // thumbs: wid → Image/canvas
  batch: new Set(),                                  // 批量选择集（wid）
  focus: null,                                       // 详情面板当前 wid
  history: [], hisSel: new Set(),
  blocked: false, canUnlock: false, busy: false, permanent: false,
  warnings: [], pending: 0,
  stats: { count: 0, subscribed: 0, unsubscribed: 0, totalSizeText: "—" },
  t0: performance.now(),
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const fmtSize = n => { n = Math.max(0, Number(n) || 0); for (const u of ["B","KB","MB","GB","TB"]) { if (n < 1024 || u === "TB") return u === "B" ? `${n} B` : `${n.toFixed(2)} ${u}`; n /= 1024; } };
const API = () => window.pywebview.api;

/* =====================================================================================
   3 · 契约事件入口（bridge.Api._push → window.__dispatch）
   ===================================================================================== */
window.__dispatch = function (msg) { try { handleEvent(msg); } catch (e) { console.error("__dispatch", msg, e); } };

function handleEvent(m) {
  switch (m.event) {
    case "busy":
      state.busy = m.value;
      document.body.classList.toggle("is-busy", m.value);
      if (m.value) setStatus(`任务进行中：${taskText(m.task)}…`, 0);
      else { progress(0); runPendingDialog(); if (!state.pendingDialog) setStatus(defaultStatus(), 0); }
      syncButtons();
      break;
    case "scanProgress":
      setStatus(`正在扫描 ${m.done}/${m.total}（${m.title}）…`, m.total ? m.done / m.total : 0);
      break;
    case "opProgress":
      setStatus(m.text || "", m.total ? m.done / m.total : 0);
      break;
    case "scanDone":  applyScanDone(m); break;
    case "syncDone":  applySyncDone(m); break;
    case "unsubDone": applyUnsubDone(m); break;
    case "delDone":   applyDelDone(m); break;
    case "resubDone": applyResubDone(m); break;
    case "unlocked":
      state.blocked = false; state.canUnlock = m.canUnlock || false;
      toast("已解锁清理", "删除默认进回收站，可反悔");
      syncAll();
      break;
    case "taskError":
      toast("内部错误", `${m.message}（可重新扫描）`, "err");
      break;
    default: console.warn("未知事件", m);
  }
}
const taskText = t => ({ scan:"扫描", unsubscribe:"退订", delete:"删除", resubscribe:"恢复订阅" }[t] || t || "任务");

function applyScanDone(m) {
  state.items = m.items || [];
  state.byWid = new Map(state.items.map(i => [i.wid, i]));
  state.thumbs.clear();
  state.batch.clear();
  // 一次性演示参数（?batch=0,2,…）：扫描是全量刷新，批量集要在 scanDone 之后才注入
  if (state.demoBatch) {
    for (const n of state.demoBatch) if (state.items[n]) state.batch.add(state.items[n].wid);
    state.demoBatch = null;
  }
  state.blocked = !!m.blocked; state.canUnlock = !!m.canUnlock;
  state.warnings = m.warnings || []; state.pending = m.pending || 0;
  state.stats = { count: m.count, subscribed: m.subscribed, unsubscribed: m.unsubscribed, totalSizeText: m.totalSizeText };
  if (!state.items.some(i => i.wid === state.focus)) state.focus = null;
  if (m.connectError) toast("Steam 未连接", m.connectError, "warn");
  if (state.blocked) toast("操作已锁定", "订阅状态无法确认，请看底部解锁条", "warn");
  refocusAfterDataChange();
  syncAll();
  toast("扫描完成", `共 ${m.count} 个 · 订阅中 ${m.subscribed} · 未订阅 ${m.unsubscribed} · ${m.totalSizeText}`);
}

/* 演示确认弹窗（?dialog=unsub|del|unlock）：等首轮扫描完成后再弹（真实环境同样等扫描结束，避免被 busy 拦下） */
function runPendingDialog() {
  const dlg = state.pendingDialog;
  if (!dlg) return;
  state.pendingDialog = null;
  if (dlg === "unsub") {
    state.batch.clear();
    state.items.filter(i => i.subscribed).slice(0, 2).forEach(i => state.batch.add(i.wid));
    syncAll();
    doUnsubscribe(false);
  } else if (dlg === "del") {
    state.permanent = true; $("chk-perm").checked = true;
    state.batch.clear();
    state.items.filter(i => !i.subscribed).slice(0, 2).forEach(i => state.batch.add(i.wid));
    syncAll();
    doDelete([...state.batch]);
  } else if (dlg === "unlock") {
    doUnlock();
  }
}

function applySyncDone(m) {
  state.blocked = !!m.blocked; state.canUnlock = !!m.canUnlock;
  if (!m.connected) { syncAll(); return; }           // 连不上只更新锁定状态，不动列表
  for (const c of m.changed) {
    const it = state.byWid.get(c.wid);
    if (it) { it.subscribed = c.subscribed; it.subIndex = c.subIndex; }
  }
  state.pending = m.pending || 0;
  if (m.autoUnlocked) toast("已自动解锁", "Steam 接口确认了订阅状态");
  else if (m.changedCount) toast("订阅已同步", `${m.changedCount} 个状态变化`);
  refocusAfterDataChange();
  syncAll();
}

function applyUnsubDone(m) {
  applyPatches(m.patched);
  state.stats = { count: m.count, subscribed: m.subscribed, unsubscribed: m.unsubscribed, totalSizeText: m.totalSizeText };
  if (m.error) { toast("退订失败", m.error, "err"); }
  else {
    let text = `已退订 ${m.ok} 个`;
    text += m.clean ? `，已清理 ${m.cleaned} 个（释放 ${m.freedText}）` : "，Steam 正在后台删除文件";
    if (m.clean && m.cleanFails.length) text += `；${m.cleanFails.length} 个文件被占用，稍后可用「删除选中」清理`;
    if (m.fail) text += `；${m.fail} 个失败`;
    toast("退订完成", text, m.fail ? "warn" : "");
  }
  refreshHistory();
  refocusAfterDataChange();
  syncAll();
}

function applyDelDone(m) {
  applyPatches(m.patched);
  state.stats = { count: m.count, subscribed: m.subscribed, unsubscribed: m.unsubscribed, totalSizeText: m.totalSizeText };
  let text = `已${m.permanent ? "彻底删除" : "移入回收站"} ${m.freedText}`;
  if (m.fails && m.fails.length) text += `；失败 ${m.fails.length} 个`;
  if (!m.permanent) text += "（清空回收站后空间才真正释放）";
  toast("删除完成", text, m.fails && m.fails.length ? "warn" : "");
  refreshHistory();
  refocusAfterDataChange();
  syncAll();
}

function applyResubDone(m) {
  state.history = m.history || state.history;
  state.hisSel.clear();
  if (m.error) toast("恢复订阅失败", m.error, "err");
  else {
    const conf = m.confirmed.length ? `，已确认 ${m.confirmed.length} 个进入订阅列表` : "；未能确认，请稍后在 Steam 里检查（可能是磁盘空间不足）";
    toast("恢复订阅完成", `已重新订阅 ${m.ok} 个${conf}`, m.confirmed.length ? "" : "warn");
  }
  syncAll();
}

function applyPatches(patched) {
  for (const p of patched || []) {
    const it = state.byWid.get(p.wid);
    if (p.removed) {
      state.items = state.items.filter(x => x.wid !== p.wid);
      state.byWid.delete(p.wid);
      state.batch.delete(p.wid);
      if (state.focus === p.wid) state.focus = null;
    } else if (it) {
      it.subscribed = p.subscribed; it.subIndex = p.subIndex;
      it.timeUpdated = p.timeUpdated; it.date = p.date;
    }
  }
}

async function refreshHistory() {
  try { const r = await API().history(); state.history = r.items || []; syncHistory(); } catch (e) { /* 忽略 */ }
}

/* =====================================================================================
   4 · 数据视图：筛选 / 排序 / 分组（契约 §4.1：subIndex=-1 排末尾）
   ===================================================================================== */
function visibleItems() {
  const f = state.filter.trim().toLowerCase();
  let out = state.items.filter(i =>
    (state.stateFilter === "all" || (state.stateFilter === "sub") === !!i.subscribed) &&
    (!f || i.title.toLowerCase().includes(f) || i.wid.includes(f)));
  const cmp = {
    sub:  (a, b) => ((a.subIndex >= 0 ? a.subIndex : 1e9) - (b.subIndex >= 0 ? b.subIndex : 1e9)) || (Math.max(b.size, 0) - Math.max(a.size, 0)),
    size: (a, b) => (Math.max(b.size, 0) - Math.max(a.size, 0)),
    time: (a, b) => (b.timeUpdated - a.timeUpdated) || (Math.max(b.size, 0) - Math.max(a.size, 0)),
  }[state.sort];
  return out.sort(cmp);
}
function groups() {
  const vis = visibleItems();
  const sub = vis.filter(i => i.subscribed), unsub = vis.filter(i => !i.subscribed);
  const out = [];
  if (sub.length)  out.push({ name: "订阅中", items: sub });
  if (unsub.length) out.push({ name: "未订阅", items: unsub });
  return out;
}

/* =====================================================================================
   5 · 盒子封面：get_thumbs 的 dataURL → Image；取不到用中性占位
   ===================================================================================== */
const CASE = {
  res: 600, origin: [300, 431.62], center: [300, 300],
  cover: [[148.6,136.66],[369.09,239.25],[369.09,448.34],[148.6,345.74]],
  label: [[381.6,328.88],[424.43,348.81],[424.43,372.88],[381.6,352.95]],
  axes: { x: [79.31, 36.9], y: [57.56, -50.85], z: [0, -75.21] },
};
const RAIL = { res: 900, origin: [450, 581.62] };
const HERO = { res: 1000, cover: [[122,208.1],[705.8,208.1],[705.8,791.9],[122,791.9]] };
const SLOTS = 20, PITCH = 1.0, ROWP = 4.7, SHELF_ROWS = 5, LIFT_OUT = 2.2;
const CLOSE = [.45, -.62, .64];

const railMid = new Image(); railMid.onload = () => { dirty = true; }; railMid.src = "../rhine-demo/assets/rail/rail-mid.png";
const skinImages = new Map();
function skinImg(skin, part) {
  const k = skin + "|" + part;
  if (!skinImages.has(k)) {
    const im = new Image();
    im.onload = im.onerror = () => { dirty = true; };
    im.src = `../rhine-demo/assets/case/${skin}-${part}.png`;
    skinImages.set(k, im);
  }
  return skinImages.get(k);
}
const heroImg = new Image(); heroImg.onload = heroImg.onerror = () => { dirty = true; syncStyle(); }; heroImg.src = "../rhine-demo/assets/case/hero-frost.png";

const placeholderCache = new Map();
function placeholderCanvas(wid) {
  if (placeholderCache.has(wid)) return placeholderCache.get(wid);
  let h = 0; for (const ch of wid) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const c = document.createElement("canvas"); c.width = 192; c.height = 108;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 192, 108);
  grd.addColorStop(0, `hsl(${h} 14% 34%)`);
  grd.addColorStop(1, `hsl(${(h + 40) % 360} 12% 20%)`);
  g.fillStyle = grd; g.fillRect(0, 0, 192, 108);
  g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(14, 80, 100, 6);
  g.fillStyle = "rgba(240,238,232,.8)"; g.font = "600 16px monospace";
  g.fillText(String(wid).slice(-4), 14, 62);
  placeholderCache.set(wid, c);
  return c;
}
function coverOf(wid) {
  const t = state.thumbs.get(wid);
  if (t && t.complete !== false) return t;
  return placeholderCanvas(wid);
}
async function fetchThumbs(wids) {
  const need = [...new Set(wids)].filter(w => w && !state.thumbs.has(w));
  if (!need.length) return;
  for (const w of need) state.thumbs.set(w, placeholderCanvas(w));  // 先占位防止重复请求
  dirty = true;
  // 分批拉取：每批 20 张，逐批刷新，边拉边显示，不阻塞界面
  for (let i = 0; i < need.length; i += 20) {
    try {
      const r = await API().get_thumbs(need.slice(i, i + 20));
      for (const [wid, data] of Object.entries(r.thumbs || {})) {
        if (!data) continue;                                        // 空串 = 占位图
        const im = new Image();
        im.onload = () => { dirty = true; refreshGridCovers(); };
        im.src = data;
        state.thumbs.set(wid, im);
      }
      dirty = true;
      refreshGridCovers();
    } catch (e) { /* 单批失败不影响其余批次 */ }
  }
}

/* =====================================================================================
   6 · CANVAS + 等距标本架
   ===================================================================================== */
const canvas = $("stage");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, K = 1, OX = 0, OY = 0, dirty = true;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  K = H / 1000; OX = W * 0.43; OY = H * 0.80;
  heroCanvas.width = 620; heroCanvas.height = 620;
  dirty = true;
}
function toScreen(wx, wy, wz) {
  const a = CASE.axes;
  return [ OX + (wx * a.x[0] + wy * a.y[0] + wz * a.z[0]) * K,
           OY + (wx * a.x[1] + wy * a.y[1] + wz * a.z[1]) * K ];
}
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
function inTri(px, py, a, b, c) {
  const s1 = (b[0]-a[0])*(py-a[1]) - (b[1]-a[1])*(px-a[0]);
  const s2 = (c[0]-b[0])*(py-b[1]) - (c[1]-b[1])*(px-b[0]);
  const s3 = (a[0]-c[0])*(py-c[1]) - (a[1]-c[1])*(px-c[0]);
  const hasNeg = (s1 < 0) || (s2 < 0) || (s3 < 0), hasPos = (s1 > 0) || (s2 > 0) || (s3 > 0);
  return !(hasNeg && hasPos);
}
const lerp2 = (p, q, t) => [p[0] + (q[0]-p[0]) * t, p[1] + (q[1]-p[1]) * t];

/* ---------- 分组货架计划 ---------- */
function shelfPlan() {
  const gs = groups();
  if (!gs.length) return { gs, rows: [] };
  const rows = [];
  let gi = Math.min(state.gi, gs.length - 1), from = 0;
  for (let r = 0; r < SHELF_ROWS; r++) {
    const n = Math.min(SLOTS, gs[gi].items.length - from);
    rows.push({ gi, from, count: n });
    from += n;
    if (from >= gs[gi].items.length) { gi++; from = 0; if (gi >= gs.length) break; }
  }
  return { gs, rows };
}
function itemAt(row, slot) {
  const { gs, rows } = shelfPlan();
  const p = rows[row]; if (!p) return null;
  const it = gs[p.gi].items[p.from + slot]; if (!it) return null;
  return { item: it, gi: p.gi, indexInGroup: p.from + slot, groupName: gs[p.gi].name, total: gs[p.gi].items.length };
}
function currentItem() { return itemAt(state.sel.row, state.sel.slot); }
function focusItem() { return state.focus ? state.byWid.get(state.focus) : null; }

function rowAlpha(pos) { return [1, .82, .58, .40, .28][pos] ?? .2; }
function rowTint(pos, mode) { return pos === 0 ? 0 : Math.min(.72, .22 * pos) * (mode === "light" ? .8 : 1); }

function drawArray() {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  drawFloor();
  const { rows } = shelfPlan();
  for (let pos = SHELF_ROWS - 1; pos >= 0; pos--) if (rows[pos] && rows[pos].count) drawShelf(pos, rows[pos]);
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
  const items = g.items.slice(plan.from, plan.from + plan.count);
  const wx = -pos * ROWP, alpha = rowAlpha(pos), tint = rowTint(pos, state.mode);
  if (railMid.complete && railMid.naturalWidth) {
    const [sx, sy] = toScreen(wx, -0.4, 0);
    ctx.globalAlpha = alpha * (state.mode === "light" ? .85 : 1);
    ctx.drawImage(railMid, sx - RAIL.origin[0] * K, sy - RAIL.origin[1] * K, RAIL.res * K, RAIL.res * K);
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
  if (oy > H + S || ox > W + S || ox < -S * 1.4 || oy + S < -80) return { ox, oy, item: it };
  ctx.save();
  ctx.globalAlpha = alpha;
  quadImage(coverOf(it.wid), CASE.cover, ox, oy, K);
  const frost = skinImg(state.skin, "array-frost"), clear = skinImg(state.skin, "array-clear");
  if (frost.complete && frost.naturalWidth) ctx.drawImage(frost, ox, oy, S, S);
  if (tint > 0) { ctx.save(); ctx.globalAlpha = alpha * tint; ctx.fillStyle = C.bg; quadPath(CASE.cover, ox, oy, K); ctx.fill(); ctx.restore(); }
  if (clear.complete && clear.naturalWidth) ctx.drawImage(clear, ox, oy, S, S);
  quadImage(labelImage(it), CASE.label, ox, oy, K);

  const isFocus = state.focus === it.wid;
  const inBatch = state.batch.has(it.wid);
  if (inBatch) drawBatchMark(ox, oy, K);
  const hov = state.hover && state.hover.row === pos && state.hover.slot === slot;
  if (hov || isFocus) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = hov && !isFocus ? 1 : 2;
    quadPath(CASE.cover, ox, oy, K); ctx.stroke();
  }
  ctx.restore();
  return { ox, oy, item: it, slot };
}
/* 批量集标记：右上角 accent 实心角旗（盒角标记） */
function drawBatchMark(ox, oy, k) {
  const p = CASE.cover.map(([x, y]) => [ox + x * k, oy + y * k]);
  const a = lerp2(p[1], p[0], .24), b = lerp2(p[1], p[2], .16);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.accent;
  ctx.beginPath(); ctx.moveTo(p[1][0], p[1][1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
/* 脊标签：订阅序号 #N / REMOVED，小字符贴在盒脊 */
const labelCache = new Map();
function labelImage(it) {
  const key = (it.subscribed && it.subIndex >= 0 ? "#" + (it.subIndex + 1) : "OFF") + "|" + String(it.wid).slice(-3);
  if (labelCache.has(key)) return labelCache.get(key);
  const c = document.createElement("canvas"); c.width = 120; c.height = 150;
  const g = c.getContext("2d");
  g.fillStyle = "#1c1c1a";
  g.font = "600 26px 'Geist Mono', monospace";
  g.fillText(it.subscribed && it.subIndex >= 0 ? "#" + String(it.subIndex + 1) : "—", 8, 58);
  g.font = "500 22px 'Geist Mono', monospace";
  g.fillText(String(it.wid).slice(-4), 8, 92);
  labelCache.set(key, c);
  if (labelCache.size > 900) labelCache.clear();
  return c;
}
let plateAnchor = null;
function drawSelectionPlate() {
  if (!plateAnchor) return;
  const { ox, oy, item } = plateAnchor;
  const top = CASE.cover[1];
  const x1 = ox + top[0] * K + 4, y1 = oy + top[1] * K - 4;
  const lx = x1 + 26, ly = y1 - 26;
  ctx.strokeStyle = C.fg; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lx, ly); ctx.lineTo(lx + 54, ly); ctx.stroke();
  ctx.font = "500 12px 'Geist Mono', monospace"; ctx.textBaseline = "middle";
  const text = item.subscribed && item.subIndex >= 0 ? "#" + (item.subIndex + 1) : "REMOVED";
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
      if (inQuad(px, py, CASE.cover, ox, oy, K)) {
        // 右上角小三角 = 盒角标记区（加入 / 移出批量集）
        const q = CASE.cover.map(([x, y]) => [ox + x * K, oy + y * K]);
        const a = lerp2(q[1], q[0], .3), b = lerp2(q[1], q[2], .2);
        return { row: pos, slot: s, corner: inTri(px, py, q[1], a, b) };
      }
    }
  }
  return null;
}

/* ---------- 上浮动画 + 重绘泵 ---------- */
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
  if (dirty) { dirty = false; render(); }
  requestAnimationFrame(pump);
}
function render() {
  if (state.view === "archive") drawArray();
  else if (state.view === "style") drawStyleHero();
}

/* =====================================================================================
   7 · 选择 / 批量
   ===================================================================================== */
function selectAt(row, slot) {
  const it = itemAt(row, slot); if (!it) return;
  state.sel = { row, slot };
  state.focus = it.item.wid;
  animateLift();
  syncAll();
}
function toggleBatch(wid) {
  if (!wid) return;
  if (state.batch.has(wid)) state.batch.delete(wid); else state.batch.add(wid);
  syncAll();
}
function refocusAfterDataChange() {
  if (state.focus && state.byWid.has(state.focus)) return;
  const vis = visibleItems();
  state.focus = vis.length ? vis[0].wid : (state.items[0] ? state.items[0].wid : null);
  // 把 focus 定位到架子上
  const gs = groups();
  outer: for (let gi = 0; gi < gs.length; gi++) {
    const at = gs[gi].items.findIndex(i => i.wid === state.focus);
    if (at >= 0) { state.gi = gi; state.sel = { row: Math.floor(at / SLOTS), slot: at % SLOTS }; break outer; }
  }
}

/* =====================================================================================
   8 · 详情面板（PROFILE 表格：标题 / ID / 大小 / 安装时间 / 订阅序号 / 订阅状态）
   ===================================================================================== */
function subLabel(it) { return it.subscribed && it.subIndex >= 0 ? `#${it.subIndex + 1}` : "—"; }

function syncInfo() {
  const it = focusItem();
  const cur = currentItem();
  const groupName = it ? (cur && cur.item.wid === it.wid ? cur.groupName : "") : "";
  $("info-group").textContent = groupName || (it ? (it.subscribed ? "订阅中" : "未订阅") : "—");
  $("info-no").textContent = it ? (it.subIndex >= 0 ? String(it.subIndex + 1).padStart(3, "0") : "RES") : "—";
  $("info-title").textContent = it ? it.title : "—";
  $("info-wid").textContent = "WORKSHOP ID " + (it ? it.wid : "—");
  $("info-meta").innerHTML = it ? `${esc(it.sizeText)}&nbsp;&nbsp;/&nbsp;&nbsp;${esc(it.date)}&nbsp;&nbsp;/&nbsp;&nbsp;${esc(subLabel(it))}` : "—";
  $("info-chip").textContent = it ? (it.subscribed ? "SUBSCRIBED" : "UNSUBSCRIBED") : "—";
  $("info-chip").classList.toggle("chip-warn", !!it && !it.subscribed);
  $("info-arc").textContent = it ? "SPEC-" + it.wid.slice(-4).padStart(4, "0") : "SPEC-0000";
  $("p-wid").textContent = it ? it.wid : "—";
  $("p-state").textContent = it ? (it.subscribed ? "订阅中" : "未订阅") : "—";
  $("p-size").textContent = it ? it.sizeText : "—";
  $("p-date").textContent = it ? it.date : "—";
  $("p-subidx").textContent = it ? subLabel(it) : "—";
  $("p-sub").innerHTML = it
    ? (it.subscribed ? `<span class="is-on">已订阅</span>（WE 列表 #${it.subIndex + 1}）` : "未订阅")
    : "—";

  const has = !!it && !state.busy;
  $("btn-preview").disabled = !has;
  $("btn-open").disabled = !has;
  $("btn-unsub-one").disabled = !(has && it.subscribed && !state.blocked);
  $("btn-clean-one").disabled = !(has && !it.subscribed && !state.blocked);
  $("btn-resub-one").disabled = !(has && state.history.some(h => h.wid === it.wid));

  // 左下大数字 + 标尺 + 货架切换
  const n = cur ? cur.indexInGroup + 1 : 0, total = cur ? cur.total : 0;
  $("num-big").innerHTML = `${String(n).padStart(2, "0")}<span class="num-of">/&nbsp;${String(total).padStart(2, "0")}</span>`;
  $("ruler-mark").style.left = ((state.sel.slot + .5) / SLOTS * 100) + "%";
  const gs = groups();
  const gi = Math.min(state.gi, Math.max(0, gs.length - 1));
  $("shelf-num").innerHTML = `${String(gi + 1).padStart(2, "0")}&nbsp;/&nbsp;${String(gs.length).padStart(2, "0")}`;
  $("shelf-cur").textContent = gs[gi] ? `${gs[gi].name} · ${gs[gi].items.length}` : "—";
  $("shelf-next").textContent = gs[gi + 1] ? `${gs[gi + 1].name} · ${gs[gi + 1].items.length}` : "—";
  $("shelf-prev").disabled = gi <= 0;
  $("shelf-go").disabled = gi >= gs.length - 1;

  if (state.view === "archive" && state.focus && state.layout !== "grid") {
    const near = new Set();
    const { rows } = shelfPlan();
    for (const p of rows) {                 // 整个柜组的盒子都拉取（分批渐进填充）
      const g2 = groups()[p.gi];
      if (g2) for (const x of g2.items.slice(p.from, p.from + p.count)) near.add(x.wid);
    }
    near.add(state.focus);
    fetchThumbs([...near]);
  }
}

/* ---------- 02/03 右栏 PROFILE ---------- */
function renderProf(host) {
  if (!host) return;
  const it = focusItem();
  if (!it) { host.innerHTML = `<div class="prof-empty">没有选中的壁纸。<br>回到「档案」视图单击盒子选中，<br>这里的面板会显示它的档案与操作。</div>`; return; }
  const inHis = state.history.some(h => h.wid === it.wid);
  host.innerHTML = `
    <div class="prof-head"><span class="sec-head"><span class="sq"></span>壁纸档案</span><span class="chip">${it.subscribed ? "SUBSCRIBED" : "UNSUBSCRIBED"}</span></div>
    <div class="prof-title">${esc(it.title)}</div>
    <div class="prof-block">
      <div class="prof-block-head"><span>PROFILE</span><span>SPEC-${esc(it.wid.slice(-4).padStart(4, "0"))}</span></div>
      <div class="prof-kv">
        <div><i>WORKSHOP&nbsp;ID</i><b>${esc(it.wid)}</b></div>
        <div><i>大小</i><b>${esc(it.sizeText)}</b></div>
        <div><i>安装时间</i><b>${esc(it.date)}</b></div>
        <div><i>订阅序号</i><b>${esc(subLabel(it))}</b></div>
        <div><i>订阅状态</i><b>${it.subscribed ? "订阅中" : "未订阅"}</b></div>
      </div>
    </div>
    <div class="prof-actions">
      <button class="btn" data-act="preview">▶&nbsp;&nbsp;预览本地视频</button>
      <button class="btn" data-act="open">OPEN&nbsp;&nbsp;工坊页&nbsp;↗</button>
      <button class="btn btn-warn" data-act="unsub" ${it.subscribed && !state.blocked ? "" : "disabled"}>退订选中</button>
      <button class="btn btn-danger" data-act="clean" ${!it.subscribed && !state.blocked ? "" : "disabled"}>清理未订阅残留</button>
      <button class="btn" data-act="resub" ${inHis ? "" : "disabled"}>重新订阅（历史）</button>
    </div>`;
}
for (const id of ["prof-cleanup", "prof-history"]) {
  $(id).addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (b && !b.disabled) handleFocusAction(b.dataset.act);
  });
}

/* =====================================================================================
   9 · 表格视图：02 待清理 / 03 历史
   ===================================================================================== */
function syncCleanup() {
  const rows = state.items.filter(i => !i.subscribed);
  const selRows = rows.filter(i => state.batch.has(i.wid));
  const bytes = rows.reduce((a, i) => a + Math.max(i.size, 0), 0);
  const selBytes = selRows.reduce((a, i) => a + Math.max(i.size, 0), 0);
  $("cl-count").textContent = `${rows.length} 个`;
  $("cl-size").textContent = fmtSize(bytes);
  $("cl-sel").textContent = selRows.length ? `${selRows.length} 个 · ${fmtSize(selBytes)}` : "0";
  $("cl-mode").textContent = state.permanent ? "彻底删除" : "回收站";
  $("cl-no").textContent = String(rows.length).padStart(3, "0");
  $("cl-no2").textContent = "001";
  $("cl-meta").textContent = `共 ${rows.length} 个 · ${fmtSize(bytes)}`;
  $("cl-state").textContent = state.blocked ? "LOCKED" : (rows.length ? "READY" : "CLEAN");
  const box = $("cl-rows");
  if (!rows.length) { box.innerHTML = `<div class="t-empty">很干净，没有未订阅残留 ✔</div>`; }
  else {
    box.replaceChildren(...rows.map((it, i) => {
      const d = document.createElement("div");
      d.className = "t-row" + (state.batch.has(it.wid) ? " is-sel" : "");
      d.innerHTML = `<span class="c-no">${String(i + 1).padStart(2, "0")}</span>
        <span class="c-check">${state.batch.has(it.wid) ? "☑" : "☐"}</span>
        <span class="c-title">${esc(it.title)}</span>
        <span class="c-id">${esc(it.wid)}</span>
        <span class="c-size">${esc(it.sizeText)}</span>
        <span class="c-date">${esc(it.date)}</span>
        <span class="c-sub"><span class="tag-off">残留</span></span>`;
      d.addEventListener("click", () => { state.focus = it.wid; toggleBatch(it.wid); });
      return d;
    }));
  }
  $("cl-del").disabled = state.busy || state.blocked || !selRows.length;
  renderProf($("prof-cleanup"));
}

function syncHistory() {
  const rows = state.history;
  const selRows = rows.filter(r => state.hisSel.has(r.wid));
  const selBytes = selRows.reduce((a, r) => a + Math.max(r.size, 0), 0);
  $("hi-count").textContent = `${rows.length} 条`;
  $("hi-sel").textContent = selRows.length ? `${selRows.length} 条` : "0";
  $("hi-size").textContent = selRows.length ? fmtSize(selBytes) : "—";
  $("hi-no").textContent = String(rows.length).padStart(3, "0");
  $("hi-no2").textContent = "001";
  $("hi-meta").textContent = `共 ${rows.length} 条 · 新→旧`;
  const box = $("hi-rows");
  if (!rows.length) { box.innerHTML = `<div class="t-empty">还没有历史记录。<br>退订或删除壁纸后会记在这里，随时可一键恢复订阅。</div>`; }
  else {
    box.replaceChildren(...rows.map((r, i) => {
      const d = document.createElement("div");
      d.className = "t-row" + (state.hisSel.has(r.wid) ? " is-sel" : "");
      d.innerHTML = `<span class="c-no">${String(i + 1).padStart(2, "0")}</span>
        <span class="c-check">${state.hisSel.has(r.wid) ? "☑" : "☐"}</span>
        <span class="c-title">${esc(r.title)}</span>
        <span class="c-id">${esc(r.wid)}</span>
        <span class="c-act">${esc(r.actionText)}</span>
        <span class="c-date">${esc(r.date)}</span>
        <span class="c-size">${esc(r.sizeText)}</span>`;
      d.addEventListener("click", () => { state.hisSel.has(r.wid) ? state.hisSel.delete(r.wid) : state.hisSel.add(r.wid); syncHistory(); });
      return d;
    }));
  }
  $("hi-resub").disabled = state.busy || !selRows.length;
  renderProf($("prof-history"));
}

/* =====================================================================================
   10 · 04 外观（配色方案 + 盒子外壳 + 明暗）
   ===================================================================================== */
const heroCanvas = $("st-hero");
function renderStyle() {
  const wrap = $("st-skins");
  const frag = document.createDocumentFragment();
  SKINS.forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "st-cell" + (s.id === state.skin ? " is-sel" : "");
    d.innerHTML = `<canvas width="420" height="420"></canvas>
      <div class="st-cell-foot"><i>${String(i + 1).padStart(2, "0")}</i>${s.name}${s.id === state.skin ? '<span class="badge">IN USE</span>' : ""}</div>`;
    d.addEventListener("click", () => { state.skin = s.id; syncStyle(); dirty = true; updateURL(); });
    frag.appendChild(d);
  });
  wrap.replaceChildren(frag);
  [...wrap.children].forEach((el, i) => drawMiniCase(el.querySelector("canvas"), SKINS[i].id));

  const sw = $("st-schemes");
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
    d.addEventListener("click", () => { applyTheme(id, state.mode); markTools(); syncStyle(); syncAll(); updateURL(); });
    frag2.appendChild(d);
  });
  sw.replaceChildren(frag2);
  $("st-scheme-count").textContent = String(SCHEME_IDS.length).padStart(2, "0");
  $("st-skin-count").textContent = String(SKINS.length).padStart(2, "0");
  const skin = SKINS.find(s => s.id === state.skin) || SKINS[9];
  $("st-inuse-name").textContent = skin.name;
  $("st-inuse-desc").textContent = skin.desc;
  $("st-inuse-foot").innerHTML = `外壳&nbsp;&nbsp;${String(SKINS.findIndex(s => s.id === skin.id) + 1).padStart(2, "0")}&nbsp;/&nbsp;${String(SKINS.length).padStart(2, "0")}`;
  $("st-skin-chip").textContent = skin.name;
  $("st-scheme-chip").textContent = SCHEMES[state.scheme].name;
  $("st-mode-chip").textContent = state.mode.toUpperCase();
}
function syncStyle() { renderStyle(); drawStyleHero(); dirty = true; }
function drawMiniCase(cv, skin) {
  if (!cv) return;
  const g = cv.getContext("2d"), S = cv.width;
  const k = S / CASE.res;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  g.fillStyle = C.bg; g.fillRect(0, 0, S, S);
  const a = focusItem() || state.items[0];
  const ox = -CASE.origin[0] * k + S * .5 + 26, oy = -CASE.origin[1] * k + S * .66;
  const q = CASE.cover.map(([x, y]) => [ox + x * k, oy + y * k]);
  g.save(); g.beginPath();
  g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]);
  g.closePath(); g.clip();
  const cov = coverOf(a ? a.wid : "0");
  const dx = q[1][0] - q[0][0], dy = q[1][1] - q[0][1], ex = q[3][0] - q[0][0], ey = q[3][1] - q[0][1];
  g.transform(dx / cov.width, dy / cov.width, ex / cov.height, ey / cov.height, q[0][0], q[0][1]);
  g.drawImage(cov, 0, 0);
  g.restore();
  const frost = skinImg(skin, "array-frost"), clear = skinImg(skin, "array-clear");
  if (frost.complete && frost.naturalWidth) g.drawImage(frost, ox, oy, CASE.res * k, CASE.res * k);
  if (clear.complete && clear.naturalWidth) g.drawImage(clear, ox, oy, CASE.res * k, CASE.res * k);
}
function drawStyleHero() {
  if (state.view !== "style") return;
  const S = heroCanvas.width, g = heroCanvas.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  g.fillStyle = C.bg; g.fillRect(0, 0, S, S);
  const a = focusItem() || state.items[0];
  const cov = coverOf(a ? a.wid : "0");
  const k = S / CASE.res * 1.55;
  const ctr = [286, 292];
  const ox = S * .5 - ctr[0] * k - 24, oy = S * .5 - ctr[1] * k;
  const q = CASE.cover.map(([x, y]) => [ox + x * k, oy + y * k]);
  g.save(); g.beginPath();
  g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]);
  g.closePath(); g.clip();
  g.transform((q[1][0]-q[0][0])/cov.width, (q[1][1]-q[0][1])/cov.width, (q[3][0]-q[0][0])/cov.height, (q[3][1]-q[0][1])/cov.height, q[0][0], q[0][1]);
  g.drawImage(cov, 0, 0);
  g.restore();
  const frost = skinImg(state.skin, "array-frost"), clear = skinImg(state.skin, "array-clear");
  if (frost.complete && frost.naturalWidth) g.drawImage(frost, ox, oy, CASE.res * k, CASE.res * k);
  if (clear.complete && clear.naturalWidth) g.drawImage(clear, ox, oy, CASE.res * k, CASE.res * k);
}

/* =====================================================================================
   11 · 批量操作条 + 解锁条 + 状态条 + 按钮
   ===================================================================================== */
function syncTransportBar() {
  const it = focusItem();
  if (it) {
    $("tr-title").textContent = it.title;
    $("tr-sub").textContent = `${it.wid} · ${it.sizeText} · ${subLabel(it)}`;
    const t = state.thumbs.get(it.wid);
    if (t && t.src) $("tr-thumb-img").src = t.src;                  // Image（dataURL 已加载）
    else if (t && t.toDataURL) $("tr-thumb-img").src = t.toDataURL(); // 占位 canvas
    else $("tr-thumb-img").removeAttribute("src");
    fetchThumbs([it.wid]);                                          // 非档案视图也要拉到 focus 封面
  } else {
    $("tr-title").textContent = "—";
    $("tr-sub").textContent = "—";
    $("tr-thumb-img").removeAttribute("src");
  }
  const chosen = state.items.filter(i => state.batch.has(i.wid));
  const bytes = chosen.reduce((a, i) => a + Math.max(i.size, 0), 0);
  const nSub = chosen.filter(i => i.subscribed).length, nUnsub = chosen.length - nSub;
  $("tr-count").textContent = `已选 ${chosen.length} 张`;
  $("tr-size").textContent = fmtSize(bytes);
  $("tr-detail").textContent = `订阅中 ${nSub} · 未订阅 ${nUnsub}`;
  $("tr-fill").style.width = state.items.length ? `${chosen.length / state.items.length * 100}%` : "0";
  $("tr-batch").textContent = chosen.length
    ? chosen.slice(0, 3).map(i => i.title).join("、") + (chosen.length > 3 ? ` 等 ${chosen.length} 张` : "")
    : "未选择任何壁纸——单击盒子选中，盒角标记或空格加入批量";
  syncButtons();
}
function syncButtons() {
  const chosen = state.items.filter(i => state.batch.has(i.wid));
  const hasSub = chosen.some(i => i.subscribed), hasUnsub = chosen.some(i => !i.subscribed);
  const off = state.busy || state.blocked;
  $("btn-rescan").disabled = state.busy;
  $("btn-all").disabled = state.busy || state.blocked;
  $("btn-none").disabled = state.busy || !state.batch.size;
  $("btn-unsub").disabled = off || !hasSub;
  $("btn-unsub-clean").disabled = off || !hasSub;
  $("btn-del").disabled = off || !hasUnsub;
  $("chk-perm").disabled = state.busy;
  // 解锁条
  const bar = $("unlock-bar");
  bar.hidden = !state.blocked;
  document.documentElement.style.setProperty("--unlock", state.blocked ? "44px" : "0px");
  if (state.blocked) $("unlock-text").textContent = "⚠ 订阅状态无法确认（" + (state.warnings[0] || "本地订阅记录缺少关键字段") + "）";
  // 顶部警告（非 blocked 的一般警告并入状态条右侧）
  const warnText = (!state.blocked && state.warnings.length) ? " · ⚠ " + state.warnings[0] : "";
  syncStatusRight(warnText);
}
function defaultStatus() {
  if (state.view === "cleanup") { const n = state.items.filter(i => !i.subscribed).length; return n ? `待清理区 · ${n} 个未订阅残留` : "待清理区 · 没有残留"; }
  if (state.view === "history") return `历史区 · ${state.history.length} 条记录`;
  if (state.view === "style") return "外观区 · 配色方案";
  const f = state.filter.trim();
  if (f) return `档案区 · 筛选 "${f}" · ${visibleItems().length} 个`;
  return `档案区 · ${state.stats.count} 个 · 订阅中 ${state.stats.subscribed} · 未订阅 ${state.stats.unsubscribed}`;
}
function setStatus(text, frac) {
  $("status-left").textContent = text;
  if (typeof frac === "number") $("status-progress-fill").style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
}
function progress(frac) { $("status-progress-fill").style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`; }
function syncStatusRight(extra) {
  $("status-right").textContent =
    `${state.stats.count} WALLPAPERS · ${state.stats.subscribed} SUB · ${state.stats.totalSizeText}${extra || ""} ▮`;
}
function syncAll() {
  syncInfo();
  syncTransportBar();
  syncCleanup();
  syncHistory();
  markTools();
  if (state.view === "archive" && state.layout === "grid") { renderGrid(); }
  else {
    $("gh-count").textContent = `${visibleItems().length} 个壁纸`;
    $("gh-size").textContent = `共 ${state.stats.totalSizeText}`;
  }
  if (state.view === "archive") setStatus(defaultStatus(), 0);
  dirty = true;
}

/* =====================================================================================
   12 · 确认弹窗（照抄 gui.py 语义） + toast
   ===================================================================================== */
function confirmModal({ title, body, checkText = "", okText = "确定" }) {
  return new Promise(resolve => {
    const modal = $("modal");
    $("modal-title").textContent = title;
    $("modal-body").textContent = body;
    const checkRow = $("modal-check-row"), check = $("modal-check"), ok = $("modal-ok");
    if (checkText) {
      checkRow.hidden = false; $("modal-check-text").textContent = checkText;
      check.checked = false; ok.disabled = true;
    } else { checkRow.hidden = true; check.checked = false; ok.disabled = false; }
    ok.textContent = okText;
    modal.hidden = false;
    const done = val => {
      modal.hidden = true;
      ok.onclick = $("modal-cancel").onclick = check.onchange = modal.onkeydown = null;
      resolve(val);
    };
    ok.onclick = () => done(true);
    $("modal-cancel").onclick = () => done(false);
    check.onchange = () => { ok.disabled = !check.checked; };
    modal.onkeydown = e => { if (e.key === "Escape") done(false); };
    ok.focus();
  });
}
const previewList = (items, n = 5) => {
  const lines = items.slice(0, n).map(i => `  · ${i.title.slice(0, 26)}`);
  if (items.length > n) lines.push(`  ……等共 ${items.length} 个`);
  return lines.join("\n");
};

function toast(head, body, kind = "") {
  const box = document.createElement("div");
  box.className = "toast" + (kind ? " is-" + kind : "");
  box.innerHTML = `<div class="t-head"><span>${esc(head)}</span></div><div>${esc(body)}</div>`;
  $("toasts").appendChild(box);
  setTimeout(() => { box.style.opacity = "0"; box.style.transition = "opacity .3s"; }, 4600);
  setTimeout(() => box.remove(), 5000);
}

/* =====================================================================================
   13 · 操作（全部走 CONTRACT.md 的 api.*）
   ===================================================================================== */
function batchItems() { return state.items.filter(i => state.batch.has(i.wid)); }

async function doUnsubscribe(clean) {
  const chosen = batchItems().filter(i => i.subscribed);
  if (!chosen.length || state.busy) return;
  const total = chosen.reduce((a, i) => a + Math.max(i.size, 0), 0);
  const tail = clean ? "退订后立即清理本地文件" : "Steam 将自动删除本地文件";
  const ok = await confirmModal({
    title: "确认退订",
    body: `将对 ${chosen.length} 个订阅中壁纸（共 ${fmtSize(total)}）执行退订：\n\n`
      + `${previewList(chosen)}\n\n`
      + `· ${tail}\n· 以后想要可在「历史」里一键恢复\n\n确定继续吗？`,
  });
  if (!ok) return;
  const r = await API().unsubscribe(chosen.map(i => i.wid), clean);
  if (r && r.error) toast("无法执行", r.message || r.error, "err");
}

async function doDelete(wids, skippedNote = "") {
  const chosen = state.items.filter(i => wids.includes(i.wid) && !i.subscribed);
  if (!chosen.length || state.busy) return;
  const total = chosen.reduce((a, i) => a + Math.max(i.size, 0), 0);
  const permanent = state.permanent;
  const mode = permanent ? "彻底删除（无法恢复！）" : "移入回收站（清空回收站前可还原）";
  const ok = await confirmModal({
    title: "确认删除",
    body: `将删除 ${chosen.length} 个未订阅壁纸，共 ${fmtSize(total)}：\n\n`
      + `${previewList(chosen)}\n\n`
      + `删除方式：${mode}${skippedNote}\n\n确定继续吗？`,
    checkText: permanent ? "我了解彻底删除的文件不会进回收站、无法恢复" : "",
  });
  if (!ok) return;
  const r = await API().delete(chosen.map(i => i.wid));
  if (r && r.error) toast("无法执行", r.message || r.error, "err");
}

async function doResubscribe(wids) {
  const targets = state.history.filter(h => wids.includes(h.wid));
  if (!targets.length || state.busy) return;
  const ok = await confirmModal({
    title: "确认恢复订阅",
    body: `将重新订阅 ${targets.length} 个壁纸，Steam 会自动重新下载（注意磁盘空间）。继续？`,
  });
  if (!ok) return;
  const r = await API().resubscribe(targets.map(h => h.wid));
  if (r && r.error) toast("无法执行", r.message || r.error, "err");
}

async function doUnlock() {
  const ok = await confirmModal({
    title: "确认解锁清理",
    body: "Steam 接口不可用，无法自动确认订阅状态。\n\n"
      + "请确认：你已经（在 Steam / Wallpaper Engine 里）退订了全部壁纸，\n"
      + "当前列表中的内容全部不再需要。\n\n"
      + "确认无误将解锁「删除选中」功能（默认进回收站，可反悔）。",
    checkText: "我确认以上内容属实，解锁清理",
  });
  if (!ok) return;
  await API().unlock();
}

function handleFocusAction(act) {
  const it = focusItem();
  if (!it || state.busy) return;
  if (act === "preview") { previewWid(it.wid); return; }
  if (act === "open")    { API().open_url(it.wid); return; }
  if (act === "unsub")   { state.batch = new Set([it.wid]); doUnsubscribe(false); return; }
  if (act === "clean")   { if (!it.subscribed) doDelete([it.wid]); return; }
  if (act === "resub")   { doResubscribe([it.wid]); return; }
}

/* =====================================================================================
   13.5 · 平铺网格布局（快速浏览与选择）
   ===================================================================================== */
let gridPage = 0;
const GRID_PER = 32;

function previewWid(wid) {
  if (!wid) return;
  API().open_preview(wid).then(r => {
    if (r && r.error) setStatus(`预览失败：${r.message || r.error}`, 0);
  }).catch(e => setStatus(`预览失败：${e}`, 0));
}
function refreshGridCovers() {
  if (!(state.view === "archive" && state.layout === "grid")) return;
  for (const img of document.querySelectorAll("#grid-body .gcard img[data-wid]")) {
    const t = state.thumbs.get(img.dataset.wid);
    const src = t && t.src ? t.src : (t && t.toDataURL ? t.toDataURL() : "");
    if (src && img.src !== src) img.src = src;
  }
}
function renderGrid() {
  if (!(state.view === "archive" && state.layout === "grid")) return;
  const items = visibleItems();
  const pages = Math.max(1, Math.ceil(items.length / GRID_PER));
  if (gridPage >= pages) gridPage = pages - 1;
  if (gridPage < 0) gridPage = 0;
  const chunk = items.slice(gridPage * GRID_PER, (gridPage + 1) * GRID_PER);
  $("grid-body").innerHTML = chunk.map(it => {
    const t = coverOf(it.wid);
    const src = t && t.src ? t.src : (t && t.toDataURL ? t.toDataURL() : "");
    const marked = state.batch.has(it.wid), foc = state.focus === it.wid;
    return `<div class="gcard${marked ? " is-marked" : ""}${foc ? " is-focus" : ""}" data-wid="${esc(it.wid)}">
      <div class="gc-mark" title="加入批量选择">${marked ? "✓" : "+"}</div>
      <img data-wid="${esc(it.wid)}" src="${src}" alt="">
      <div class="gc-title">${esc(it.title)}</div>
      <div class="gc-meta">${esc(it.sizeText)} · ${esc(it.date)}${it.subscribed && it.subIndex >= 0 ? ` · #${it.subIndex + 1}` : ""}</div>
      <div class="gc-foot"><span class="gc-state${it.subscribed ? " on" : ""}">${it.subscribed ? "订阅中" : "未订阅"}</span><button class="gc-play" data-act="play">▶&nbsp;预览</button></div>
    </div>`;
  }).join("");
  $("grid-pager").innerHTML = pages > 1
    ? `<button class="gp" data-go="prev"${gridPage <= 0 ? " disabled" : ""}>◀</button><span class="gp-num">${gridPage + 1} / ${pages}</span><button class="gp" data-go="next"${gridPage >= pages - 1 ? " disabled" : ""}>▶</button>`
    : "";
  $("gh-count").textContent = `${items.length}`;
  $("gh-size").textContent = fmtSize(items.reduce((s, i) => s + Math.max(0, i.size), 0));
  fetchThumbs(chunk.map(i => i.wid));
}
function applyLayout() {
  const grid = state.view === "archive" && state.layout === "grid";
  $("stage").style.display = grid ? "none" : "";
  $("grid-wrap").style.display = grid ? "block" : "none";   // "block"：CSS 默认是 none，不能用 ""
  const arr = state.view === "archive";
  for (const id of ["select-numeral", "ruler", "shelf-switch"]) {
    $(id).style.display = arr && !grid ? "" : "none";       // 货架部件仅在 ARRAY 模式显示
  }
  if (grid) renderGrid();
}
$("grid-wrap").addEventListener("click", e => {
  const gp = e.target.closest(".gp");
  if (gp) { gridPage += gp.dataset.go === "next" ? 1 : -1; renderGrid(); return; }
  const card = e.target.closest(".gcard");
  if (!card) return;
  const wid = card.dataset.wid;
  if (e.target.closest(".gc-mark")) { toggleBatch(wid); renderGrid(); return; }
  if (e.target.closest(".gc-play")) { previewWid(wid); return; }
  state.focus = wid;
  syncAll();
  renderGrid();
});
for (const b of document.querySelectorAll('[data-key="layout"]')) {
  b.addEventListener("click", () => {
    state.layout = b.dataset.val;
    gridPage = 0;
    markTools();
    syncAll();
    applyLayout();
    updateURL();
  });
}

/* =====================================================================================
   14 · 路由 + 顶栏 + 控件接线
   ===================================================================================== */
function setView(v) {
  if (!["archive","cleanup","history","style"].includes(v)) v = "archive";
  state.view = v;
  document.body.dataset.view = v;
  for (const b of document.querySelectorAll(".nav-item")) b.classList.toggle("is-active", b.dataset.view === v);
  const arr = v === "archive";
  $("shelf-switch").style.display = arr ? "" : "none";
  $("ruler").style.display = arr ? "" : "none";
  $("select-numeral").style.display = arr ? "" : "none";
  $("toolrow").style.display = arr ? "" : "none";
  $("grid-head").style.display = arr ? "" : "none";
  $("info").style.display = arr ? "" : "none";
  $("search-wrap").style.display = arr ? "" : "none";
  if (v === "style") syncStyle();
  if (v === "history") refreshHistory();
  setStatus(defaultStatus(), 0);
  dirty = true;
  applyLayout();
  updateURL();
}
function markTools() {
  for (const b of document.querySelectorAll("[data-key]")) {
    const k = b.dataset.key, v = b.dataset.val;
    b.classList.toggle("is-on", state[k] === v);
  }
}
function updateURL() {
  const p = new URLSearchParams();
  if (state.view !== "archive") p.set("view", state.view);
  if (state.scheme !== "archive") p.set("scheme", state.scheme);
  if (state.mode !== "dark") p.set("mode", state.mode);
  if (state.skin !== "white") p.set("skin", state.skin);
  if (state.stateFilter !== "all") p.set("filter", state.stateFilter);
  if (state.sort !== "sub") p.set("sort", state.sort);
  if (state.layout !== "array") p.set("layout", state.layout);
  if (state.filter.trim()) p.set("q", state.filter.trim());
  if (qs.get("mock")) p.set("mock", "1");
  const s = p.toString();
  history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
}

function initControls() {
  for (const b of document.querySelectorAll(".nav-item"))
    b.addEventListener("click", () => setView(b.dataset.view));
  for (const b of document.querySelectorAll("#toolrow .tool[data-key]"))
    b.addEventListener("click", () => {
      const k = b.dataset.key, v = b.dataset.val;
      if (state[k] === v) return;
      state[k] = v;
      state.gi = 0; state.sel = { row: 0, slot: 0 };
      state.lifts.clear();
      refocusAfterDataChange();
      markTools(); syncAll(); updateURL();
    });
  for (const b of document.querySelectorAll("[data-key='mode']"))
    b.addEventListener("click", () => { applyTheme(state.scheme, b.dataset.val); markTools(); syncAll(); if (state.view === "style") syncStyle(); updateURL(); });

  $("btn-rescan").addEventListener("click", () => {
    const r = API().scan();
    if (r && r.error) toast("无法扫描", r.message || r.error, "err");
  });

  const search = $("search");
  search.addEventListener("input", () => {
    state.filter = search.value;
    $("search-wrap").classList.toggle("is-hit", !!state.filter.trim());
    state.gi = 0; state.sel = { row: 0, slot: 0 };
    state.lifts.clear();
    refocusAfterDataChange();
    syncAll(); updateURL();
  });
  search.addEventListener("keydown", e => { if (e.key === "Escape") { search.value = ""; search.dispatchEvent(new Event("input")); search.blur(); } });

  $("shelf-go").addEventListener("click", () => moveGroup(1));
  $("shelf-prev").addEventListener("click", () => moveGroup(-1));
  $("ruler-up").addEventListener("click", () => moveGroup(-1));
  $("ruler-down").addEventListener("click", () => moveGroup(1));

  canvas.addEventListener("mousemove", e => {
    if (state.view !== "archive") return;
    const hit = hitTest(e.offsetX, e.offsetY);
    const cur = state.hover;
    if ((hit && (!cur || hit.row !== cur.row || hit.slot !== cur.slot || hit.corner !== cur.corner)) || (!hit && cur)) {
      state.hover = hit;
      canvas.style.cursor = hit ? (hit.corner ? "copy" : "pointer") : "default";
      dirty = true;
    }
  });
  canvas.addEventListener("click", e => {
    if (state.view !== "archive") return;
    const hit = hitTest(e.offsetX, e.offsetY);
    if (!hit) return;
    if (hit.corner) {                                  // 盒角标记 = 加入 / 移出批量集
      const it = itemAt(hit.row, hit.slot);
      if (it) toggleBatch(it.item.wid);
      return;
    }
    selectAt(hit.row, hit.slot);
  });
  canvas.addEventListener("dblclick", e => {           // 双击 = 打开工坊页（与 tkinter 版一致）
    if (state.view !== "archive") return;
    const hit = hitTest(e.offsetX, e.offsetY);
    if (hit) {
      const it = itemAt(hit.row, hit.slot);
      if (it) { state.focus = it.item.wid; selectAt(hit.row, hit.slot); API().open_url(it.item.wid); }
    }
  });

  // 详情面板按钮
  $("btn-preview").addEventListener("click", () => handleFocusAction("preview"));
  $("btn-open").addEventListener("click", () => handleFocusAction("open"));
  $("btn-unsub-one").addEventListener("click", () => handleFocusAction("unsub"));
  $("btn-clean-one").addEventListener("click", () => handleFocusAction("clean"));
  $("btn-resub-one").addEventListener("click", () => handleFocusAction("resub"));

  // 批量操作条
  $("btn-all").addEventListener("click", () => { visibleItems().forEach(i => state.batch.add(i.wid)); syncAll(); });
  $("btn-none").addEventListener("click", () => { state.batch.clear(); syncAll(); });
  $("btn-unsub").addEventListener("click", () => doUnsubscribe(false));
  $("btn-unsub-clean").addEventListener("click", () => doUnsubscribe(true));
  $("btn-del").addEventListener("click", () => {
    const wids = batchItems().map(i => i.wid);
    const skipped = batchItems().filter(i => i.subscribed).length;
    doDelete(wids, skipped ? `\n（另有 ${skipped} 个订阅中项目已跳过）` : "");
  });
  $("chk-perm").addEventListener("change", async e => {
    state.permanent = e.target.checked;
    try { await API().set_permanent(state.permanent); } catch (err) { /* 忽略 */ }
    syncCleanup();
  });

  // 解锁条
  $("btn-unlock").addEventListener("click", doUnlock);

  // cleanup 视图
  $("cl-all").addEventListener("click", () => { state.items.filter(i => !i.subscribed).forEach(i => state.batch.add(i.wid)); syncAll(); });
  $("cl-none").addEventListener("click", () => { state.batch.clear(); syncAll(); });
  $("cl-del").addEventListener("click", () => {
    const wids = state.items.filter(i => !i.subscribed && state.batch.has(i.wid)).map(i => i.wid);
    doDelete(wids);
  });

  // history 视图
  $("hi-all").addEventListener("click", () => { state.history.forEach(r => state.hisSel.add(r.wid)); syncHistory(); });
  $("hi-none").addEventListener("click", () => { state.hisSel.clear(); syncHistory(); });
  $("hi-refresh").addEventListener("click", refreshHistory);
  $("hi-resub").addEventListener("click", () => doResubscribe([...state.hisSel]));

  // menu
  const pop = $("menu-pop");
  const toggleMenu = open => {
    const on = open ?? !pop.classList.contains("is-open");
    pop.classList.toggle("is-open", on);
    $("menu-btn").setAttribute("aria-expanded", String(on));
  };
  $("menu-btn").addEventListener("click", e => { e.stopPropagation(); toggleMenu(); });
  $("pop-x").addEventListener("click", e => { e.stopPropagation(); toggleMenu(false); });
  pop.addEventListener("click", e => e.stopPropagation());
  document.addEventListener("click", () => toggleMenu(false));

  window.addEventListener("resize", () => { resize(); if (state.view === "style") syncStyle(); dirty = true; });
  window.addEventListener("keydown", onKey);
}

function moveGroup(dir) {
  const gs = groups();
  const n = Math.min(Math.max(0, state.gi + dir), Math.max(0, gs.length - 1));
  if (n === state.gi) return;
  state.gi = n;
  state.sel = { row: 0, slot: 0 };
  state.lifts.clear();
  const it = itemAt(0, 0);
  if (it) state.focus = it.item.wid;
  syncAll();
  animateLift();
  updateURL();
}

function onKey(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const k = e.key;
  if (k === "Escape") { const pop = $("menu-pop"); if (pop.classList.contains("is-open")) { pop.classList.remove("is-open"); return; } return; }
  if (k === "1" || k === "2" || k === "3" || k === "4") { setView(["archive","cleanup","history","style"][Number(k) - 1]); return; }
  if (k === "d" || k === "D") { applyTheme(state.scheme, state.mode === "dark" ? "light" : "dark"); markTools(); syncAll(); if (state.view === "style") syncStyle(); updateURL(); return; }
  if (k === "/") { e.preventDefault(); $("search").focus(); return; }
  if (state.view !== "archive") return;
  if (k === " ") { e.preventDefault(); toggleBatch(state.focus); return; }
  if (k === "Enter") { if (state.focus) API().open_url(state.focus); return; }
  if (k === "ArrowRight") { const p = shelfPlan().rows[state.sel.row]; if (p && state.sel.slot + 1 < p.count) selectAt(state.sel.row, state.sel.slot + 1); }
  if (k === "ArrowLeft")  { if (state.sel.slot > 0) selectAt(state.sel.row, state.sel.slot - 1); }
  if (k === "ArrowUp") moveGroup(-1);
  if (k === "ArrowDown") moveGroup(1);
}

/* =====================================================================================
   15 · 启动：pywebviewready → get_state → scan → 每 5 秒 sync（契约 §7）
   ===================================================================================== */
function initClock() {
  const tick = () => {
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    document.querySelector(".clock-time").textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    document.querySelector(".clock-date").textContent = `${days[d.getDay()]} · ${p(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  tick(); setInterval(tick, 1000);
}

async function boot() {
  applyTheme(state.scheme, state.mode);
  document.body.dataset.mode = state.mode;
  initClock();
  initControls();
  resize();
  markTools();
  setView(state.view);
  requestAnimationFrame(pump);

  // URL 演示参数（截图 / 演示用；真实环境同样无害）
  const selIdx = Number(qs.get("sel")), batchIdx = (qs.get("batch") || "").split(",").map(Number).filter(n => !Number.isNaN(n));

  try {
    const st = await API().get_state();               // 先恢复快照（F5 后事件流已错过）
    state.items = st.items || [];
    state.byWid = new Map(state.items.map(i => [i.wid, i]));
    state.blocked = !!st.blocked; state.canUnlock = !!st.canUnlock;
    state.permanent = !!st.permanent; state.warnings = st.warnings || [];
    $("chk-perm").checked = state.permanent;
    state.stats = { count: st.count, subscribed: st.subscribed, unsubscribed: st.unsubscribed, totalSizeText: st.totalSizeText };
  } catch (e) {
    toast("连接失败", "无法读取后端状态：" + e, "err");
  }
  try { const h = await API().history(); state.history = h.items || []; } catch (e) { /* 忽略 */ }

  if (state.filter) { $("search").value = state.filter; $("search-wrap").classList.add("is-hit"); }
  refocusAfterDataChange();

  // 演示选择态：?sel=<下标> 选中、?batch=<下标,..> 批量（batch 等 scanDone 全量刷新后注入）
  if (!Number.isNaN(selIdx) && qs.has("sel") && state.items[selIdx]) state.focus = state.items[selIdx].wid;
  if (qs.has("batch")) state.demoBatch = batchIdx;

  syncAll();
  try {
    const r = API().scan();                            // 启动即扫一次
    if (r && r.error) toast("无法扫描", r.message || r.error, "err");
  } catch (e) { /* mock/异常不影响界面 */ }
  setInterval(() => { if (!state.busy) { try { API().sync(); } catch (e) { /* 忽略 */ } } }, 5000);

  // 演示确认弹窗：记录参数，扫描完成后由 runPendingDialog() 弹出（只弹窗不执行）
  const dlg = qs.get("dialog");
  if (["unsub", "del", "unlock"].includes(dlg)) state.pendingDialog = dlg;
}

/* 启动：兼容所有桥注入时序。pywebview 的 api 在管道未就绪时调用会挂起（不报错），
   所以用「带超时的探针」判断就绪，未就绪就持续重试，就绪后才真正 boot。 */
let __booted = false;
function __withTimeout(p, ms) {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error("bridge not ready")), ms)),
  ]);
}
async function tryBoot() {
  if (__booted || !(window.pywebview && window.pywebview.api)) return;
  try { await __withTimeout(window.pywebview.api.get_state(), 1500); }
  catch (e) { return; }                       // 未就绪：下轮再试
  __booted = true;
  boot();
}
if (window.pywebview) tryBoot();
window.addEventListener("pywebviewready", tryBoot);
const __bootPoll = setInterval(() => { tryBoot(); if (__booted) clearInterval(__bootPoll); }, 700);
