"""图形界面（customtkinter 深色卡片墙 + 分页渲染，保证滚动流畅）。"""

from __future__ import annotations

import math
import os
import queue
import threading
import time
import webbrowser
from tkinter import messagebox

import customtkinter as ctk

from . import core, steamapi, thumbnails

COLS = 4  # 初始列数，随后按窗口宽度自适应
PAGE_ROWS = 4  # 每页行数，页容量 = 列数 × 行数
ACCENT = "#4f8cff"
BG = "#1b1d23"
CARD = "#242730"
CARD_HOVER_BORDER = "#3a3f4b"


class App:
    def __init__(self, root: ctk.CTk, appid: str):
        self.root = root
        self.appid = appid
        self.q: queue.Queue = queue.Queue()
        self.items: list[core.Item] = []
        self.checked: set[str] = set()
        self.cards: dict[str, ctk.CTkFrame] = {}
        self.marks: dict[str, ctk.CTkLabel] = {}
        self.thumb_labels: dict[str, ctk.CTkLabel] = {}
        self.busy = False
        self.gen = 0  # 扫描代际，防止旧缩略图线程写进新界面
        self._seen: dict[str, core.Item] = {}  # 当前已知的项
        self._sort_mode = "大小"  # 大小 / 时间（新→旧） / 时间（旧→新）
        self._filter_text = ""
        self._cols = COLS  # 动态列数，随窗口宽度自适应
        self._visible: list[core.Item] = []  # 排序+过滤后的完整列表
        self.page = 0  # 当前页（0 起）
        self._thumb_gen = 0  # 缩略图加载代际（翻页即失效）
        self.infos: dict[str, ctk.CTkLabel] = {}
        self._relayout_job = None
        self._placeholder = ctk.CTkImage(
            light_image=thumbnails.placeholder(), size=thumbnails.THUMB_SIZE
        )
        self._build()
        self.root.bind("<Configure>", self._on_resize)
        self.root.after(100, self._poll)
        self.start_scan()

    # ---------- 界面 ----------

    def _build(self) -> None:
        self.root.title("WE Cleaner · Wallpaper Engine 残留清理器")
        self.root.geometry("1020x780")
        self.root.minsize(880, 640)
        self.root.configure(fg_color=BG)

        header = ctk.CTkFrame(self.root, fg_color="transparent")
        header.pack(fill="x", padx=14, pady=(12, 6))
        self.btn_scan = ctk.CTkButton(header, text="↻ 重新扫描", width=104, command=self.start_scan)
        self.btn_scan.pack(side="left")
        self.sort_menu = ctk.CTkOptionMenu(
            header, width=150,
            values=["按大小", "按时间（新→旧）", "按时间（旧→新）"],
            command=self._change_sort,
        )
        self.sort_menu.pack(side="left", padx=8)
        self.btn_hist = ctk.CTkButton(
            header, text="🕘 历史", width=80, fg_color="#333845", hover_color="#3f4553",
            command=self._open_history,
        )
        self.btn_hist.pack(side="left", padx=4)
        self.lbl_state = ctk.CTkLabel(header, text="正在扫描…", text_color="#9aa3af")
        self.lbl_state.pack(side="left", padx=10)

        right = ctk.CTkFrame(header, fg_color="transparent")
        right.pack(side="right")
        self.btn_del = ctk.CTkButton(
            right, text="删除选中", width=90, fg_color="#dc2626", hover_color="#b91c1c",
            state="disabled", command=self.on_delete,
        )
        self.btn_del.pack(side="left", padx=(10, 0))
        self.btn_unsub = ctk.CTkButton(
            right, text="退订选中", width=90, fg_color="#d97706", hover_color="#b45309",
            state="disabled", command=self.on_unsubscribe,
        )
        self.btn_unsub.pack(side="left", padx=(10, 0))
        self.btn_all = ctk.CTkButton(
            right, text="全选", width=60, fg_color="#333845", hover_color="#3f4553",
            command=lambda: self._check_all(True),
        )
        self.btn_all.pack(side="left", padx=6)
        self.btn_none = ctk.CTkButton(
            right, text="全不选", width=60, fg_color="#333845", hover_color="#3f4553",
            command=lambda: self._check_all(False),
        )
        self.btn_none.pack(side="left")
        self.var_permanent = ctk.BooleanVar(value=False)
        ttk_hint = "彻底删除（不进回收站，慎选）"
        ctk.CTkCheckBox(right, text=ttk_hint, variable=self.var_permanent).pack(
            side="left", padx=(0, 12)
        )

        self.grid_frame = ctk.CTkScrollableFrame(self.root, fg_color=BG)
        self.grid_frame.pack(fill="both", expand=True, padx=10)

        search = ctk.CTkFrame(self.root, fg_color="transparent")
        search.pack(fill="x", padx=14, pady=(2, 0))
        self.btn_next = ctk.CTkButton(search, text="▶", width=36, fg_color="#333845",
                                      hover_color="#3f4553", state="disabled", command=self._next_page)
        self.btn_next.pack(side="right")
        self.lbl_page = ctk.CTkLabel(search, text="1 / 1", text_color="#cbd5e1")
        self.lbl_page.pack(side="right", padx=4)
        self.btn_prev = ctk.CTkButton(search, text="◀", width=36, fg_color="#333845",
                                      hover_color="#3f4553", state="disabled", command=self._prev_page)
        self.btn_prev.pack(side="right", padx=(2, 8))
        ctk.CTkLabel(search, text="🔍 过滤", text_color="#9aa3af").pack(side="left")
        self.search_var = ctk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._on_search(self.search_var.get()))
        ctk.CTkEntry(search, placeholder_text="输入标题或 ID 过滤（实时）", textvariable=self.search_var).pack(
            side="left", fill="x", expand=True, padx=8
        )

        self.lbl_stats = ctk.CTkLabel(self.root, text="", anchor="w", text_color="#cbd5e1")
        self.lbl_stats.pack(fill="x", padx=14, pady=(2, 0))
        self.lbl_warn = ctk.CTkLabel(self.root, text="", anchor="w", text_color="#f59e0b", wraplength=960, justify="left")
        self.lbl_warn.pack(fill="x", padx=14, pady=(0, 10))

    # ---------- 卡片 ----------

    def _card_title(self, item: core.Item) -> str:
        t = item.title or item.wid
        return t[:20] + "…" if len(t) > 21 else t

    def _mark_text(self, item: core.Item) -> str:
        sub = "订阅中" if item.subscribed else "未订阅"
        sel = "已勾选" if item.wid in self.checked else "未选"
        return f"{sub} · {sel}"

    def _make_card(self, item: core.Item) -> ctk.CTkFrame:
        card = ctk.CTkFrame(
            self.grid_frame, corner_radius=10, border_width=2,
            border_color=CARD, fg_color=CARD,  # 未勾选时边框与底同色（ctk 不允许 transparent）
        )
        thumb = ctk.CTkLabel(card, text="", image=self._placeholder)
        thumb.pack(padx=8, pady=(8, 2))
        title = ctk.CTkLabel(
            card, justify="center", text_color="#e5e7eb",
            text=self._card_title(item),
        )
        title.pack()
        meta = ctk.CTkLabel(
            card, justify="center", text_color="#9aa3af", font=("", 12),
            text=f"{'⏳ 变化中' if item.size < 0 else core.fmt_size(item.size)} · {time.strftime('%y-%m-%d', time.localtime(item.time_updated)) if item.time_updated else '下载中'}",
        )
        meta.pack(pady=(1, 0))
        row = ctk.CTkFrame(card, fg_color="transparent")
        row.pack(fill="x", padx=8, pady=(2, 8))
        mark = ctk.CTkLabel(
            row, text=self._mark_text(item),
            text_color="#4f8cff" if item.subscribed else "#7b8291", font=("", 12),
        )
        mark.pack(side="left")
        ctk.CTkButton(
            row, text="▶ 预览", width=56, height=24, fg_color="#333845",
            hover_color="#3f4553", font=("", 12),
            command=lambda: self._preview_local(item),
        ).pack(side="right")

        widgets = (card, thumb, title, meta, mark)
        for w in widgets:
            w.bind("<Button-1>", lambda e, wid=item.wid: self._toggle(wid))
            w.bind("<Double-1>", lambda e, wid=item.wid: webbrowser.open(item.url))
        self.cards[item.wid] = card
        self.marks[item.wid] = mark
        self.thumb_labels[item.wid] = thumb
        self.infos[item.wid] = meta
        self._seen[item.wid] = item
        if item.wid in self.checked:
            mark.configure(text=self._mark_text(item), text_color=ACCENT)
            card.configure(border_color=ACCENT)
        return card

    def _toggle(self, wid: str) -> None:
        item = self._seen.get(wid)
        if item is None or wid not in self.cards:
            return
        if wid in self.checked:
            self.checked.discard(wid)
        else:
            self.checked.add(wid)
        self.marks[wid].configure(
            text=self._mark_text(item),
            text_color=ACCENT if wid in self.checked else ("#4f8cff" if item.subscribed else "#7b8291"),
        )
        self.cards[wid].configure(border_color=ACCENT if wid in self.checked else CARD)
        self._update_stats()

    def _check_all(self, on: bool) -> None:
        # 全选作用于过滤后的完整列表（跨页），翻页后勾选仍在
        for item in self._visible:
            if on:
                self.checked.add(item.wid)
            else:
                self.checked.discard(item.wid)
        self._render_page()

    def _update_stats(self) -> None:
        seen = list(self._seen.values())
        n_sub = sum(1 for i in seen if i.subscribed)
        unknown = sum(1 for i in seen if i.size < 0)
        total_all = sum(max(i.size, 0) for i in seen)
        checked = [i for i in seen if i.wid in self.checked]
        checked_total = sum(max(i.size, 0) for i in checked)
        c_sub = sum(1 for i in checked if i.subscribed)
        tail_unknown = f"（{unknown} 个大小变化中）" if unknown else ""
        self.lbl_stats.configure(
            text=(
                f"共 {len(seen)} 个，{core.fmt_size(total_all)}{tail_unknown}　|　"
                f"订阅中 {n_sub} · 未订阅 {len(seen) - n_sub}　|　"
                f"已勾选 {len(checked)} 个（订阅中 {c_sub}）/ {core.fmt_size(checked_total)}"
            )
        )

    # ---------- 本地快速预览 ----------

    def _preview_local(self, item: core.Item) -> None:
        media = thumbnails.pick_media_file(item.path)
        if media:
            os.startfile(media)  # 视频交给默认播放器，图片交给看图器
        else:
            messagebox.showinfo("无法预览", "该文件夹里没有可播放或查看的文件。")

    # ---------- 扫描 ----------

    def start_scan(self) -> None:
        if self.busy:
            return
        self.busy = True
        self.gen += 1
        self.items = []
        self.res = None
        for b in (self.btn_scan, self.btn_del, self.btn_unsub, self.btn_all, self.btn_none):
            b.configure(state="disabled")
        self._clear_grid()
        self.lbl_warn.configure(text="")
        self._set_state("正在扫描…")
        threading.Thread(target=self._scan_worker, daemon=True).start()

    def _scan_worker(self) -> None:
        gen = self.gen
        try:
            override = None
            try:
                if steamapi.connect():
                    override = steamapi.get_subscribed()
            except Exception:  # noqa: BLE001 - API 失败时回退 ACF
                override = None
            res = core.scan(
                self.appid,
                on_progress=lambda done, total, item: self.q.put(("scan_prog", done, total, item)),
                subscribed_override=override,
            )
        except Exception as e:  # noqa: BLE001
            self.q.put(("scan_error", str(e)))
            return
        self.q.put(("scan_done", res))

    def _clear_grid(self) -> None:
        for w in self.grid_frame.winfo_children():
            w.destroy()
        self.cards.clear()
        self.marks.clear()
        self.thumb_labels.clear()
        self.infos.clear()
        self.checked.clear()
        self._seen.clear()

    def _sorted_items(self) -> list[core.Item]:
        if self._sort_mode == "时间（新→旧）":
            return sorted(self.items, key=lambda i: (i.time_updated, i.size), reverse=True)
        if self._sort_mode == "时间（旧→新）":
            return sorted(self.items, key=lambda i: (i.time_updated, i.size))
        return sorted(self.items, key=lambda i: i.size, reverse=True)

    def _change_sort(self, mode: str) -> None:
        self._sort_mode = mode[1:] if mode.startswith("按") else mode  # 去掉"按"前缀
        self._relayout()

    def _on_search(self, text: str) -> None:
        self._filter_text = text.strip()
        self._relayout()

    def _on_resize(self, event) -> None:
        if event.widget is not self.root:
            return
        w = self.grid_frame.winfo_width()
        if w < 100:
            return
        new_cols = max(2, min(9, (w - 30) // 216))
        if new_cols != self._cols:
            self._cols = new_cols
            if self._relayout_job:
                self.root.after_cancel(self._relayout_job)
            self._relayout_job = self.root.after(150, self._relayout)

    def _page_size(self) -> int:
        return self._cols * PAGE_ROWS

    def _total_pages(self) -> int:
        return max(1, math.ceil(len(self._visible) / self._page_size()))

    def _relayout(self) -> None:
        """按当前排序 + 过滤条件重建可见列表，并渲染当前页。"""
        if self._relayout_job:
            self.root.after_cancel(self._relayout_job)
            self._relayout_job = None
        ft = self._filter_text.lower()
        self._visible = [
            i for i in self._sorted_items()
            if not ft or ft in i.title.lower() or ft in i.wid
        ]
        if self.page >= self._total_pages():
            self.page = self._total_pages() - 1
        self._render_page()

    def _render_page(self) -> None:
        """只渲染当前页的卡片——控件数量恒定，滚动才流畅。"""
        for w in self.grid_frame.winfo_children():
            w.destroy()
        self.cards.clear()
        self.marks.clear()
        self.thumb_labels.clear()
        self.infos.clear()

        chunk = self._visible[self.page * self._page_size():(self.page + 1) * self._page_size()]
        if not chunk and not self._visible and self.items:
            pass  # 有条目但被过滤光：显示过滤提示由状态栏负责
        for idx, item in enumerate(chunk):
            self._make_card(item).grid(
                row=idx // self._cols, column=idx % self._cols, padx=7, pady=7, sticky="n"
            )
        for c in range(self._cols):
            self.grid_frame.grid_columnconfigure(c, weight=1)

        total = self._total_pages()
        self.lbl_page.configure(text=f"{self.page + 1} / {total}")
        has_pager = total > 1
        self.btn_prev.configure(state="normal" if has_pager and self.page > 0 else "disabled")
        self.btn_next.configure(state="normal" if has_pager and self.page < total - 1 else "disabled")
        try:  # 翻页后回到顶部
            self.grid_frame._parent_canvas.yview_moveto(0)
        except Exception:  # noqa: BLE001 - 内部 API 变化时忽略
            pass

        self._update_stats()
        # 只加载当前页的缩略图
        self._thumb_gen += 1
        threading.Thread(
            target=self._thumb_worker, args=(self._thumb_gen, list(chunk)), daemon=True
        ).start()

    def _prev_page(self) -> None:
        if self.page > 0 and not self.busy:
            self.page -= 1
            self._render_page()

    def _next_page(self) -> None:
        if self.page < self._total_pages() - 1 and not self.busy:
            self.page += 1
            self._render_page()

    def _finish_scan(self, res: core.ScanResult) -> None:
        self.res = res
        self.items = res.items
        self.busy = False
        self.btn_scan.configure(state="normal")
        # 订阅状态不可信：禁掉一切批量选择/删除/退订入口
        if res.deletion_blocked:
            for b in (self.btn_del, self.btn_unsub, self.btn_all, self.btn_none):
                b.configure(state="disabled")
        else:
            self.btn_all.configure(state="normal")
            self.btn_none.configure(state="normal")
            self.btn_del.configure(
                state="normal" if any(not i.subscribed for i in res.items) else "disabled"
            )
            self.btn_unsub.configure(
                state="normal" if any(i.subscribed for i in res.items) else "disabled"
            )

        # 一次性按当前排序/过滤/分页渲染（流式进度已在状态栏实时反馈）
        self._seen = {i.wid: i for i in res.items}
        self._relayout()

        n_sub = sum(1 for i in res.items if i.subscribed)
        if not res.libraries:
            self._set_state("没有找到 Steam", warn=True)
        elif not res.items:
            self._set_state("很干净，没有发现壁纸 ✔")
        else:
            self._set_state(f"共 {len(res.items)} 个壁纸（订阅中 {n_sub}，未订阅 {len(res.items) - n_sub}）")
        self._update_stats()

        warnings = list(res.warnings)
        running = core.running_processes(core.STEAM_PROCS + core.WE_PROCS)
        if running & set(core.WE_PROCS):
            warnings.append("Wallpaper Engine 正在运行：删除未订阅壁纸前建议先退出 WE，文件可能被占用。")
        self.lbl_warn.configure(
            text="\n".join("⚠ " + w for w in warnings),
            text_color="#ef4444" if res.deletion_blocked else "#f59e0b",
        )

    def _thumb_worker(self, gen: int, items: list[core.Item]) -> None:
        for item in items:
            if gen != self._thumb_gen:
                return
            img = thumbnails.extract(item.path)
            self.q.put(("thumb", gen, item.wid, img))

    def _set_state(self, text: str, warn: bool = False) -> None:
        self.lbl_state.configure(text=text, text_color="#f59e0b" if warn else "#9aa3af")

    # ---------- 删除 ----------

    def on_delete(self) -> None:
        chosen = [i for i in self.items if i.wid in self.checked and not i.subscribed]
        skipped = sum(1 for i in self.items if i.wid in self.checked and i.subscribed)
        if not chosen or self.busy:
            if skipped:
                messagebox.showinfo("提示", f"勾选中有 {skipped} 个订阅中壁纸，删除只处理未订阅的；订阅中的请用「退订选中」。")
            return
        total = sum(i.size for i in chosen)
        permanent = self.var_permanent.get()
        mode = "彻底删除（无法恢复！）" if permanent else "移入回收站（清空回收站前可还原）"
        extra = f"\n（另有 {skipped} 个订阅中项目已跳过，请用「退订选中」处理）" if skipped else ""
        preview = "\n".join(f"  · {i.title[:24]}" for i in chosen[:5])
        more = f"\n  ……等共 {len(chosen)} 个" if len(chosen) > 5 else ""
        if not messagebox.askyesno(
            "确认删除",
            f"将删除 {len(chosen)} 个未订阅壁纸，共 {core.fmt_size(total)}：\n\n"
            f"{preview}{more}\n\n"
            f"删除方式：{mode}{extra}\n\n确定继续吗？",
        ):
            return
        self.busy = True
        for b in (self.btn_scan, self.btn_del, self.btn_unsub, self.btn_all, self.btn_none):
            b.configure(state="disabled")
        self._set_state("正在删除…")
        threading.Thread(
            target=self._delete_worker, args=(chosen, permanent), daemon=True
        ).start()

    def _delete_worker(self, chosen: list[core.Item], permanent: bool) -> None:
        def progress(done: int, total: int, item: core.Item) -> None:
            self.q.put(("del_progress", done, total, item))

        freed, failures = core.delete_items(chosen, permanent=permanent, progress=progress)
        self.q.put(("del_done", freed, failures, permanent))

    # ---------- 退订 ----------

    def on_unsubscribe(self) -> None:
        chosen = [i for i in self.items if i.wid in self.checked and i.subscribed]
        skipped = sum(1 for i in self.items if i.wid in self.checked and not i.subscribed)
        if not chosen or self.busy:
            if skipped:
                messagebox.showinfo("提示", "勾选中只有未订阅的壁纸，无需退订；如要清理文件请用「删除选中」。")
            return
        total = sum(i.size for i in chosen)
        preview = "\n".join(f"  · {i.title[:24]}" for i in chosen[:5])
        more = f"\n  ……等共 {len(chosen)} 个" if len(chosen) > 5 else ""
        if not messagebox.askyesno(
            "确认退订",
            f"将对 {len(chosen)} 个订阅中壁纸（共 {core.fmt_size(total)}）执行退订：\n\n"
            f"{preview}{more}\n\n"
            "· Steam 会自动删除其本地文件，并取消相关下载\n"
            "· 以后想要需要重新订阅并重新下载\n\n确定继续吗？",
        ):
            return
        self.busy = True
        self._unsub_targets = chosen
        for b in (self.btn_scan, self.btn_del, self.btn_unsub, self.btn_all, self.btn_none):
            b.configure(state="disabled")
        self._set_state("正在退订…")
        threading.Thread(target=self._unsub_worker, args=(chosen,), daemon=True).start()

    def _unsub_worker(self, chosen: list[core.Item]) -> None:
        ok = fail = 0
        fails: list[str] = []
        if not steamapi.connect():
            self.q.put(("unsub_done", 0, len(chosen), [i.wid for i in chosen], "无法连接 Steam，请确认 Steam 正在运行"))
            return
        try:
            for i, item in enumerate(chosen, 1):
                self.q.put(("unsub_progress", i, len(chosen), item.wid))
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
        self.q.put(("unsub_done", ok, fail, fails, ""))

    def _finish_delete(self, freed: int, failures: list, permanent: bool) -> None:
        self.busy = False
        for b in (self.btn_scan, self.btn_all, self.btn_none):
            b.configure(state="normal")
        done_ids = {i.wid for i in self.items} - {w for w, _ in failures}
        deleted = [i for i in self.items if i.wid in done_ids]
        core.record_history(deleted, "delete")  # 软件的记忆：以后可一键恢复订阅
        self.items = [i for i in self.items if i.wid not in done_ids]
        self._seen = {i.wid: i for i in self.items}
        for wid in done_ids:
            self.checked.discard(wid)
        self.btn_del.configure(state="normal" if any(not i.subscribed for i in self.items) else "disabled")
        self.btn_unsub.configure(state="normal" if any(i.subscribed for i in self.items) else "disabled")
        if self.items:
            self._set_state(f"已移除 {core.fmt_size(freed)}，剩 {len(self.items)} 个未订阅壁纸", warn=True)
        else:
            self._set_state("清理完成 ✔")
        self._relayout()  # 就地刷新当前页，不重新扫描
        mode = "彻底删除" if permanent else "移入回收站"
        extra = ""
        if not permanent:
            extra = "\n（文件在回收站里，清空回收站后空间才真正释放）"
        if failures:
            extra += f"\n失败 {len(failures)} 个：" + "、".join(w for w, _ in failures[:8])
        messagebox.showinfo("完成", f"已{mode} {core.fmt_size(freed)}。" + extra)

    def _finish_unsubscribe(self, ok: int, fail: int, fails: list, err: str) -> None:
        self.busy = False
        self.btn_scan.configure(state="normal")
        if err:
            for b in (self.btn_unsub, self.btn_all, self.btn_none):
                b.configure(state="normal")
            self._set_state("退订失败：" + err, warn=True)
            messagebox.showerror("退订失败", err)
            return
        # 就地更新卡片状态，不重扫（Steam 删除文件是异步的，重扫只会闪烁）
        now = int(time.time())
        targets = getattr(self, "_unsub_targets", [])
        core.record_history(targets, "unsubscribe")  # 软件的记忆：以后可一键恢复订阅
        for item in targets:
            item.subscribed = False
            item.time_updated = item.time_updated or now
        self._render_page()
        self.checked -= {i.wid for i in targets}
        self.btn_del.configure(state="normal" if any(not i.subscribed for i in self.items) else "disabled")
        self.btn_unsub.configure(state="normal" if any(i.subscribed for i in self.items) else "disabled")
        self._update_stats()
        self._set_state(f"已退订 {ok} 个：Steam 正在后台删除文件，稍后可重新扫描核实", warn=bool(fail))
        detail = ("\n失败：" + "、".join(map(str, fails[:8]))) if fail else ""
        messagebox.showinfo(
            "完成",
            f"已提交退订 {ok} 个。\nSteam 正在后台删除对应文件并取消相关下载；"
            "本地列表已就地更新，想核实最新状态可点「重新扫描」。" + detail,
        )

    # ---------- 历史记录与恢复订阅 ----------

    def _open_history(self) -> None:
        records = core.load_history()["items"]
        win = ctk.CTkToplevel(self.root)
        win.title("操作历史 · 可恢复订阅")
        win.geometry("700x560")
        win.transient(self.root)

        rows_frame = ctk.CTkScrollableFrame(win, fg_color=BG)
        rows_frame.pack(fill="both", expand=True, padx=10, pady=10)
        checked: set[str] = set()
        row_widgets: dict[str, dict] = {}

        if not records:
            ctk.CTkLabel(
                rows_frame, text="还没有历史记录\n退订或删除壁纸后会记在这里，随时可一键恢复订阅",
                text_color="#7b8291", font=("", 14),
            ).pack(pady=40)

        def toggle(wid: str) -> None:
            if wid in checked:
                checked.discard(wid)
            else:
                checked.add(wid)
            row_widgets[wid]["sel"].configure(text="☑" if wid in checked else "☐")

        for wid, info in sorted(records.items(), key=lambda kv: -kv[1].get("ts", 0)):
            row = ctk.CTkFrame(rows_frame, fg_color=CARD, corner_radius=8)
            row.pack(fill="x", pady=3, padx=4)
            sel = ctk.CTkLabel(row, text="☐", width=28, text_color="#9aa3af")
            sel.pack(side="left", padx=(8, 0))
            date = time.strftime("%y-%m-%d %H:%M", time.localtime(info.get("ts", 0)))
            act = "退订" if info.get("action") == "unsubscribe" else "删除"
            lbl = ctk.CTkLabel(
                row, justify="left", text_color="#e5e7eb",
                text=f"{str(info.get('title', ''))[:34]}  ·  {act}  ·  {date}\n"
                     f"ID {wid} · {core.fmt_size(info.get('size', 0))}",
            )
            lbl.pack(side="left", padx=8, pady=6)
            for w in (row, lbl, sel):
                w.bind("<Button-1>", lambda e, w2=wid: toggle(w2))
            row_widgets[wid] = {"sel": sel}

        def do_all(on: bool) -> None:
            for wid in records:
                if on:
                    checked.add(wid)
                else:
                    checked.discard(wid)
            for wid, w in row_widgets.items():
                w["sel"].configure(text="☑" if wid in checked else "☐")

        bottom = ctk.CTkFrame(win, fg_color="transparent")
        bottom.pack(fill="x", padx=10, pady=(0, 10))
        ctk.CTkLabel(bottom, text="恢复订阅 = 重新订阅，Steam 会自动重新下载", text_color="#9aa3af").pack(side="left")

        def do_resub() -> None:
            targets = [w for w in checked if w in records]
            if not targets:
                return
            if not messagebox.askyesno(
                "确认恢复", f"将重新订阅 {len(targets)} 个壁纸，Steam 会自动重新下载（注意磁盘空间）。继续？"
            ):
                return

            def worker() -> None:
                ok = fail = 0
                if not steamapi.connect():
                    self.root.after(0, lambda: messagebox.showerror("失败", "无法连接 Steam，请确认 Steam 正在运行"))
                    return
                try:
                    for w in targets:
                        try:
                            if steamapi.subscribe(w):
                                ok += 1
                            else:
                                fail += 1
                        except Exception:  # noqa: BLE001
                            fail += 1
                    if ok:
                        core.drop_history(targets)
                finally:
                    steamapi.shutdown()

                def done() -> None:
                    messagebox.showinfo("完成", f"已重新订阅 {ok} 个" + (f"，失败 {fail} 个" if fail else "") + "。")
                    win.destroy()

                self.root.after(0, done)

            threading.Thread(worker, daemon=True).start()

        ctk.CTkButton(bottom, text="全选", width=64, fg_color="#333845", hover_color="#3f4553",
                      command=lambda: do_all(True)).pack(side="right", padx=6)
        ctk.CTkButton(bottom, text="重新订阅勾选", fg_color="#2f7d4f", hover_color="#256b41",
                      command=do_resub).pack(side="right", padx=(0, 6))

    # ---------- 队列轮询 ----------

    def _poll(self) -> None:
        try:
            while True:
                msg = self.q.get_nowait()
                try:
                    self._handle(msg)
                except Exception:  # noqa: BLE001 - 单条消息出错绝不堵死队列
                    import traceback

                    tb = traceback.format_exc().splitlines()
                    where = next((l.strip() for l in tb if "gui.py" in l), "")
                    what = tb[-1] if tb else "未知错误"
                    try:
                        self.lbl_warn.configure(
                            text=f"⚠ 内部错误（界面已恢复，可重新扫描）：{what} @ {where}",
                            text_color="#ef4444",
                        )
                    except Exception:  # noqa: BLE001
                        pass
        except queue.Empty:
            pass
        self.root.after(100, self._poll)

    def _handle(self, msg) -> None:
        kind = msg[0]
        if kind == "thumb":
            _, g, wid, pil = msg
            if g == self._thumb_gen and wid in self.thumb_labels:
                img = ctk.CTkImage(light_image=pil, size=thumbnails.THUMB_SIZE)
                self.thumb_labels[wid].configure(image=img)
        elif kind == "scan_prog":
            _, done, total, item = msg
            self._set_state(f"正在扫描 {done}/{total}（当前 {item.wid}）…")
        elif kind == "scan_done":
            self._finish_scan(msg[1])
        elif kind == "scan_error":
            self.busy = False
            for b in (self.btn_scan,):
                b.configure(state="normal")
            self._set_state("扫描失败：" + msg[1], warn=True)
        elif kind == "del_progress":
            _, done, total, item = msg
            self._set_state(f"正在删除 {done}/{total}：{item.wid}")
        elif kind == "del_done":
            self._finish_delete(msg[1], msg[2], msg[3])
        elif kind == "unsub_progress":
            _, done, total, wid = msg
            self._set_state(f"正在退订 {done}/{total}：{wid}")
        elif kind == "unsub_done":
            _, ok, fail, fails, err = msg
            self._finish_unsubscribe(ok, fail, fails, err)


def run(appid: str = core.WE_APPID) -> None:
    ctk.set_appearance_mode("dark")
    root = ctk.CTk()
    App(root, appid)
    root.mainloop()
