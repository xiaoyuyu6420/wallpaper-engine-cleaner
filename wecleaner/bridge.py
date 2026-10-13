"""pywebview 桥接层：把核心功能暴露给前端 JS（window.pywebview.api.*）。

设计：
- 所有长任务（扫描/退订/清理/恢复）在后台线程执行，通过 evaluate_js
  向前端推送进度与结果事件（ui.event({...})）。
- 订阅状态不可信时进入只读（blocked），前端据此禁用操作按钮；
  用户可在前端显式解锁（unlock）。
"""

from __future__ import annotations

import base64
import io
import json
import os
import threading
import time
from pathlib import Path

from . import core, steamapi, thumbnails


def _item_dict(item: core.Item) -> dict:
    date = time.strftime("%y-%m-%d", time.localtime(item.time_updated)) if item.time_updated else "下载中"
    return {
        "wid": item.wid,
        "title": item.title or item.wid,
        "size": item.size,
        "size_text": "⏳ 变化中" if item.size < 0 else core.fmt_size(item.size),
        "date": date,
        "subscribed": item.subscribed,
        "url": item.url,
    }


class Api:
    """暴露给前端 JS 的方法集（pywebview js_api）。"""

    def __init__(self) -> None:
        self.window = None  # 由 run 注入
        self._busy = False
        self._manual_unlock = False
        self._connect_error = ""
        self._items: list[core.Item] = []
        self._by_wid: dict[str, core.Item] = {}
        self._thumb_b64: dict[str, str] = {}
        self._thumb_gen = 0
        self.permanent_delete = False

    # ---------- 内部 ----------

    def _push(self, event: str, **payload) -> None:
        if self.window is None:
            return
        try:
            data = json.dumps({"event": event, **payload}, ensure_ascii=False)
            self.window.evaluate_js(f"window.__dispatch({data})")
        except Exception:  # noqa: BLE001 - 窗口关闭瞬间可能失败
            pass

    def _busy_on(self) -> bool:
        if self._busy:
            return False
        self._busy = True
        self._push("busy", value=True)
        return True

    def _busy_off(self) -> None:
        self._busy = False
        self._push("busy", value=False)

    def _items_payload(self) -> list[dict]:
        return [_item_dict(i) for i in self._items]

    def _finish_common(self) -> dict:
        n_sub = sum(1 for i in self._items if i.subscribed)
        return {
            "items": self._items_payload(),
            "count": len(self._items),
            "subscribed": n_sub,
            "unsubscribed": len(self._items) - n_sub,
            "total_size": sum(max(i.size, 0) for i in self._items),
        }

    # ---------- 扫描 ----------

    def scan(self) -> dict:
        if not self._busy_on():
            return {"error": "已有任务进行中"}
        threading.Thread(target=self._scan_worker, daemon=True).start()
        return {"started": True}

    def _scan_worker(self) -> None:
        override = None
        self._connect_error = ""
        try:
            if steamapi.connect():
                override = steamapi.get_subscribed()
                self._connect_error = ""
            else:
                self._connect_error = steamapi.last_error
        except Exception as e:  # noqa: BLE001
            self._connect_error = str(e)

        def progress(done: int, total: int, item: core.Item) -> None:
            self._push("scan_progress", done=done, total=total, title=item.title[:20])

        res = core.scan(core.WE_APPID, on_progress=progress, subscribed_override=override)
        self._items = res.items
        self._by_wid = {i.wid: i for i in res.items}
        self._thumb_b64.clear()
        self._busy = False

        blocked = res.deletion_blocked and not self._manual_unlock
        payload = self._finish_common()
        payload.update({
            "blocked": blocked,
            "can_unlock": res.deletion_blocked,
            "connect_error": self._connect_error,
            "warnings": res.warnings,
        })
        self._push("scan_done", **payload)

    def unlock(self) -> dict:
        """用户手动确认已全部退订，解锁清理。"""
        self._manual_unlock = True
        self._push("unlocked", {})
        return {"ok": True}

    # ---------- 缩略图（前端按需取）----------

    def get_thumb(self, wid: str) -> dict:
        if wid in self._thumb_b64:
            return {"wid": wid, "data": self._thumb_b64[wid]}
        item = self._by_wid.get(wid)
        if item is None or not item.path:
            return {"wid": wid, "data": ""}
        try:
            img = thumbnails.extract(item.path)
            bio = io.BytesIO()
            img.save(bio, "JPEG", quality=80)
            data = "data:image/jpeg;base64," + base64.b64encode(bio.getvalue()).decode()
            self._thumb_b64[wid] = data
            return {"wid": wid, "data": data}
        except Exception:  # noqa: BLE001
            return {"wid": wid, "data": ""}

    def open_preview(self, wid: str) -> dict:
        item = self._by_wid.get(wid)
        if item is None:
            return {"error": "unknown id"}
        media = thumbnails.pick_media_file(item.path)
        if media:
            os.startfile(media)  # noqa: S606 - 视频交给默认播放器
            return {"ok": True}
        return {"error": "没有可播放或查看的文件"}

    # ---------- 退订 / 清理 / 一步到位 ----------

    def unsubscribe(self, wids: list[str], clean: bool = False) -> dict:
        chosen = [self._by_wid[w] for w in wids if w in self._by_wid and self._by_wid[w].subscribed]
        if not chosen or not self._busy_on():
            return {"error": "没有可退订的订阅中壁纸，或已有任务进行中"}
        self._unsub_targets = chosen
        self._unsub_clean = clean
        threading.Thread(target=self._unsub_worker, args=(chosen, clean), daemon=True).start()
        return {"started": True, "count": len(chosen)}

    def _unsub_worker(self, chosen: list[core.Item], clean: bool) -> None:
        ok = fail = 0
        fails: list[str] = []
        if not steamapi.connect():
            self._busy_off()
            self._push("unsub_done", ok=0, fail=len(chosen), fails=[i.wid for i in chosen],
                       error=steamapi.last_error, cleaned=0, freed=0, clean_fails=[])
            return
        try:
            for i, item in enumerate(chosen, 1):
                self._push("op_progress", text=f"正在退订 {i}/{len(chosen)}：{item.title[:20]}")
                try:
                    if steamapi.unsubscribe(item.wid):
                        ok += 1
                    else:
                        fail += 1
                        fails.append(item.wid)
                except Exception as e:  # noqa: BLE001
                    fail += 1
                    fails.append(f"{item.wid}（{e}）")
        finally:
            steamapi.shutdown()

        cleaned = freed = 0
        clean_fails: list[str] = []
        if clean and ok:
            from send2trash import send2trash

            for item in chosen:
                if item.wid in fails:
                    continue
                for attempt in range(2):
                    try:
                        if self.permanent_delete:
                            import shutil

                            shutil.rmtree(item.path)
                        else:
                            send2trash(item.path)
                        freed += max(item.size, 0)
                        cleaned += 1
                        break
                    except Exception:  # noqa: BLE001
                        if attempt == 0:
                            time.sleep(1.5)
                        else:
                            clean_fails.append(item.wid)

        now = int(time.time())
        targets = chosen
        core.record_history(targets, "unsubscribe")
        for item in targets:
            item.subscribed = False
            item.time_updated = item.time_updated or now
        done_ids = {i.wid for i in targets} - set(clean_fails)
        if clean:
            self._items = [i for i in self._items if i.wid not in done_ids]
            self._by_wid = {i.wid: i for i in self._items}
            for wid in done_ids:
                self.checked_discard(wid)
        self._busy_off()

        payload = self._finish_common()
        payload.update({
            "ok": ok, "fail": fail, "fails": fails[:10],
            "clean": clean, "cleaned": cleaned, "freed": freed,
            "clean_fails": clean_fails[:10],
        })
        self._push("unsub_done", **payload)

    def checked_discard(self, wid: str) -> None:
        """占位：勾选状态由前端持有。"""

    def delete(self, wids: list[str]) -> dict:        chosen = [self._by_wid[w] for w in wids if w in self._by_wid and not self._by_wid[w].subscribed]
        if not chosen or not self._busy_on():
            return {"error": "没有可删除的未订阅壁纸，或已有任务进行中"}
        threading.Thread(target=self._delete_worker, args=(chosen, self.permanent_delete), daemon=True).start()
        return {"started": True, "count": len(chosen)}

    def _delete_worker(self, chosen: list[core.Item], permanent: bool) -> None:
        def progress(done: int, total: int, item: core.Item) -> None:
            self._push("op_progress", text=f"正在删除 {done}/{total}：{item.title[:20]}")

        freed, failures = core.delete_items(chosen, permanent=permanent, progress=progress)
        core.record_history([i for i in chosen if i.wid not in {w for w, _ in failures}], "delete")
        done_ids = {i.wid for i in chosen} - {w for w, _ in failures}
        self._items = [i for i in self._items if i.wid not in done_ids]
        self._by_wid = {i.wid: i for i in self._items}
        self._busy_off()
        payload = self._finish_common()
        payload.update({"freed": freed, "permanent": permanent,
                        "fails": [w for w, _ in failures][:10]})
        self._push("del_done", **payload)

    # ---------- 历史 / 恢复订阅 ----------

    def history(self) -> dict:
        return {"items": core.load_history()["items"]}

    def resubscribe(self, wids: list[str]) -> dict:
        records = core.load_history()["items"]
        targets = [w for w in wids if w in records]
        if not targets or not self._busy_on():
            return {"error": "没有可恢复的对象，或已有任务进行中"}
        threading.Thread(target=self._resub_worker, args=(targets,), daemon=True).start()
        return {"started": True, "count": len(targets)}

    def _resub_worker(self, targets: list[str]) -> None:
        ok = fail = 0
        confirmed: list[str] = []
        if not steamapi.connect():
            self._busy_off()
            self._push("resub_done", ok=0, fail=len(targets), error=steamapi.last_error, confirmed=[])
            return
        try:
            before = steamapi.get_subscribed()
            for i, wid in enumerate(targets, 1):
                self._push("op_progress", text=f"正在恢复订阅 {i}/{len(targets)}：{_records_title(wid)}")
                try:
                    if steamapi.subscribe(wid):
                        ok += 1
                    else:
                        fail += 1
                except Exception:  # noqa: BLE001
                    fail += 1
            after = steamapi.get_subscribed()
            confirmed = [w for w in targets if w in after and w not in before]
            if ok:
                core.drop_history([w for w in targets if w in after])
        finally:
            steamapi.shutdown()
        self._busy_off()
        self._push("resub_done", ok=ok, fail=fail, error="", confirmed=confirmed)

    def set_permanent(self, value: bool) -> dict:
        self.permanent_delete = bool(value)
        return {"permanent": self.permanent_delete}


def _records_title(wid: str) -> str:
    info = core.load_history()["items"].get(wid, {})
    return str(info.get("title", wid))[:20]
