"""图形界面（PIL 整页合成 + Canvas 命中检测）。

渲染原理：每页壁纸合成成一张图片贴在 Canvas 上，界面控件数量恒定为 1，
彻底摆脱 CustomTkinter 控件树的渲染瓶颈；点击通过坐标命中卡片区域。
"""

from __future__ import annotations

import math
import os
import queue
import threading
import time
import webbrowser
import tkinter as tk
from tkinter import messagebox

import customtkinter as ctk
from PIL import Image, ImageDraw, ImageFont, ImageTk

from . import core, steamapi, thumbnails

BG = "#1b1d23"
CARD = "#242730"
CARD_LINE = "#333845"
ACCENT = "#4f8cff"
WARN = "#f59e0b"
DANGER = "#dc2626"
TEXT = "#e5e7eb"
SUB = "#9aa3af"
PAD = 14
GAP = 14
MIN_CARD_W = 250
PAGE_ROWS = 3

_font_cache: dict[tuple[int, bool], ImageFont.FreeTypeFont] = {}


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    key = (size, bold)
    if key not in _font_cache:
        name = "msyhbd.ttc" if bold else "msyh.ttc"
        try:
            _font_cache[key] = ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)
        except OSError:
            _font_cache[key] = ImageFont.load_default()
    return _font_cache[key]


def _truncate(draw: ImageDraw.ImageDraw, text: str, fnt, max_w: int) -> str:
    if draw.textlength(text, font=fnt) <= max_w:
        return text
    while text and draw.textlength(text + "…", font=fnt) > max_w:
        text = text[:-1]
    return text + "…"


