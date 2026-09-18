import ctypes
import os


def _early_dpi() -> None:
    """抢在 customtkinter 之前设置 per-monitor DPI 感知。

    PyInstaller 打包的 exe 在进程清单里已带 DPI 声明，导致 ctk 稍后的
    SetProcessDpiAwareness(2) 调用失败、缩放计算错乱（界面底部出现白块）。
    进程启动时先把模式定为 2，ctk 稍后的重复调用即无害。
    """
    if os.name == "nt":
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:  # noqa: BLE001 - 已设置或不支持时忽略
            try:
                ctypes.windll.user32.SetProcessDPIAware()
            except Exception:  # noqa: BLE001
                pass


_early_dpi()

from wecleaner.cli import main  # noqa: E402

if __name__ == "__main__":
    main()
