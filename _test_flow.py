# -*- coding: utf-8 -*-
"""临时脚本：模拟用户操作流，抓出所有界面回调异常。"""
import time

import customtkinter as ctk

from wecleaner import gui

errors: list[str] = []


def main() -> None:
    ctk.set_appearance_mode("dark")
    root = ctk.CTk()
    app = gui.App(root, "431960")

    def wait_idle_then(name: str, fn, delay_ms: int) -> None:
        def run():
            t0 = time.time()
            while app.busy and time.time() - t0 < 90:
                root.update()
                time.sleep(0.1)
            print(f"[TEST] 等待结束：{app.lbl_status.cget('text')[:40]}", flush=True)
            try:
                fn()
                print(f"[TEST] {name} 完成", flush=True)
            except Exception:
                import traceback
                errors.append(f"{name}:\n{traceback.format_exc()}")
                print(f"[TEST] {name} 异常！", flush=True)

        root.after(delay_ms, run)

    def check_warn(tag: str) -> None:
        w = app.lbl_warn.cget("text")
        if "内部错误" in w:
            errors.append(f"{tag}: {w}")

    def s_rescan():
        app.start_scan()

    def s_status_sub():
        app._change_status("订阅中")

    def s_status_all():
        app._change_status("全部")

    def s_sort_time():
        app._change_sort("按时间（新→旧）")

    def s_sort_size():
        app._change_sort("按大小")

    def s_page2():
        if app._total_pages() > 1:
            app._next_page()
        else:
            print("[TEST] 只有 1 页", flush=True)

    def s_select():
        app._check_all(True)

    def s_deselect():
        app._check_all(False)

    def s_resize():
        root.geometry("1500x900+40+40")

    def s_resize_back():
        root.geometry("1180x800+40+40")

    def report():
        check_warn("最终")
        print(f"[TEST] 最终: {app.lbl_status.cget('text')}", flush=True)
        print(f"[TEST] 当前页卡片: {len(app._card_rects)} / 总数: {len(app.items)}", flush=True)
        if errors:
            print(f"[TEST] ===== {len(errors)} 个异常 =====", flush=True)
            for e in errors:
                print(e, flush=True)
        else:
            print("[TEST] ===== 全流程无异常 =====", flush=True)
        root.destroy()

    seq = [
        (25000, "二次扫描", s_rescan),
        (45000, "分类-订阅中", s_status_sub),
        (47000, "分类-全部", s_status_all),
        (49000, "排序-时间", s_sort_time),
        (51000, "排序-大小", s_sort_size),
        (53000, "翻页", s_page2),
        (55000, "全选", s_select),
        (57000, "取消全选", s_deselect),
        (59000, "放大窗口", s_resize),
        (63000, "还原窗口", s_resize_back),
        (66000, "检查警告", lambda: check_warn("全程")),
    ]
    for delay, name, fn in seq:
        wait_idle_then(name, fn, delay)
    root.after(70000, report)
    root.mainloop()


if __name__ == "__main__":
    main()
