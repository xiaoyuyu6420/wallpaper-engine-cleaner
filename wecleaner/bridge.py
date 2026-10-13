"""pywebview 桥接层：把核心能力暴露给前端 JS（window.pywebview.api.*）。

契约文档：``webui/CONTRACT.md`` —— 方法名、事件名、payload 字段以那份文档为准；
这里任何改动都必须同步改文档，否则前端会照着文档写错。

设计要点
--------
1. 长任务（扫描 / 退订 / 退订并清理 / 删除 / 恢复订阅 / 订阅同步）全部在后台线程执行，
   进度与结果通过 ``window.evaluate_js`` 推 JSON 事件给前端 ``window.__dispatch``。
2. 没有窗口对象时（冒烟测试、命令行复用）事件推送安全退化为 no-op；
   另外可用 ``Api(on_event=...)`` 挂一个 Python 回调做事件采集（测试用）。
3. 订阅状态不可信（``core.ScanResult.deletion_blocked``）时只读锁定：前端禁用
   破坏性按钮，桥接层也直接拒绝执行（双保险）；用户确认后 ``unlock()`` 解锁。
4. 所有 ``steamapi`` 调用用一把互斥锁串行化 —— steamapi 是模块级全局状态，
   且 ``connect()`` 内部会 ``os.chdir``，多线程并发调用不安全。
"""

from __future__ import annotations

import base64
import io
import json
import os
import threading
import time
import webbrowser
from collections.abc import Callable

from . import core, steamapi, thumbnails

THUMB_QUALITY = 78  # JPEG 质量：192x108 卡片图约 4-8 KB，够用且省内存
THUMB_CACHE_LIMIT = 600  # 内存里最多留多少张 dataURL（重新扫描会清空）

_ERROR_TEXT = {
    "busy": "已有任务在进行中，请等它结束",
    "blocked": "订阅状态无法确认，破坏性操作已锁定：请先启动 Steam 并打开一次 "
               "Wallpaper Engine 同步订阅，或用「解锁清理」手动确认",
    "empty": "没有符合条件的目标",
    "unknown": "未知的壁纸 ID",
    "nofile": "该壁纸目录里没有可播放或查看的文件",
    "open": "打开失败",
}


def _err(code: str, message: str = "", **extra) -> dict:
    """错误返回的统一形状：{"error": <机器码>, "message": <给人看的中文>}。"""
    return {"error": code, "message": message or _ERROR_TEXT.get(code, ""), **extra}


def _date_text(ts: int) -> str:
    return time.strftime("%y-%m-%d", time.localtime(ts)) if ts else "下载中"


def item_dict(item: core.Item) -> dict:
    """Item → JSON 字段（契约 §4.1 item 字段）。"""
    return {
        "wid": item.wid,
        "title": item.title or item.wid,
        "size": item.size,
        "sizeText": "⏳ 变化中" if item.size < 0 else core.fmt_size(item.size),
        "timeUpdated": item.time_updated,
        "date": _date_text(item.time_updated),
        "subscribed": bool(item.subscribed),
        "subIndex": item.sub_index,
        "url": item.url,
    }


def patch_dict(item: core.Item, removed: bool) -> dict:
    """增量补丁：任务结束后前端按 wid 就地更新卡片（removed=True 表示从列表移除）。"""
    return {
        "wid": item.wid,
        "subscribed": bool(item.subscribed),
        "subIndex": item.sub_index,
        "timeUpdated": item.time_updated,
        "date": _date_text(item.time_updated),
        "removed": bool(removed),
    }