class App:
    def __init__(self, root: ctk.CTk, appid: str) -> None:
        self.root = root
        self.appid = appid
        self.q: queue.Queue = queue.Queue()
        self.items: list[core.Item] = []
        self._seen: dict[str, core.Item] = {}
        self.checked: set[str] = set()
        self._visible: list[core.Item] = []
        self.page = 0
        self._cols = 4
        self._card_rects: list[tuple] = []
        self._thumb_cache: dict[str, Image.Image] = {}
        self._thumb_gen = 0
        self._sort_mode = "大小"
        self._status_filter = "全部"
        self._filter_text = ""
        self.busy = False
        self.res: core.ScanResult | None = None
        self._unsub_targets: list[core.Item] = []
        self._unsub_clean = False
        self._compose_job = None
        self._manual_unlock = False  # 用户手动确认"已全部退订"后解锁清理
        self._build()
        self.root.bind("<Configure>", self._on_resize)
        self.root.after(120, self._poll)
        self.start_scan()

    # ---------- 界面 ----------

    def _build(self) -> None:
        self.root.title("WE Cleaner · Wallpaper Engine 壁纸管理器")
        self.root.geometry("1180x800")
        self.root.minsize(760, 560)
        self.root.configure(fg_color=BG)

        header = ctk.CTkFrame(self.root, fg_color="transparent")
        header.pack(fill="x", padx=PAD, pady=(10, 4))
        self.btn_scan = ctk.CTkButton(header, text="↻ 重新扫描", width=104, command=self.start_scan)
        self.btn_scan.pack(side="left")
        self.sort_menu = ctk.CTkOptionMenu(
            header, width=148, values=["按大小", "按时间（新→旧）", "按时间（旧→新）"],
            command=self._change_sort,
        )
        self.sort_menu.pack(side="left", padx=8)
        self.seg_status = ctk.CTkSegmentedButton(
            header, values=["全部", "订阅中", "未订阅"], command=self._change_status,
        )
        self.seg_status.set("全部")
        self.seg_status.pack(side="left", padx=4)
        ctk.CTkButton(
            header, text="🕘 历史", width=80, fg_color="#333845", hover_color="#3f4553",
            command=self._open_history,
        ).pack(side="left", padx=4)

        right = ctk.CTkFrame(header, fg_color="transparent")
        right.pack(side="right")
        self.btn_del = ctk.CTkButton(
            right, text="删除选中", width=88, fg_color=DANGER, hover_color="#b91c1c",
            state="disabled", command=self.on_delete,
        )
        self.btn_del.pack(side="left", padx=(8, 0))
        self.btn_unsub = ctk.CTkButton(
            right, text="退订选中", width=88, fg_color="#d97706", hover_color="#b45309",
            state="disabled", command=self.on_unsubscribe,
        )
        self.btn_unsub.pack(side="left", padx=(8, 0))
        self.btn_both = ctk.CTkButton(
            right, text="⚡ 退订并清理", width=112, fg_color="#c2410c", hover_color="#9a3412",
            state="disabled", command=self.on_unsub_and_clean,
        )
        self.btn_both.pack(side="left", padx=(8, 0))
        self.btn_all = ctk.CTkButton(
            right, text="全选", width=56, fg_color="#333845", hover_color="#3f4553",
            command=lambda: self._check_all(True),
        )
        self.btn_all.pack(side="left", padx=6)
        self.btn_none = ctk.CTkButton(
            right, text="全不选", width=56, fg_color="#333845", hover_color="#3f4553",
            command=lambda: self._check_all(False),
        )
        self.btn_none.pack(side="left")
        self.var_permanent = ctk.BooleanVar(value=False)
        ctk.CTkCheckBox(right, text="彻底删除", variable=self.var_permanent).pack(side="left", padx=(0, 10))

        self.lbl_sel = ctk.CTkLabel(
            self.root, text="", anchor="w", text_color=ACCENT, font=("", 14, "bold"),
        )
        self.lbl_sel.pack(fill="x", padx=PAD, pady=(2, 0))

        self.canvas = tk.Canvas(self.root, bg=BG, highlightthickness=0)
        self.canvas.pack(fill="both", expand=True, padx=PAD, pady=(4, 2))
        self.canvas.bind("<Button-1>", self._on_click)
        self.canvas.bind("<Double-Button-1>", self._on_double)
        self.canvas.bind("<Motion>", self._on_motion)
        self.canvas.bind("<Leave>", lambda _e: self.canvas.delete("hover"))

        search = ctk.CTkFrame(self.root, fg_color="transparent")
        search.pack(fill="x", padx=PAD, pady=(2, 0))
        self.btn_next = ctk.CTkButton(search, text="▶", width=36, fg_color="#333845",
                                      hover_color="#3f4553", state="disabled", command=self._next_page)
        self.btn_next.pack(side="right")
        self.lbl_page = ctk.CTkLabel(search, text="1 / 1", text_color="#cbd5e1")
        self.lbl_page.pack(side="right", padx=4)
        self.btn_prev = ctk.CTkButton(search, text="◀", width=36, fg_color="#333845",
                                      hover_color="#3f4553", state="disabled", command=self._prev_page)
        self.btn_prev.pack(side="right", padx=(2, 8))
        ctk.CTkLabel(search, text="🔍 过滤", text_color=SUB).pack(side="left")
        self.search_var = ctk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._on_search(self.search_var.get()))
        ctk.CTkEntry(search, placeholder_text="输入标题或 ID 过滤（实时）", textvariable=self.search_var).pack(
            side="left", fill="x", expand=True, padx=8
        )

        self.lbl_status = ctk.CTkLabel(self.root, text="", anchor="w", text_color=SUB)
        self.lbl_status.pack(fill="x", padx=PAD, pady=(2, 0))
        self.lbl_stats = ctk.CTkLabel(self.root, text="", anchor="w", text_color="#cbd5e1")
        self.lbl_stats.pack(fill="x", padx=PAD)
        self.lbl_warn = ctk.CTkLabel(self.root, text="", anchor="w", text_color=WARN,
                                     wraplength=1100, justify="left")
        self.lbl_warn.pack(fill="x", padx=PAD, pady=(0, 8))

    # ---------- 数据视图 ----------

    def _sorted_items(self) -> list[core.Item]:
        if self._sort_mode == "时间（新→旧）":
            return sorted(self.items, key=lambda i: (i.time_updated, max(i.size, 0)), reverse=True)
        if self._sort_mode == "时间（旧→新）":
            return sorted(self.items, key=lambda i: (i.time_updated, max(i.size, 0)))
        return sorted(self.items, key=lambda i: max(i.size, 0), reverse=True)

    def _refresh_visible(self) -> None:
        ft = self._filter_text.lower()
        out = []
        for i in self._sorted_items():
            if self._status_filter == "订阅中" and not i.subscribed:
                continue
            if self._status_filter == "未订阅" and i.subscribed:
                continue
            if ft and ft not in i.title.lower() and ft not in i.wid:
                continue
            out.append(i)
        self._visible = out

    def _total_pages(self) -> int:
        per = self._cols * PAGE_ROWS
        return max(1, math.ceil(len(self._visible) / per)) if per else 1

    def _relayout(self) -> None:
        if self._compose_job:
            self.root.after_cancel(self._compose_job)
            self._compose_job = None
        self._refresh_visible()
        if self.page >= self._total_pages():
            self.page = self._total_pages() - 1
        self._render_page()

    def _change_sort(self, mode: str) -> None:
        self._sort_mode = mode[1:] if mode.startswith("按") else mode
        self._relayout()

    def _change_status(self, mode: str) -> None:
        self._status_filter = mode
        self.page = 0
        self._relayout()

    def _on_search(self, text: str) -> None:
        self._filter_text = text.strip()
        self.page = 0
        self._relayout()

    def _on_resize(self, event) -> None:
        if event.widget is not self.root:
            return
        if self._compose_job:
            self.root.after_cancel(self._compose_job)
        self._compose_job = self.root.after(200, self._relayout)

    def _prev_page(self) -> None:
        if self.page > 0 and not self.busy:
            self.page -= 1
            self._render_page()

    def _next_page(self) -> None:
        if self.page < self._total_pages() - 1 and not self.busy:
            self.page += 1
            self._render_page()

    def _check_all(self, on: bool) -> None:
        for item in self._visible:
            if on:
                self.checked.add(item.wid)
            else:
                self.checked.discard(item.wid)
        self._render_page()

    # ---------- 渲染（PIL 整页合成）----------

    def _layout_grid(self) -> tuple[int, int, float, float]:
        cw = max(self.canvas.winfo_width(), 620)
        ch = max(self.canvas.winfo_height(), 420)
        cols = max(2, min(6, int((cw - PAD * 2) // 300) or 2))
        card_w = (cw - PAD * 2 - GAP * (cols - 1)) / cols
        card_h = card_w * 0.80
        rows = max(2, min(5, int((ch - PAD * 2) // (card_h + GAP)) or 2))
        return cols, rows, card_w, card_h

    def _render_page(self) -> None:
        cw = max(self.canvas.winfo_width(), 600)
        ch = max(self.canvas.winfo_height(), 400)
        cols, _rows, card_w, card_h = self._layout_grid()
        self._cols = cols
        per = cols * PAGE_ROWS
        self._card_rects.clear()
        chunk = self._visible[self.page * per:(self.page + 1) * per]

        img = Image.new("RGB", (int(cw), int(ch)), BG)
        d = ImageDraw.Draw(img)
        total = self._total_pages()
        self.lbl_page.configure(text=f"{self.page + 1} / {total}")
        has = total > 1
        self.btn_prev.configure(state="normal" if has and self.page > 0 else "disabled")
        self.btn_next.configure(state="normal" if has and self.page < total - 1 else "disabled")

        if not chunk:
            msg = "没有符合条件的壁纸" if self._visible or self.items else "很干净，没有发现壁纸 ✔"
            d.text((cw / 2, ch / 2), msg, font=_font(18), fill="#8fae8f", anchor="mm")

        f_title = _font(16)
        f_meta = _font(13)
        for idx, item in enumerate(chunk):
            col, row = idx % cols, idx // cols
            x0 = PAD + col * (card_w + GAP)
            y0 = PAD + row * (card_h + GAP)
            x1, y1 = x0 + card_w, y0 + card_h
            checked = item.wid in self.checked
            d.rounded_rectangle(
                [x0, y0, x1, y1], radius=10, fill=CARD,
                outline=ACCENT if checked else CARD_LINE, width=3 if checked else 1,
            )

            tw, th = card_w - 16, (card_w - 16) * 0.5625
            tx, ty = x0 + 8, y0 + 8
            thumb = self._thumb_cache.get(item.wid) or self._placeholder_img(tw, th)
            if abs(thumb.width - tw) > 2 or abs(thumb.height - th) > 2:
                thumb = thumb.resize((int(tw), int(th)), Image.LANCZOS)
            img.paste(thumb, (int(tx), int(ty)))
            d.rectangle([tx, ty, tx + tw, ty + th], outline=CARD_LINE, width=1)

            ty2 = ty + th + 10
            title = _truncate(d, item.title or item.wid, f_title, card_w - 24)
            d.text((x0 + 12, ty2), title, font=f_title, fill=TEXT)
            size_txt = "⏳ 变化中" if item.size < 0 else core.fmt_size(item.size)
            date = time.strftime("%y-%m-%d", time.localtime(item.time_updated)) if item.time_updated else "下载中"
            d.text((x0 + 12, ty2 + 26), f"{size_txt} · {date}", font=f_meta, fill=SUB)

            d.text((x0 + 12, y1 - 30), "订阅中" if item.subscribed else "未订阅",
                   font=f_meta, fill="#4f8cff" if item.subscribed else "#7b8291")
            d.text((x0 + 66, y1 - 30), "✓ 已选" if checked else "未选",
                   font=f_meta, fill=ACCENT if checked else "#5b6270")
            pb = (x1 - 84, y1 - 36, x1 - 10, y1 - 10)
            d.rounded_rectangle(list(pb), radius=7, fill="#333845")
            d.text((pb[0] + 12, pb[1] + 5), "▶ 预览", font=_font(13), fill="#c9d1d9")

            self._card_rects.append((x0, y0, x1, y1, item, pb))

        self._page_img = img
        self._photo = ImageTk.PhotoImage(img)
        self.canvas.delete("all")
        self.canvas.create_image(0, 0, anchor="nw", image=self._photo)
        self._update_stats()

        self._thumb_gen += 1
        need = [i for i in chunk if i.wid not in self._thumb_cache]
        if need:
            threading.Thread(target=self._thumb_worker, args=(self._thumb_gen, need), daemon=True).start()

    def _placeholder_img(self, w: float, h: float) -> Image.Image:
        img = Image.new("RGB", (max(2, int(w)), max(2, int(h))), (40, 42, 48))
        d = ImageDraw.Draw(img)
        d.rectangle([10, 10, img.width - 10, img.height - 10], outline=(70, 75, 85), width=1)
        return img

    def _thumb_worker(self, gen: int, items: list[core.Item]) -> None:
        for item in items:
            if gen != self._thumb_gen:
                return
            try:
                img = thumbnails.extract(item.path)
            except Exception:  # noqa: BLE001
                img = None
            self.q.put(("thumb_ok", gen, item.wid, img))

    # ---------- 交互（坐标命中）----------

    def _hit(self, x: int, y: int):
        for x0, y0, x1, y1, item, pb in self._card_rects:
            if x0 <= x <= x1 and y0 <= y <= y1:
                px0, py0, px1, py1 = pb
                return item, (px0 <= x <= px1 and py0 <= y <= py1)
        return None, False

    def _on_click(self, event) -> None:
        if self.busy:
            return
        item, is_preview = self._hit(event.x, event.y)
        if item is None:
            return
        if is_preview:
            self._preview_local(item)
            return
        if item.wid in self.checked:
            self.checked.discard(item.wid)
        else:
            self.checked.add(item.wid)
        self._render_page()

    def _on_double(self, event) -> None:
        item, is_preview = self._hit(event.x, event.y)
        if item is not None and not is_preview:
            webbrowser.open(item.url)

    def _on_motion(self, event) -> None:
        item, _ = self._hit(event.x, event.y)
        self.canvas.delete("hover")
        if item is not None:
            for x0, y0, x1, y1, it, _pb in self._card_rects:
                if it.wid == item.wid:
                    self.canvas.create_rectangle(
                        x0 - 2, y0 - 2, x1 + 2, y1 + 2, outline="#6ea8ff", width=2, tags="hover"
                    )
                    break

    # ---------- 快速预览 ----------

    def _preview_local(self, item: core.Item) -> None:
        media = thumbnails.pick_media_file(item.path)
        if media:
            os.startfile(media)  # noqa: S606 - 视频交给默认播放器
        else:
            messagebox.showinfo("无法预览", "该文件夹里没有可播放或查看的文件。")

    # ---------- 扫描 ----------

    def start_scan(self) -> None:
        if self.busy:
            return
        self.busy = True
        self.gen = getattr(self, "gen", 0) + 1
        self.items = []
        self.res = None
        for b in (self.btn_scan, self.btn_del, self.btn_unsub, self.btn_both, self.btn_all, self.btn_none):
            b.configure(state="disabled")
        self.canvas.delete("all")
        self.lbl_warn.configure(text="")
        self.lbl_status.configure(text="正在扫描…")
        threading.Thread(target=self._scan_worker, daemon=True).start()

    def _scan_worker(self) -> None:
        try:
            override = None
            try:
                if steamapi.connect():
                    override = steamapi.get_subscribed()
                    self._connect_error = ""
                else:
                    self._connect_error = steamapi.last_error
            except Exception as e:  # noqa: BLE001
                override = None
                self._connect_error = str(e)
            res = core.scan(
                self.appid,
                on_progress=lambda done, total, item: self.q.put(("scan_prog", done, total, item)),
                subscribed_override=override,
            )
        except Exception as e:  # noqa: BLE001
            self.q.put(("scan_error", str(e)))
            return
        self.q.put(("scan_done", res))

    def _finish_scan(self, res: core.ScanResult) -> None:
        self.res = res
        self.items = res.items
        self._seen = {i.wid: i for i in res.items}
        self._thumb_cache.clear()
        self.busy = False
        self.btn_scan.configure(state="normal")
        blocked = res.deletion_blocked and not self._manual_unlock
        if blocked:
            for b in (self.btn_del, self.btn_unsub, self.btn_both, self.btn_all, self.btn_none):
                b.configure(state="disabled")
        else:
            self.btn_all.configure(state="normal")
            self.btn_none.configure(state="normal")
            self.btn_del.configure(state="normal" if any(not i.subscribed for i in res.items) else "disabled")
            has_sub = any(i.subscribed for i in res.items)
            self.btn_unsub.configure(state="normal" if has_sub else "disabled")
            self.btn_both.configure(state="normal" if has_sub else "disabled")

        self.page = 0
        self._relayout()

        n_sub = sum(1 for i in res.items if i.subscribed)
        if not res.libraries:
            self.lbl_status.configure(text="没有找到 Steam")
        elif not res.items:
            self.lbl_status.configure(text="很干净，没有发现壁纸 ✔")
        else:
            self.lbl_status.configure(
                text=f"共 {len(res.items)} 个壁纸（订阅中 {n_sub}，未订阅 {len(res.items) - n_sub}）"
            )

        warnings = list(res.warnings)
        if res.deletion_blocked and not self._manual_unlock:
            err = getattr(self, "_connect_error", "")
            if err:
                warnings.append(f"无法连接 Steam：{err}")
        running = core.running_processes(core.STEAM_PROCS + core.WE_PROCS)
        if running & set(core.WE_PROCS):
            warnings.append("Wallpaper Engine 正在运行：清理文件前建议先退出 WE，文件可能被占用。")
        self.lbl_warn.configure(
            text="\n".join("⚠ " + w for w in warnings),
            text_color="#ef4444" if blocked else WARN,
        )
        self._update_unlock_ui(blocked, warnings)

    def _update_unlock_ui(self, blocked: bool, warnings: list[str]) -> None:
        """blocked 且未手动解锁时，显示「解锁清理」逃生门。"""
        need = blocked and not self._manual_unlock
        if not hasattr(self, "btn_unlock"):
            self.btn_unlock = ctk.CTkButton(
                self.root, text="🔓 我确认 Steam 里已全部退订，解锁清理",
                fg_color="#7c2d12", hover_color="#9a3412", command=self._unlock,
            )
        if need:
            self.btn_unlock.pack(fill="x", padx=PAD, pady=(0, 8))
        else:
            self.btn_unlock.pack_forget()

    def _unlock(self) -> None:
        if not messagebox.askyesno(
            "确认解锁清理",
            "Steam 接口不可用，无法自动确认订阅状态。\n\n"
            "请确认：你已经（在 Steam / Wallpaper Engine 里）退订了全部壁纸，\n"
            "当前列表中的内容全部不再需要。\n\n"
            "确认无误将解锁「删除选中」功能（默认进回收站，可反悔）。",
            icon="warning",
        ):
            return
        self._manual_unlock = True
        if self.res is not None:
            self._finish_scan(self.res)  # 以解锁状态重算界面

    # ---------- 勾选统计 ----------

    def _update_stats(self) -> None:
        seen = list(self._seen.values())
        n_sub = sum(1 for i in seen if i.subscribed)
        unknown = sum(1 for i in seen if i.size < 0)
        total_all = sum(max(i.size, 0) for i in seen)
        checked = [i for i in seen if i.wid in self.checked]
        checked_total = sum(max(i.size, 0) for i in checked)
        c_sub = sum(1 for i in checked if i.subscribed)
        unknown_txt = f"（{unknown} 个大小变化中）" if unknown else ""
        self.lbl_stats.configure(
            text=(
                f"共 {len(seen)} 个，{core.fmt_size(total_all)}{unknown_txt}　|　"
                f"订阅中 {n_sub} · 未订阅 {len(seen) - n_sub}　|　"
                f"已勾选 {len(checked)} 个（订阅中 {c_sub}）/ {core.fmt_size(checked_total)}"
            )
        )
        if checked:
            self.lbl_sel.configure(
                text=(f"☑ 已选 {len(checked)} 张 · {core.fmt_size(checked_total)}"
                      f"　（订阅中 {c_sub}，未订阅 {len(checked) - c_sub}）")
            )
        else:
            self.lbl_sel.configure(text="未选择任何壁纸——单击卡片勾选")

    # ---------- 操作：退订 / 删除 / 一步到位 ----------

    def _busy_on(self) -> None:
        self.busy = True
        for b in (self.btn_scan, self.btn_del, self.btn_unsub, self.btn_both, self.btn_all, self.btn_none):
            b.configure(state="disabled")

    def _busy_off(self) -> None:
        self.busy = False
        self.btn_scan.configure(state="normal")
        self.btn_del.configure(state="normal" if any(not i.subscribed for i in self.items) else "disabled")
        self.btn_unsub.configure(state="normal" if any(i.subscribed for i in self.items) else "disabled")
        self.btn_both.configure(state="normal" if any(i.subscribed for i in self.items) else "disabled")

    def _checked_items(self, subscribed: bool) -> list[core.Item]:
        return [i for i in self.items if i.wid in self.checked and i.subscribed == subscribed]

    def on_unsubscribe(self) -> None:
        self._run_unsub(clean_files=False)

    def on_unsub_and_clean(self) -> None:
        self._run_unsub(clean_files=True)

    def _run_unsub(self, clean_files: bool) -> None:
        chosen = self._checked_items(subscribed=True)
        if not chosen or self.busy:
            return
        total = sum(max(i.size, 0) for i in chosen)
        preview = "\n".join(f"  · {i.title[:26]}" for i in chosen[:5])
        more = f"\n  ……等共 {len(chosen)} 个" if len(chosen) > 5 else ""
        tail = "退订后立即清理本地文件" if clean_files else "Steam 将自动删除本地文件"
        if not messagebox.askyesno(
            "确认退订",
            f"将对 {len(chosen)} 个订阅中壁纸（共 {core.fmt_size(total)}）执行退订：\n\n"
            f"{preview}{more}\n\n· {tail}\n· 以后想要可在「🕘 历史」里一键恢复\n\n确定继续吗？",
        ):
            return
        self._busy_on()
        self._unsub_targets = chosen
        self._unsub_clean = clean_files
        self.lbl_status.configure(text="正在退订…")
        threading.Thread(target=self._unsub_worker, args=(chosen, clean_files), daemon=True).start()

    def _unsub_worker(self, chosen: list[core.Item], clean_files: bool) -> None:
        ok = fail = 0
        fails: list[str] = []
        if not steamapi.connect():
            self.q.put(("unsub_done", 0, len(chosen), [i.wid for i in chosen],
                        "无法连接 Steam，请确认 Steam 正在运行", False, 0, 0, []))
            return
        try:
            for i, item in enumerate(chosen, 1):
                self.q.put(("op_progress", f"正在退订 {i}/{len(chosen)}：{item.title[:20]}"))
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
        if clean_files and ok:
            from send2trash import send2trash

            for item in chosen:
                if item.wid in fails:
                    continue
                for attempt in range(2):
                    try:
                        if self.var_permanent.get():
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
        self.q.put(("unsub_done", ok, fail, fails, "", clean_files, cleaned, freed, clean_fails))

    def _finish_unsubscribe(self, ok: int, fail: int, fails: list, err: str,
                            clean_files: bool, cleaned: int, freed: int,
                            clean_fails: list[str]) -> None:
        self._busy_off()
        if err:
            self.lbl_status.configure(text="退订失败：" + err)
            messagebox.showerror("退订失败", err)
            return
        now = int(time.time())
        targets = self._unsub_targets
        core.record_history(targets, "unsubscribe")
        for item in targets:
            item.subscribed = False
            item.time_updated = item.time_updated or now
        done_ids = {i.wid for i in targets} - set(clean_fails)
        if clean_files:
            self.items = [i for i in self.items if i.wid not in done_ids]
            self._seen = {i.wid: i for i in self.items}
            for wid in done_ids:
                self.checked.discard(wid)
        self._render_page()
        self._update_stats()
        msg = f"已退订 {ok} 个"
        if clean_files:
            msg += f"，已清理 {cleaned} 个（释放 {core.fmt_size(freed)}）"
            if clean_fails:
                msg += f"；{len(clean_fails)} 个文件被占用暂时没删掉，稍后可用「删除选中」清理"
        else:
            msg += "，Steam 正在后台删除文件"
        self.lbl_status.configure(text=msg)
        detail = ("\n失败：" + "、".join(map(str, fails[:8]))) if fail else ""
        if clean_fails:
            detail += "\n清理失败：" + "、".join(clean_fails[:8])
        messagebox.showinfo("完成", msg + "。" + detail)

    def on_delete(self) -> None:
        chosen = self._checked_items(subscribed=False)
        skipped = len(self._checked_items(subscribed=True))
        if not chosen or self.busy:
            if skipped:
                messagebox.showinfo(
                    "提示",
                    f"勾选中有 {skipped} 个订阅中壁纸：删除只处理未订阅的；"
                    "订阅中的请用「退订选中」或「⚡ 退订并清理」。",
                )
            return
        total = sum(max(i.size, 0) for i in chosen)
        permanent = self.var_permanent.get()
        mode = "彻底删除（无法恢复！）" if permanent else "移入回收站（清空回收站前可还原）"
        preview = "\n".join(f"  · {i.title[:26]}" for i in chosen[:5])
        more = f"\n  ……等共 {len(chosen)} 个" if len(chosen) > 5 else ""
        extra = f"\n（另有 {skipped} 个订阅中项目已跳过）" if skipped else ""
        if not messagebox.askyesno(
            "确认删除",
            f"将删除 {len(chosen)} 个未订阅壁纸，共 {core.fmt_size(total)}：\n\n"
            f"{preview}{more}\n\n删除方式：{mode}{extra}\n\n确定继续吗？",
        ):
            return
        self._busy_on()
        self.lbl_status.configure(text="正在删除…")
        threading.Thread(target=self._delete_worker, args=(chosen, permanent), daemon=True).start()

    def _delete_worker(self, chosen: list[core.Item], permanent: bool) -> None:
        def progress(done: int, total: int, item: core.Item) -> None:
            self.q.put(("op_progress", f"正在删除 {done}/{total}：{item.title[:20]}"))

        freed, failures = core.delete_items(chosen, permanent=permanent, progress=progress)
        self.q.put(("del_done", freed, failures, permanent))

    def _finish_delete(self, freed: int, failures: list, permanent: bool) -> None:
        self._busy_off()
        done_ids = {i.wid for i in self.items} - {w for w, _ in failures}
        deleted = [i for i in self.items if i.wid in done_ids]
        core.record_history(deleted, "delete")
        self.items = [i for i in self.items if i.wid not in done_ids]
        self._seen = {i.wid: i for i in self.items}
        for wid in done_ids:
            self.checked.discard(wid)
        if self.items:
            self.lbl_status.configure(text=f"已移除 {core.fmt_size(freed)}，剩 {len(self.items)} 个未订阅壁纸")
        else:
            self.lbl_status.configure(text="清理完成 ✔")
        self._render_page()
        self._update_stats()
        mode = "彻底删除" if permanent else "移入回收站"
        extra = ""
        if not permanent:
            extra = "\n（文件在回收站里，清空回收站后空间才真正释放）"
        if failures:
            extra += f"\n失败 {len(failures)} 个：" + "、".join(w for w, _ in failures[:8])
        messagebox.showinfo("完成", f"已{mode} {core.fmt_size(freed)}。" + extra)

    # ---------- 历史与恢复订阅 ----------

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
            ctk.CTkLabel(rows_frame, text="还没有历史记录\n退订或删除壁纸后会记在这里，随时可一键恢复订阅",
                         text_color="#7b8291", font=("", 14)).pack(pady=40)

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
                text=(f"{str(info.get('title', ''))[:34]}  ·  {act}  ·  {date}\n"
                      f"ID {wid} · {core.fmt_size(info.get('size', 0))}"),
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
        ctk.CTkLabel(bottom, text="恢复订阅 = 重新订阅，Steam 会自动重新下载", text_color=SUB).pack(side="left")

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
                confirmed: list[str] = []
                if not steamapi.connect():
                    self.root.after(0, lambda: messagebox.showerror("失败", "无法连接 Steam，请确认 Steam 正在运行"))
                    return
                try:
                    before = steamapi.get_subscribed()
                    for w in targets:
                        try:
                            if steamapi.subscribe(w):
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

                def done() -> None:
                    msg = f"已重新订阅 {ok} 个" + (f"，失败 {fail} 个" if fail else "")
                    if confirmed:
                        msg += f"\n✔ 已确认 {len(confirmed)} 个进入订阅列表，Steam 正在后台下载。"
                    else:
                        msg += "\n⚠ 未能确认订阅状态，请稍后在 Steam 中检查（也可能是磁盘空间不足）。"
                    messagebox.showinfo("完成", msg)
                    win.destroy()

                self.root.after(0, done)

            threading.Thread(worker, daemon=True).start()

        ctk.CTkButton(bottom, text="全选", width=64, fg_color="#333845", hover_color="#3f4553",
                      command=lambda: do_all(True)).pack(side="right", padx=6)
        ctk.CTkButton(bottom, text="重新订阅勾选", fg_color="#2f7d4f", hover_color="#256b41",
                      command=do_resub).pack(side="right", padx=(0, 6))

    # ---------- 队列 ----------

    def _poll(self) -> None:
        try:
            while True:
                msg = self.q.get_nowait()
                try:
                    self._handle(msg)
                except Exception:  # noqa: BLE001 - 单条消息出错绝不堵死队列
                    import traceback

                    tb = traceback.format_exc().splitlines()
                    where = next((line.strip() for line in tb if "gui.py" in line), "")
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
        if kind == "thumb_ok":
            _, g, wid, img = msg
            if g == self._thumb_gen and img is not None:
                self._thumb_cache[wid] = img
                if not self._compose_job:
                    self._compose_job = self.root.after(250, self._render_page)
        elif kind == "scan_prog":
            _, done, total, item = msg
            self.lbl_status.configure(text=f"正在扫描 {done}/{total}（当前 {item.title[:18]}）…")
        elif kind == "op_progress":
            self.lbl_status.configure(text=msg[1])
        elif kind == "scan_done":
            self._finish_scan(msg[1])
        elif kind == "scan_error":
            self.busy = False
            self.btn_scan.configure(state="normal")
            self.lbl_status.configure(text="扫描失败：" + msg[1])
        elif kind == "del_done":
            self._finish_delete(msg[1], msg[2], msg[3])
        elif kind == "unsub_done":
            self._finish_unsubscribe(*msg[1:])


def run(appid: str = core.WE_APPID) -> None:
    ctk.set_appearance_mode("dark")
    root = ctk.CTk()
    App(root, appid)
    root.mainloop()
