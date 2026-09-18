"""通过任一已安装游戏自带的 steam_api64.dll 连接运行中的 Steam 客户端。

能力（均为 Steam 官方 ISteamUGC 接口，等价于客户端内的工坊操作）：
1. 读取权威订阅列表——本地 ACF 里查不到的东西
2. 订阅 / 退订指定创意工坊物品；退订后由 Steam 自己删除文件、取消相关下载

原理：Steamworks SDK 的 dll 是通用的。借任意已安装游戏的 steam_api64.dll，
配合 steam_appid.txt 以 Wallpaper Engine 的 AppID（431960）身份连接本机
Steam 客户端。前提：Steam 正在运行且已登录、本机装有至少一个 Steam 游戏。
"""

from __future__ import annotations

import ctypes
import os
from ctypes import c_bool, c_int, c_uint, c_uint64, c_void_p, POINTER
from pathlib import Path

from . import core

# 常见 SDK 版本的接口获取器，逐一探测（新版在前）
_UGC_VERSIONS = tuple(f"SteamAPI_SteamUGC_v{n:03d}" for n in range(30, 10, -1))

_REQUIRED_EXPORTS = (
    "SteamAPI_InitSafe",
    "SteamAPI_Shutdown",
    "SteamAPI_ISteamUGC_GetNumSubscribedItems",
    "SteamAPI_ISteamUGC_GetSubscribedItems",
    "SteamAPI_ISteamUGC_UnsubscribeItem",
    "SteamAPI_ISteamUGC_SubscribeItem",
)

_DLL = None
_UGC: int | None = None


def find_dlls(libraries: list[str] | None = None) -> list[str]:
    """在各 Steam 库的已安装游戏里找可用的 steam_api64.dll。"""
    libs = libraries if libraries is not None else core.find_steam_libraries()
    found: list[str] = []
    for lib in libs:
        common = Path(lib) / "steamapps" / "common"
        if not common.is_dir():
            continue
        for game in sorted(common.iterdir()):
            if not game.is_dir():
                continue
            for sub in (game, game / "bin", *game.glob("*/")):
                p = sub / "steam_api64.dll"
                if p.is_file() and str(p) not in found:
                    found.append(str(p))
    return found


def connect(libraries: list[str] | None = None) -> bool:
    """连接运行中的 Steam。成功后可调用本模块其他函数；重复调用无害。"""
    global _DLL, _UGC
    if _UGC:
        return True
    for dll_path in find_dlls(libraries):
        if _try_connect(dll_path):
            return True
    return False


def _try_connect(dll_path: str) -> bool:
    global _DLL, _UGC
    dll_dir = Path(dll_path).parent
    marker = dll_dir / "steam_appid.txt"
    try:  # SteamAPI 初始化时会读 CWD / dll 目录下的 steam_appid.txt
        if not marker.exists() or marker.read_text(encoding="ascii").strip() != core.WE_APPID:
            marker.write_text(core.WE_APPID + "\n", encoding="ascii")
    except OSError:
        return False

    prev = os.getcwd()
    try:
        os.chdir(dll_dir)  # 初始化阶段要能找到 steam_appid.txt
        dll = ctypes.CDLL(dll_path)
        for name in _REQUIRED_EXPORTS:
            if getattr(dll, name, None) is None:
                return False
        dll.SteamAPI_InitSafe.restype = c_bool
        dll.SteamAPI_InitSafe.argtypes = []
        if not dll.SteamAPI_InitSafe():
            return False
        accessor = None
        for name in _UGC_VERSIONS:
            accessor = getattr(dll, name, None)
            if accessor is not None:
                break
        if accessor is None:
            dll.SteamAPI_Shutdown()
            return False
        accessor.restype = c_void_p
        accessor.argtypes = []
        ugc = accessor()
        if not ugc:
            dll.SteamAPI_Shutdown()
            return False
        _DLL, _UGC = dll, ugc
        return True
    except OSError:
        return False
    finally:
        os.chdir(prev)


def get_subscribed() -> set[str]:
    """返回当前账号对 Wallpaper Engine 的全部订阅 ID。"""
    if not _UGC:
        raise RuntimeError("尚未连接 Steam（先调用 connect）")
    _DLL.SteamAPI_ISteamUGC_GetNumSubscribedItems.restype = c_uint
    _DLL.SteamAPI_ISteamUGC_GetNumSubscribedItems.argtypes = [c_void_p]
    n = _DLL.SteamAPI_ISteamUGC_GetNumSubscribedItems(_UGC)
    if not n:
        return set()
    arr = (c_uint64 * n)()
    _DLL.SteamAPI_ISteamUGC_GetSubscribedItems.restype = c_int
    _DLL.SteamAPI_ISteamUGC_GetSubscribedItems.argtypes = [c_void_p, POINTER(c_uint64), c_int]
    got = _DLL.SteamAPI_ISteamUGC_GetSubscribedItems(_UGC, arr, n)
    return {str(arr[i]) for i in range(got)}


def unsubscribe(wid: str) -> bool:
    """退订单个创意工坊物品。Steam 随后异步删除其文件并取消相关下载。"""
    if not _UGC:
        raise RuntimeError("尚未连接 Steam（先调用 connect）")
    _DLL.SteamAPI_ISteamUGC_UnsubscribeItem.restype = c_bool
    _DLL.SteamAPI_ISteamUGC_UnsubscribeItem.argtypes = [c_void_p, c_uint64]
    return bool(_DLL.SteamAPI_ISteamUGC_UnsubscribeItem(_UGC, c_uint64(int(wid))))


def subscribe(wid: str) -> bool:
    """订阅单个创意工坊物品（Steam 随后自动下载）。"""
    if not _UGC:
        raise RuntimeError("尚未连接 Steam（先调用 connect）")
    _DLL.SteamAPI_ISteamUGC_SubscribeItem.restype = c_bool
    _DLL.SteamAPI_ISteamUGC_SubscribeItem.argtypes = [c_void_p, c_uint64]
    return bool(_DLL.SteamAPI_ISteamUGC_SubscribeItem(_UGC, c_uint64(int(wid))))


def shutdown() -> None:
    global _DLL, _UGC
    if _DLL and _UGC:
        try:
            _DLL.SteamAPI_Shutdown()
        except Exception:  # noqa: BLE001 - 断开失败也无事可做
            pass
    _DLL, _UGC = None, None