class Api:
    """暴露给前端 JS 的方法集（pywebview js_api）。

    约定：
    - 所有公开方法（不以 ``_`` 开头）都是前端可调用的 API，返回 dict（自动转 JSON）。
    - 后台线程只通过 ``_push`` 与前端通信；``self._lock`` 保护 items/标志位。
    """

    def __init__(self, on_event: Callable[[dict], None] | None = None) -> None:
        # 注意：窗口对象必须放在**私有**属性里。pywebview 注入 js_api 时会遍历所有公开
        # 属性并对「非方法、非类但带 __module__」的对象递归，把它的公开方法也暴露成
        # window.pywebview.api.window.*；窗口对象是 pywebview.Window，递归进去会去碰
        # COM/WinForms（非 UI 线程访问 → 刷一屏错误，还白白暴露 evaluate_js/destroy）。
        self._window = None  # 由 app.py 注入；None = 无窗口（事件推送 no-op）
        self.appid = core.WE_APPID
        self.permanent_delete = False  # set_permanent() 改这里
        self._on_event = on_event  # 测试/冒烟用的事件回调（可选）
        self._lock = threading.RLock()
        self._steam_lock = threading.RLock()
        self._busy = False
        self._busy_task = ""
        self._syncing = False
        self._manual_unlock = False
        self._deletion_blocked = False
        self._connect_error = ""
        self._warnings: list[str] = []
        self._items: list[core.Item] = []
        self._by_wid: dict[str, core.Item] = {}
        self._thumbs: dict[str, str] = {}
        self._thumb_lock = threading.Lock()

    # ---------- 内部：事件推送 / 状态 ----------

    def _push(self, event: str, **payload) -> None:
        """推一个事件给前端；没有窗口对象时安全 no-op。"""
        message = {"event": event, **payload}
        if self._on_event is not None:
            try:
                self._on_event(message)
            except Exception:  # noqa: BLE001 - 采集回调坏掉不能影响任务
                pass
        window = self._window
        if window is None:
            return
        try:
            data = json.dumps(message, ensure_ascii=False)
            window.evaluate_js(f"window.__dispatch({data})")
        except Exception:  # noqa: BLE001 - 窗口关闭瞬间 / 前端没定义 __dispatch
            pass

    def _busy_on(self, task: str) -> bool:
        with self._lock:
            if self._busy:
                return False
            self._busy = True
            self._busy_task = task
        self._push("busy", value=True, task=task)
        return True

    def _busy_off(self) -> None:
        """任务收尾：一定在任务结果事件之后推 busy=false（前端据此恢复按钮）。"""
        with self._lock:
            was = self._busy
            self._busy = False
            self._busy_task = ""
        if was:
            self._push("busy", value=False, task="")

    def _is_blocked(self) -> bool:
        with self._lock:
            return self._deletion_blocked and not self._manual_unlock

    def _items_payload(self) -> list[dict]:
        """调用方需持有 self._lock。"""
        return [item_dict(i) for i in self._items]

    def _summary(self) -> dict:
        """调用方需持有 self._lock：全库统计。"""
        n_sub = sum(1 for i in self._items if i.subscribed)
        total = sum(max(i.size, 0) for i in self._items)
        return {
            "count": len(self._items),
            "subscribed": n_sub,
            "unsubscribed": len(self._items) - n_sub,
            "totalSize": total,
            "totalSizeText": core.fmt_size(total),
        }

    def _drop_thumbs(self, wids) -> None:
        if not wids:
            return
        with self._thumb_lock:
            for wid in wids:
                self._thumbs.pop(wid, None)

    def _clear_thumbs(self) -> None:
        with self._thumb_lock:
            self._thumbs.clear()

    def _history_items(self) -> list[dict]:
        records = core.load_history().get("items", {})
        out: list[dict] = []
        for wid, info in records.items():
            if not isinstance(info, dict):
                continue
            ts = int(info.get("ts") or 0)
            size = int(info.get("size") or 0)
            action = "unsubscribe" if info.get("action") == "unsubscribe" else "delete"
            out.append({
                "wid": str(wid),
                "title": str(info.get("title") or wid),
                "size": size,
                "sizeText": core.fmt_size(max(size, 0)),
                "ts": ts,
                "date": time.strftime("%y-%m-%d %H:%M", time.localtime(ts)) if ts else "",
                "action": action,
                "actionText": "退订" if action == "unsubscribe" else "删除",
                "url": f"https://steamcommunity.com/sharedfiles/filedetails/?id={wid}",
            })
        out.sort(key=lambda r: r["ts"], reverse=True)
        return out

    @staticmethod
    def _ids(wids) -> list[str]:
        """把前端传来的 ID 列表去重并统一成 str（容错：单个字符串也收）。"""
        if wids is None:
            return []
        if isinstance(wids, (str, int)):
            wids = [wids]
        return [str(w) for w in dict.fromkeys(wids)]

    # ---------- 扫描 ----------

    def scan(self) -> dict:
        """开始扫描（后台线程 + 事件：busy → scanProgress* → scanDone → busy(false)）。"""
        if self._busy_on("scan"):
            threading.Thread(target=self._scan_worker, name="we-cleaner-scan", daemon=True).start()
            return {"started": True}
        return _err("busy")

    def _scan_worker(self) -> None:
        try:
            # 1) 先问运行中的 Steam 要权威订阅列表（含顺序 → subIndex）
            order: list[str] | None = None
            connect_error = ""
            with self._steam_lock:
                try:
                    if steamapi.connect():
                        order = steamapi.get_subscribed_ordered()
                    else:
                        connect_error = steamapi.last_error
                except Exception as e:  # noqa: BLE001 - API 失败时回退 ACF（core 自己处理）
                    connect_error = str(e)

            # 2) 扫盘：subscribed_order 传下去，core 会算好 subscribed / sub_index
            def progress(done: int, total: int, item: core.Item) -> None:
                self._push(
                    "scanProgress",
                    done=done,
                    total=total,
                    percent=(done * 100 // total) if total else 100,
                    wid=item.wid,
                    title=(item.title or item.wid)[:24],
                )

            res = core.scan(self.appid, on_progress=progress, subscribed_order=order)

            # 3) 补齐 gui 版同样的运行中进程提醒
            running = sorted(core.running_processes(core.STEAM_PROCS + core.WE_PROCS))
            warnings = list(res.warnings)
            if set(running) & set(core.WE_PROCS):
                warnings.append("Wallpaper Engine 正在运行：清理文件前建议先退出 WE，文件可能被占用。")

            with self._lock:
                self._items = res.items
                self._by_wid = {i.wid: i for i in res.items}
                self._deletion_blocked = bool(res.deletion_blocked)
                self._connect_error = connect_error
                self._warnings = warnings
                manual_unlock = self._manual_unlock
                blocked = self._deletion_blocked and not manual_unlock
                summary = self._summary()
                items = self._items_payload()
                pending = len(set(res.subscribed) - set(self._by_wid))

            self._clear_thumbs()  # 重新扫描后旧缩略图作废
            self._push(
                "scanDone",
                items=items,
                pending=pending,  # 已订阅但磁盘上还没下好（正在下载）的数量
                source=res.subscribed_source,  # "steam_api"（权威）/ "acf" / ""
                blocked=blocked,
                canUnlock=self._deletion_blocked,
                manualUnlock=manual_unlock,
                connectError=connect_error,
                warnings=warnings,
                running=running,
                **summary,
            )
        except Exception as e:  # noqa: BLE001 - 后台线程不能让异常静默死掉
            self._push("taskError", task="scan", message=f"{type(e).__name__}: {e}")
        finally:
            self._busy_off()

    # ---------- 订阅同步（前端建议每 5 秒调一次）----------

    def sync(self) -> dict:
        """与 Steam 同步订阅状态（不改文件、不占 busy）。

        事件：syncDone。正在跑长任务或上一次同步还没回来时返回 {"skipped": ...}。
        """
        with self._lock:
            if self._busy:
                return {"skipped": "busy"}
            if self._syncing:
                return {"skipped": "inflight"}
            self._syncing = True
        threading.Thread(target=self._sync_worker, name="we-cleaner-sync", daemon=True).start()
        return {"started": True}

    def _sync_worker(self) -> None:
        try:
            order: list[str] = []
            error = ""
            with self._steam_lock:
                try:
                    if steamapi.connect():
                        order = steamapi.get_subscribed_ordered()
                    else:
                        error = steamapi.last_error
                except Exception as e:  # noqa: BLE001
                    error = str(e)
            connected = not error

            changed: list[dict] = []
            auto_unlocked = False
            pending = 0
            with self._lock:
                if connected:
                    subs = set(order)
                    idx = {w: i for i, w in enumerate(order)}
                    for it in self._items:
                        was_sub, was_idx = it.subscribed, it.sub_index
                        it.subscribed = it.wid in subs
                        it.sub_index = idx.get(it.wid, -1)
                        if was_sub != it.subscribed or was_idx != it.sub_index:
                            changed.append({
                                "wid": it.wid,
                                "subscribed": it.subscribed,
                                "subIndex": it.sub_index,
                            })
                    self._connect_error = ""
                    pending = len(subs - set(self._by_wid))
                    if self._deletion_blocked:  # Steam 接口确认了 → 自动解锁
                        self._deletion_blocked = False
                        auto_unlocked = True
                else:
                    self._connect_error = error
                summary = self._summary()
                blocked = self._deletion_blocked and not self._manual_unlock

            self._push(
                "syncDone",
                connected=connected,
                error=error,
                changed=changed,
                changedCount=len(changed),
                pending=pending,
                autoUnlocked=auto_unlocked,
                blocked=blocked,
                canUnlock=self._deletion_blocked,
                **summary,
            )
        except Exception as e:  # noqa: BLE001
            self._push("taskError", task="sync", message=f"{type(e).__name__}: {e}")
        finally:
            with self._lock:
                self._syncing = False

    # ---------- 状态快照 / 解锁 ----------

    def get_state(self) -> dict:
        """前端刷新（F5）后拉一次完整快照，用来恢复界面（事件流已经错过）。"""
        with self._lock:
            return {
                "items": self._items_payload(),
                "blocked": self._deletion_blocked and not self._manual_unlock,
                "canUnlock": self._deletion_blocked,
                "manualUnlock": self._manual_unlock,
                "busy": self._busy,
                "busyTask": self._busy_task,
                "connectError": self._connect_error,
                "warnings": list(self._warnings),
                "permanent": self.permanent_delete,
                "thumbSize": [int(thumbnails.THUMB_SIZE[0]), int(thumbnails.THUMB_SIZE[1])],
                **self._summary(),
            }

    def unlock(self) -> dict:
        """用户在前端确认「已全部退订」，解除只读锁定（前端需二次确认后再调）。"""
        with self._lock:
            self._manual_unlock = True
            can_unlock = self._deletion_blocked
            blocked = self._deletion_blocked and not self._manual_unlock
        self._push("unlocked", blocked=blocked, canUnlock=can_unlock)
        return {"ok": True, "blocked": blocked, "canUnlock": can_unlock}

    # ---------- 缩略图（前端按当前页批量拉）----------

    def get_thumb(self, wid: str) -> dict:
        """单张缩略图 → dataURL（取不到返回空串，前端用占位图）。"""
        wid = str(wid)
        with self._thumb_lock:
            cached = self._thumbs.get(wid)
        if cached is not None:
            return {"wid": wid, "data": cached}
        return {"wid": wid, "data": self._make_thumb(wid)}

    def get_thumbs(self, wids) -> dict:
        """批量缩略图：返回 {"thumbs": {wid: dataURL}}；取不到的值为空串。

        前端按当前页调用（一页一次），不要整库调用——视频截帧单张可能要几百毫秒。
        """
        out: dict[str, str] = {}
        for wid in self._ids(wids):
            if wid in out:
                continue
            with self._thumb_lock:
                cached = self._thumbs.get(wid)
            out[wid] = cached if cached is not None else self._make_thumb(wid)
        return {"thumbs": out}

    def _make_thumb(self, wid: str) -> str:
        with self._lock:
            item = self._by_wid.get(wid)
        if item is None or not item.path:
            return ""
        try:
            img = thumbnails.extract(item.path)  # 192x108 封面裁剪，失败自动回占位图
            if img.mode != "RGB":
                img = img.convert("RGB")
            bio = io.BytesIO()
            img.save(bio, "JPEG", quality=THUMB_QUALITY, optimize=True)
            data = "data:image/jpeg;base64," + base64.b64encode(bio.getvalue()).decode("ascii")
        except Exception:  # noqa: BLE001 - 坏图/权限问题不该让前端拿到异常
            return ""
        with self._thumb_lock:
            if len(self._thumbs) >= THUMB_CACHE_LIMIT:
                self._thumbs.clear()
            self._thumbs[wid] = data
        return data

    # ---------- 本地预览 / 打开工坊页面 ----------

    def open_preview(self, wid: str) -> dict:
        """用系统默认播放器打开该壁纸的素材文件（等同 gui 版「▶ 预览」）。"""
        with self._lock:
            item = self._by_wid.get(str(wid))
        if item is None:
            return _err("unknown")
        media = thumbnails.pick_media_file(item.path)
        if not media:
            return _err("nofile")
        try:
            os.startfile(media)  # noqa: S606 - 视频交给默认播放器
        except OSError as e:
            return _err("open", f"打开失败：{e}")
        return {"ok": True, "path": media}

    def open_url(self, wid: str) -> dict:
        """在系统浏览器里打开 Steam 工坊页面（webview 内点链接会顶掉界面，所以走 API）。"""
        with self._lock:
            item = self._by_wid.get(str(wid))
        if item is None:
            return _err("unknown")
        try:
            webbrowser.open(item.url)
        except Exception as e:  # noqa: BLE001
            return _err("open", f"打开浏览器失败：{e}")
        return {"ok": True, "url": item.url}

    # ---------- 退订 / 退订并清理 ----------

    def unsubscribe(self, wids, clean: bool = False) -> dict:
        """退订选中的订阅中壁纸；clean=True 时顺带清理本地文件。

        事件：busy → opProgress* → unsubDone → busy(false)。
        """
        if self._is_blocked():
            return _err("blocked")
        with self._lock:
            chosen = [self._by_wid[w] for w in self._ids(wids)
                      if w in self._by_wid and self._by_wid[w].subscribed]
        if not chosen:
            return _err("empty", "选中的壁纸里没有正在订阅的（退订只处理订阅中的）")
        clean = bool(clean)
        if not self._busy_on("unsubscribe"):
            return _err("busy")
        threading.Thread(
            target=self._unsub_worker, args=(chosen, clean),
            name="we-cleaner-unsub", daemon=True,
        ).start()
        return {"started": True, "count": len(chosen), "clean": clean}

    def _unsub_worker(self, chosen: list[core.Item], clean: bool) -> None:
        ok = fail = 0
        fails: list[str] = []  # 展示用文本
        fail_ids: set[str] = set()
        cleaned = freed = 0
        clean_fails: list[str] = []
        error = ""
        try:
            with self._steam_lock:
                try:
                    if not steamapi.connect():
                        error = steamapi.last_error or "无法连接 Steam，请确认 Steam 正在运行"
                except Exception as e:  # noqa: BLE001
                    error = str(e)
                if error:
                    fail = len(chosen)
                    fails = [i.wid for i in chosen]
                    fail_ids = {i.wid for i in chosen}
                else:
                    try:
                        for i, item in enumerate(chosen, 1):
                            self._push(
                                "opProgress", task="unsubscribe", done=i, total=len(chosen),
                                wid=item.wid,
                                text=f"正在退订 {i}/{len(chosen)}：{(item.title or item.wid)[:20]}",
                            )
                            try:
                                if steamapi.unsubscribe(item.wid):
                                    ok += 1
                                else:
                                    fail += 1
                                    fails.append(item.wid)
                                    fail_ids.add(item.wid)
                            except Exception as e:  # noqa: BLE001 - 单个失败不中断批量
                                fail += 1
                                fails.append(f"{item.wid}（{e}）")
                                fail_ids.add(item.wid)
                    finally:
                        steamapi.shutdown()

            # 连不上 Steam：整批都没执行 —— 绝不动 item 状态、不写历史。
            # （若这里把状态标成"未订阅"，用户接着就能删掉仍在订阅的壁纸；gui 版也是提前返回的。）
            unsub_ok = [i for i in chosen if i.wid not in fail_ids]

            # 清理本地文件：放在 Steam 锁之外（IO 慢），失败重试一次
            if clean and unsub_ok:
                from send2trash import send2trash

                for item in unsub_ok:
                    for attempt in (0, 1):
                        try:
                            if self.permanent_delete:
                                import shutil

                                shutil.rmtree(item.path)
                            else:
                                send2trash(item.path)
                            freed += max(item.size, 0)
                            cleaned += 1
                            break
                        except Exception:  # noqa: BLE001 - Steam 可能仍持有句柄
                            if attempt == 0:
                                time.sleep(1.5)
                            else:
                                clean_fails.append(item.wid)

            # 只把"真的退订成功"的项写进历史、标成未订阅（失败项保持原样，等下次同步/重试）
            if unsub_ok:
                core.record_history(unsub_ok, "unsubscribe")
            now = int(time.time())
            with self._lock:
                for item in unsub_ok:
                    item.subscribed = False
                    item.sub_index = -1
                    item.time_updated = item.time_updated or now
                gone = {i.wid for i in unsub_ok} - set(clean_fails)
                if clean:
                    self._items = [i for i in self._items if i.wid not in gone]
                    self._by_wid = {i.wid: i for i in self._items}
                summary = self._summary()
                patches = [patch_dict(i, clean and i.wid in gone) for i in chosen]
            if clean:
                self._drop_thumbs(gone)

            self._push(
                "unsubDone",
                ok=ok, fail=fail,
                fails=fails[:10], failIds=sorted(fail_ids),
                clean=clean, cleaned=cleaned, freed=max(freed, 0),
                freedText=core.fmt_size(max(freed, 0)),
                cleanFails=clean_fails[:10],
                error=error,
                requested=[i.wid for i in chosen],
                patched=patches,
                **summary,
            )
        except Exception as e:  # noqa: BLE001
            self._push("taskError", task="unsubscribe", message=f"{type(e).__name__}: {e}")
        finally:
            self._busy_off()

    # ---------- 删除未订阅残留 ----------

    def delete(self, wids) -> dict:
        """删除选中的未订阅残留（默认进回收站；彻底删除由 set_permanent 决定）。

        事件：busy → opProgress* → delDone → busy(false)。
        """
        if self._is_blocked():
            return _err("blocked")
        with self._lock:
            chosen = [self._by_wid[w] for w in self._ids(wids)
                      if w in self._by_wid and not self._by_wid[w].subscribed]
        if not chosen:
            return _err("empty", "选中的壁纸里没有未订阅的（订阅中的请先退订）")
        permanent = bool(self.permanent_delete)
        if not self._busy_on("delete"):
            return _err("busy")
        threading.Thread(
            target=self._delete_worker, args=(chosen, permanent),
            name="we-cleaner-delete", daemon=True,
        ).start()
        return {"started": True, "count": len(chosen), "permanent": permanent}

    def _delete_worker(self, chosen: list[core.Item], permanent: bool) -> None:
        try:
            def progress(done: int, total: int, item: core.Item) -> None:
                self._push(
                    "opProgress", task="delete", done=done, total=total, wid=item.wid,
                    text=f"正在删除 {done}/{total}：{(item.title or item.wid)[:20]}",
                )

            freed, failures = core.delete_items(chosen, permanent=permanent, progress=progress)
            freed = max(freed, 0)
            fail_ids = {w for w, _ in failures}
            done_items = [i for i in chosen if i.wid not in fail_ids]
            if done_items:  # 空列表不写盘（避免无谓改动 history.json）
                core.record_history(done_items, "delete")
            with self._lock:
                done_ids = {i.wid for i in done_items}
                self._items = [i for i in self._items if i.wid not in done_ids]
                self._by_wid = {i.wid: i for i in self._items}
                summary = self._summary()
                patches = [patch_dict(i, True) for i in done_items]
            self._drop_thumbs(done_ids)

            self._push(
                "delDone",
                freed=freed,
                freedText=core.fmt_size(freed),
                permanent=permanent,
                fails=[w for w, _ in failures][:10],
                failIds=sorted(fail_ids),
                requested=[i.wid for i in chosen],
                patched=patches,
                **summary,
            )
        except Exception as e:  # noqa: BLE001
            self._push("taskError", task="delete", message=f"{type(e).__name__}: {e}")
        finally:
            self._busy_off()

    # ---------- 历史 / 恢复订阅 ----------

    def history(self) -> dict:
        """退订/删除历史（新→旧），可按 wid 恢复订阅。"""
        items = self._history_items()
        return {"items": items, "count": len(items)}

    def resubscribe(self, wids) -> dict:
        """按历史记录重新订阅（Steam 会自动重新下载）。只读锁定不拦这个（它不删东西）。"""
        records = core.load_history().get("items", {})
        targets = [w for w in self._ids(wids) if w in records]
        if not targets:
            return _err("empty", "选中的对象不在历史记录里")
        if not self._busy_on("resubscribe"):
            return _err("busy")
        threading.Thread(
            target=self._resub_worker, args=(targets,),
            name="we-cleaner-resub", daemon=True,
        ).start()
        return {"started": True, "count": len(targets)}

    def _resub_worker(self, targets: list[str]) -> None:
        ok = fail = 0
        confirmed: list[str] = []
        error = ""
        titles = core.load_history().get("items", {})
        try:
            with self._steam_lock:
                try:
                    if not steamapi.connect():
                        error = steamapi.last_error or "无法连接 Steam，请确认 Steam 正在运行"
                except Exception as e:  # noqa: BLE001
                    error = str(e)
                if not error:
                    try:
                        before = set(steamapi.get_subscribed_ordered())
                        for i, wid in enumerate(targets, 1):
                            title = str((titles.get(wid) or {}).get("title") or wid)
                            self._push(
                                "opProgress", task="resubscribe", done=i, total=len(targets),
                                wid=wid, text=f"正在恢复订阅 {i}/{len(targets)}：{title[:20]}",
                            )
                            try:
                                if steamapi.subscribe(wid):
                                    ok += 1
                                else:
                                    fail += 1
                            except Exception:  # noqa: BLE001
                                fail += 1
                        after = set(steamapi.get_subscribed_ordered())
                        confirmed = [w for w in targets if w in after and w not in before]
                        if ok:
                            core.drop_history([w for w in targets if w in after])
                    finally:
                        steamapi.shutdown()
                else:
                    fail = len(targets)

            self._push(
                "resubDone",
                ok=ok, fail=fail, error=error,
                confirmed=confirmed,
                requested=targets,
                history=self._history_items(),
            )
        except Exception as e:  # noqa: BLE001
            self._push("taskError", task="resubscribe", message=f"{type(e).__name__}: {e}")
        finally:
            self._busy_off()

    # ---------- 设置 ----------

    def set_permanent(self, value: bool) -> dict:
        """切换「彻底删除」模式（默认 False = 进回收站）。"""
        self.permanent_delete = bool(value)
        return {"permanent": self.permanent_delete}
