/* WE Cleaner · mock 桥接层。
   当 window.pywebview 不存在（浏览器 / 无头截图）或 URL 带 mock=1 时，
   安装一个与 wecleaner/bridge.Api 同签名、同事件流的假实现，
   让 file:// 直接打开即可演示与截图。真窗口里本文件是 no-op。
   事件与返回形状逐条对照 webui/CONTRACT.md。 */
"use strict";

(function () {
  const qs = new URLSearchParams(location.search);
  const forceMock = qs.get("mock") === "1";   // 无头截图 / force 演示；真环境靠安装时的二次检查判断

  /* ---------- 12 条中性示例壁纸（演示名，非真实标题） ---------- */
  const DEMO = [
    ["2814021", "Night City Drive 4K", 312, 4],
    ["2814022", "Aurora Signal Array",  96, 1],
    ["2814023", "Frost Terminal Loop", 184, 8],
    ["2814024", "Glass Rain Lofi",      52, 2],
    ["2814025", "Neon Harbour 4K",     428, 5],
    ["2814026", "Slow Tide Motion",    138, 3],
    ["2814027", "Paper Lantern Field",  74, 9],
    ["2814028", "Quiet Workbench",     210, 6],
    ["2814029", "Salt Flats Dawn",      41, 0],
    ["2814030", "North Window Light",  325, 7],
    ["2814031", "Vector Grid Minimal",  18, 11],
    ["2814032", "Ember Drift Loop",    260, 10],
  ];
  const NOW = Math.floor(Date.now() / 1000);
  const DAY = 86400;

  const items = DEMO.map(([wid, title, mb, ageD], i) => ({
    wid,
    title,
    size: mb * 1024 * 1024,
    sizeText: fmt(mb * 1024 * 1024),
    timeUpdated: NOW - ageD * DAY,
    date: dateText(NOW - ageD * DAY),
    // 前 9 条订阅中（subIndex 与演示订阅顺序一致），后 3 条未订阅残留
    subscribed: i < 9,
    subIndex: i < 9 ? i : -1,
    url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${wid}`,
  }));

  const historyItems = [
    ["2793111", "Harbour Fog Reel", 64, "delete", 2],
    ["2793112", "Cassette Deck Scene", 128, "unsubscribe", 5],
    ["2793113", "Meadow Wind 4K", 96, "unsubscribe", 12],
    ["2793114", "Blue Hour Rooftop", 210, "delete", 30],
  ].map(([wid, title, mb, action, ageD]) => ({
    wid, title,
    size: mb * 1024 * 1024,
    sizeText: fmt(mb * 1024 * 1024),
    ts: NOW - ageD * DAY,
    date: timeText(NOW - ageD * DAY),
    action,
    actionText: action === "unsubscribe" ? "退订" : "删除",
    url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${wid}`,
  })).sort((a, b) => b.ts - a.ts);

  /* ---------- 可变状态 ---------- */
  const S = {
    items, history: historyItems.slice(),
    blocked: qs.get("blocked") === "1",      // ?blocked=1 → 演示「订阅状态不可信」锁定
    permanent: false,
    busy: false,
    warnings: qs.get("blocked") === "1"
      ? ["本地订阅记录缺少关键字段，无法确认哪些壁纸仍在订阅。"]
      : [],
  };

  /* ---------- 工具 ---------- */
  function fmt(n) {
    for (const u of ["B", "KB", "MB", "GB", "TB"]) {
      if (n < 1024 || u === "TB") return u === "B" ? `${n} B` : `${n.toFixed(2)} ${u}`;
      n /= 1024;
    }
  }
  function dateText(ts) { const d = new Date(ts * 1000); const p = n => String(n).padStart(2, "0"); return `${p(d.getFullYear() % 100)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function timeText(ts) { const d = new Date(ts * 1000); const p = n => String(n).padStart(2, "0"); return `${dateText(ts)} ${p(d.getHours())}:${p(d.getMinutes())}`; }
  function summary() {
    const nSub = items.filter(i => i.subscribed).length;
    const total = items.reduce((a, i) => a + Math.max(i.size, 0), 0);
    return { count: items.length, subscribed: nSub, unsubscribed: items.length - nSub, totalSize: total, totalSizeText: fmt(total) };
  }
  // 桥接层通过 window.__dispatch 推事件；所有 mock 事件都是延迟触发的，
  // 到时 app.js 早已定义好 __dispatch，未定义时静默丢弃（与真桥接的降级一致）
  function dispatch(msg) {
    if (typeof window.__dispatch === "function") { try { window.__dispatch(msg); } catch (e) { /* noop */ } }
  }
  function pushLater(ms, event, payload) { setTimeout(() => dispatch({ event, ...payload }), ms); }

  /* ---------- 假缩略图：192×108 渐变 + 几何图形 + ID，够演示与截图 ---------- */
  const thumbCache = new Map();
  function hueOf(wid) { let h = 0; for (const c of wid) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  function makeThumb(wid) {
    if (thumbCache.has(wid)) return thumbCache.get(wid);
    const c = document.createElement("canvas"); c.width = 192; c.height = 108;
    const g = c.getContext("2d");
    const h = hueOf(wid);
    const grd = g.createLinearGradient(0, 0, 192, 108);
    grd.addColorStop(0, `hsl(${h} 42% 46%)`);
    grd.addColorStop(1, `hsl(${(h + 46) % 360} 38% 26%)`);
    g.fillStyle = grd; g.fillRect(0, 0, 192, 108);
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath(); g.arc(146, 34, 22, 0, Math.PI * 2); g.fill();
    g.fillRect(14, 78, 96, 7);
    g.fillStyle = "rgba(242,240,234,.92)";
    g.font = "600 15px monospace";
    g.fillText(String(wid).slice(-4), 14, 66);
    const url = c.toDataURL("image/jpeg", 0.8);
    thumbCache.set(wid, url);
    return url;
  }

  /* ---------- 长任务的通用骨架：busy → opProgress×N → done → busy ---------- */
  function runTask(task, chosen, perItem, done) {
    if (S.busy) return { error: "busy", message: "已有任务在进行中，请等它结束" };
    S.busy = true;
    dispatch({ event: "busy", value: true, task });
    let i = 0;
    const step = () => {
      if (i < chosen.length) {
        const it = chosen[i];
        dispatch({ event: "opProgress", task, done: i + 1, total: chosen.length, wid: it.wid, text: perItem(it, i + 1, chosen.length) });
        i += 1;
        setTimeout(step, 120);
      } else {
        setTimeout(() => {
          const result = done();
          dispatch(result);
          S.busy = false;
          dispatch({ event: "busy", value: false, task: "" });
        }, 200);
      }
    };
    setTimeout(step, 150);
    return { started: true };
  }

  /* ---------- 假 Api（方法名 / 返回形状 = bridge.Api） ---------- */
  const api = {
    scan() {
      if (S.busy) return { error: "busy", message: "已有任务在进行中，请等它结束" };
      S.busy = true;
      dispatch({ event: "busy", value: true, task: "scan" });
      const list = S.items.slice();
      list.forEach((it, k) => {
        pushLater(120 + k * 110, "scanProgress", {
          done: k + 1, total: list.length, percent: Math.round((k + 1) * 100 / list.length),
          wid: it.wid, title: it.title.slice(0, 24),
        });
      });
      pushLater(120 + list.length * 110 + 150, "scanDone", {
        items: S.items.map(i => ({ ...i })),
        pending: 0,
        source: "steam_api",
        blocked: S.blocked,
        canUnlock: S.blocked,
        manualUnlock: false,
        connectError: "",
        warnings: S.warnings.slice(),
        running: [],
        ...summary(),
      });
      pushLater(120 + list.length * 110 + 220, "busy", { value: false, task: "" });
      setTimeout(() => { S.busy = false; }, 120 + list.length * 110 + 230);
      return { started: true };
    },

    sync() {
      if (S.busy) return { skipped: "busy" };
      pushLater(160, "syncDone", {
        connected: true, error: "", changed: [], changedCount: 0, pending: 0,
        autoUnlocked: false, blocked: S.blocked, canUnlock: S.blocked, ...summary(),
      });
      return { started: true };
    },

    get_state() {
      return {
        items: S.items.map(i => ({ ...i })),
        blocked: S.blocked, canUnlock: S.blocked, manualUnlock: false,
        busy: false, busyTask: "", connectError: "",
        warnings: S.warnings.slice(), permanent: S.permanent, thumbSize: [192, 108],
        ...summary(),
      };
    },

    unlock() {
      S.blocked = false;
      pushLater(60, "unlocked", { blocked: false, canUnlock: true });
      return { ok: true, blocked: false, canUnlock: true };
    },

    get_thumb(wid) { return { wid: String(wid), data: makeThumb(String(wid)) }; },
    get_thumbs(wids) {
      const arr = Array.isArray(wids) ? wids : [wids];
      const thumbs = {};
      for (const w of arr) thumbs[String(w)] = makeThumb(String(w));
      return { thumbs };
    },

    open_preview(wid) { return { ok: true, path: `C:/demo/${wid}/video.mp4` }; },
    open_url(wid) { return { ok: true, url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${wid}` }; },

    unsubscribe(wids, clean) {
      if (S.blocked) return { error: "blocked", message: "订阅状态无法确认，破坏性操作已锁定" };
      const ids = (Array.isArray(wids) ? wids : [wids]).map(String);
      const chosen = S.items.filter(i => ids.includes(i.wid) && i.subscribed);
      if (!chosen.length) return { error: "empty", message: "选中的壁纸里没有正在订阅的" };
      clean = !!clean;
      return runTask("unsubscribe", chosen,
        (it, k, n) => `正在退订 ${k}/${n}：${it.title.slice(0, 20)}`,
        () => {
          for (const it of chosen) { it.subscribed = false; it.subIndex = -1; }
          if (clean) {
            for (const it of chosen) {
              const k = S.items.indexOf(it); if (k >= 0) S.items.splice(k, 1);
            }
          } else {
            for (const it of chosen) S.history.unshift(historyOf(it, "unsubscribe"));
          }
          return {
            event: "unsubDone", ok: chosen.length, fail: 0, fails: [], failIds: [],
            clean, cleaned: clean ? chosen.length : 0,
            freed: clean ? chosen.reduce((a, i) => a + i.size, 0) : 0,
            freedText: clean ? fmt(chosen.reduce((a, i) => a + i.size, 0)) : "0 B",
            cleanFails: [], error: "", requested: chosen.map(i => i.wid),
            patched: chosen.map(i => ({ wid: i.wid, subscribed: false, subIndex: -1, timeUpdated: i.timeUpdated, date: i.date, removed: !!clean })),
            ...summary(),
          };
        });
    },

    delete(wids) {
      if (S.blocked) return { error: "blocked", message: "订阅状态无法确认，破坏性操作已锁定" };
      const ids = (Array.isArray(wids) ? wids : [wids]).map(String);
      const chosen = S.items.filter(i => ids.includes(i.wid) && !i.subscribed);
      if (!chosen.length) return { error: "empty", message: "选中的壁纸里没有未订阅的（订阅中的请先退订）" };
      const permanent = S.permanent;
      return runTask("delete", chosen,
        (it, k, n) => `正在删除 ${k}/${n}：${it.title.slice(0, 20)}`,
        () => {
          const freed = chosen.reduce((a, i) => a + Math.max(i.size, 0), 0);
          for (const it of chosen) {
            const k = S.items.indexOf(it); if (k >= 0) S.items.splice(k, 1);
            S.history.unshift(historyOf(it, "delete"));
          }
          return {
            event: "delDone", freed, freedText: fmt(freed), permanent,
            fails: [], failIds: [], requested: chosen.map(i => i.wid),
            patched: chosen.map(i => ({ wid: i.wid, subscribed: false, subIndex: -1, timeUpdated: i.timeUpdated, date: i.date, removed: true })),
            ...summary(),
          };
        });
    },

    history() { return { items: S.history.map(h => ({ ...h })), count: S.history.length }; },

    resubscribe(wids) {
      const ids = (Array.isArray(wids) ? wids : [wids]).map(String);
      const targets = S.history.filter(h => ids.includes(h.wid));
      if (!targets.length) return { error: "empty", message: "选中的对象不在历史记录里" };
      return runTask("resubscribe", targets,
        (h, k, n) => `正在恢复订阅 ${k}/${n}：${h.title.slice(0, 20)}`,
        () => {
          const confirmed = targets.map(h => h.wid);
          S.history = S.history.filter(h => !confirmed.includes(h.wid));
          return { event: "resubDone", ok: targets.length, fail: 0, error: "", confirmed, requested: confirmed, history: S.history.map(h => ({ ...h })) };
        });
    },

    set_permanent(value) { S.permanent = !!value; return { permanent: S.permanent }; },
  };

  function historyOf(it, action) {
    const ts = Math.floor(Date.now() / 1000);
    return {
      wid: it.wid, title: it.title, size: it.size, sizeText: it.sizeText, ts,
      date: timeText(ts), action,
      actionText: action === "unsubscribe" ? "退订" : "删除",
      url: it.url,
    };
  }

  /* ---------- 安装（延迟 + 二次检查，绝不抢真桥） ---------- */
  function install() {
    if (!forceMock && typeof window.pywebview !== "undefined" && window.pywebview && window.pywebview.api) {
      return;                                  // 真桥已注入：本文件不介入
    }
    window.pywebview = { api };
    document.body.dataset.mock = "1";           // 诊断标记：一眼看出当前跑的是演示数据
    // 真实 pywebview 是异步注入后触发 pywebviewready；这里模拟同样的时序
    window.dispatchEvent(new Event("pywebviewready"));
  }
  // 真桥在页面加载后很快注入；稍等再决定，避免抢跑
  window.addEventListener("DOMContentLoaded", () => setTimeout(install, forceMock ? 0 : 800));
})();
