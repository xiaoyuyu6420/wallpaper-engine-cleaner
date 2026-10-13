"""WE Cleaner 图形入口：pywebview 窗口 + HTML 前端（替代 tkinter 版 gui.py）。

运行（开发态）：
    .venv/Scripts/python.exe app.py

前端约定见 ``webui/CONTRACT.md``；桥接层是 ``wecleaner/bridge.py``。

要点
----
- 窗口尺寸按 pywebview 的「逻辑像素」语义传入（它自己按显示器 DPI 缩放）。
- 事件通道：任务线程调用 ``Api._push`` → ``window.evaluate_js("window.__dispatch({...})")``，
  所以前端必须自己定义 ``window.__dispatch``（没有定义时推送会静默失败，不影响任务）。
- 页面用 ``file://`` 直接加载，不需要起 HTTP 服务。
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import webview

from wecleaner import bridge

TITLE = "WE Cleaner · Wallpaper Engine 档案库"
WIDTH = 1280
HEIGHT = 820
MIN_SIZE = (960, 640)  # pywebview 的 min_size 参数 = (宽, 高)
BACKGROUND = "#1b1d23"  # 与前端深色底一致，避免加载瞬间白闪


def resource_path(*parts: str) -> Path:
    """开发态取仓库目录；PyInstaller onefile 取解包目录（sys._MEIPASS）。"""
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base.joinpath(*parts)


def _start_kwargs() -> dict:
    """webview.start 的可选参数：让前端能用 localStorage 记住界面偏好。"""
    kwargs: dict = {"debug": bool(os.environ.get("WECLEANER_DEBUG"))}
    try:
        storage = Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "WECleaner" / "webview"
        storage.mkdir(parents=True, exist_ok=True)
        kwargs["private_mode"] = False
        kwargs["storage_path"] = str(storage)
    except OSError:
        pass  # 建目录失败就退回默认（隐私模式，仅本次会话有效）
    return kwargs


def create_api_and_window() -> tuple[bridge.Api, "webview.Window"]:
    """建窗口 + 挂 js_api，返回 (api, window)（拆出来方便测试复用）。"""
    index = resource_path("webui", "app", "index.html")
    if not index.is_file():
        raise SystemExit(f"找不到前端入口：{index}")
    api = bridge.Api()
    window = webview.create_window(
        TITLE,
        url=index.as_uri(),
        js_api=api,
        width=WIDTH,
        height=HEIGHT,
        min_size=MIN_SIZE,
        background_color=BACKGROUND,
        text_select=False,
    )
    # 事件通道：任务线程靠它推 JSON（属性名必须保持私有，见 bridge.Api.__init__ 的注释）
    api._window = window
    return api, window


def main() -> None:
    create_api_and_window()
    webview.start(**_start_kwargs())


if __name__ == "__main__":
    main()
