"""缩略图与预览素材提取。

优先级：文件夹内 preview.jpg / preview.png / preview.gif（取首帧）
→ 都没有时，调 Windows 外壳接口（IShellItemImageFactory）给视频截帧
→ 再失败则用占位图。
"""

from __future__ import annotations

import ctypes
import json
import os

from PIL import Image, ImageDraw

THUMB_SIZE = (192, 108)
_PREVIEW_NAMES = ("preview.jpg", "preview.png", "preview.jpeg")
_MEDIA_EXTS = (".mp4", ".webm", ".mkv", ".mov", ".jpg", ".jpeg", ".png", ".gif")


def placeholder() -> Image.Image:
    img = Image.new("RGB", THUMB_SIZE, (40, 42, 48))
    draw = ImageDraw.Draw(img)
    draw.rectangle([72, 40, 120, 68], outline=(90, 95, 105), width=2)
    draw.polygon([(92, 48), (92, 60), (104, 54)], fill=(90, 95, 105))
    return img


def _resize_cover(im: Image.Image) -> Image.Image:
    tw, th = THUMB_SIZE
    scale = max(tw / im.width, th / im.height)
    im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = (im.height - th) // 2
    return im.crop((left, top, left + tw, top + th))


def _load_image(path: str) -> Image.Image | None:
    try:
        with Image.open(path) as im:
            return _resize_cover(im.convert("RGB"))
    except Exception:  # noqa: BLE001 - 任何坏图都回退下一级
        return None


# ---------- Windows 外壳视频截帧（无第三方依赖） ----------

_COINIT_APARTMENTTHREADED = 0x2


class _GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", ctypes.c_ulong),
        ("Data2", ctypes.c_ushort),
        ("Data3", ctypes.c_ushort),
        ("Data4", ctypes.c_ubyte * 8),
    ]


_IID_FACTORY = _GUID(
    0xBCC18B79, 0xBA16, 0x442F, (ctypes.c_ubyte * 8)(0x80, 0xC4, 0x8A, 0x59, 0xC3, 0x0C, 0x46, 0x3B)
)


class _BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", ctypes.c_uint32),
        ("biWidth", ctypes.c_int32),
        ("biHeight", ctypes.c_int32),
        ("biPlanes", ctypes.c_uint16),
        ("biBitCount", ctypes.c_uint16),
        ("biCompression", ctypes.c_uint32),
        ("biSizeImage", ctypes.c_uint32),
        ("biXPelsPerMeter", ctypes.c_int32),
        ("biYPelsPerMeter", ctypes.c_int32),
        ("biClrUsed", ctypes.c_uint32),
        ("biClrImportant", ctypes.c_uint32),
    ]


class _RGBQUAD(ctypes.Structure):
    _fields_ = [("rgbBlue", ctypes.c_uint8), ("rgbGreen", ctypes.c_uint8), ("rgbRed", ctypes.c_uint8), ("rgbReserved", ctypes.c_uint8)]


class _BITMAPINFO(ctypes.Structure):
    _fields_ = [("bmiHeader", _BITMAPINFOHEADER), ("bmiColors", _RGBQUAD * 1)]


def shell_thumbnail(path: str) -> Image.Image | None:
    """用资源管理器同款接口给视频文件截一帧。"""
    try:
        windll = ctypes.windll
        # COM 需要线程初始化；重复初始化返回的错误码忽略即可
        windll.ole32.CoInitialize(None)
        factory = ctypes.c_void_p()
        hr = windll.shell32.SHCreateItemFromParsingName(
            str(path), None, ctypes.byref(_IID_FACTORY), ctypes.byref(factory)
        )
        if hr != 0 or not factory:
            return None

        vtbl = ctypes.cast(
            ctypes.cast(factory, ctypes.POINTER(ctypes.c_void_p)).contents,
            ctypes.POINTER(ctypes.c_void_p),
        )
        get_image = ctypes.WINFUNCTYPE(
            ctypes.c_long, ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint, ctypes.c_uint,
            ctypes.POINTER(ctypes.c_void_p),
        )(vtbl[3])
        release = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(vtbl[2])

        hbm = ctypes.c_void_p()
        try:
            # SIIGBF_THUMBNAILONLY = 4：拿不到缩略图宁可失败，不要文件图标
            hr = get_image(factory, 256, 256, 4, ctypes.byref(hbm))
            if hr != 0 or not hbm:
                return None

            class _BITMAP(ctypes.Structure):
                _fields_ = [
                    ("bmType", ctypes.c_long),
                    ("bmWidth", ctypes.c_long),
                    ("bmHeight", ctypes.c_long),
                    ("bmWidthBytes", ctypes.c_long),
                    ("bmPlanes", ctypes.c_uint16),
                    ("bmBitsPixel", ctypes.c_uint16),
                    ("bmBits", ctypes.c_void_p),
                ]

            bmp = _BITMAP()
            if windll.gdi32.GetObjectW(hbm, ctypes.sizeof(bmp), ctypes.byref(bmp)) == 0:
                return None
            w, h = bmp.bmWidth, bmp.bmHeight
            if w <= 0 or h <= 0:
                return None

            hdc = windll.user32.GetDC(None)
            bmi = _BITMAPINFO()
            bmi.bmiHeader.biSize = ctypes.sizeof(_BITMAPINFOHEADER)
            bmi.bmiHeader.biWidth = w
            bmi.bmiHeader.biHeight = -h  # 自上而下
            bmi.bmiHeader.biPlanes = 1
            bmi.bmiHeader.biBitCount = 32
            bmi.bmiHeader.biCompression = 0
            buf = ctypes.create_string_buffer(w * h * 4)
            copied = windll.gdi32.GetDIBits(hdc, hbm, 0, h, buf, ctypes.byref(bmi), 0)
            windll.user32.ReleaseDC(None, hdc)
            if copied == 0:
                return None
            img = Image.frombuffer("RGB", (w, h), buf.raw, "raw", "BGRX", 0, 1)
            return _resize_cover(img)
        finally:
            if hbm:
                windll.gdi32.DeleteObject(hbm)
            release(factory)
    except Exception:  # noqa: BLE001
        return None


# ---------- 对外接口 ----------


def pick_media_file(folder: str) -> str | None:
    """挑一个最适合直接播放/查看的本地文件（本地快速预览用）。"""
    pj = os.path.join(folder, "project.json")
    if os.path.isfile(pj):
        try:
            with open(pj, encoding="utf-8-sig", errors="replace") as f:
                name = (json.load(f) or {}).get("file") or ""
            if name:
                path = os.path.join(folder, name)
                if os.path.isfile(path):
                    return path
        except Exception:  # noqa: BLE001
            pass
    try:
        for entry in sorted(os.listdir(folder)):
            if entry.lower().endswith(_MEDIA_EXTS) and os.path.isfile(os.path.join(folder, entry)):
                return os.path.join(folder, entry)
    except OSError:
        pass
    return None


def extract(folder: str) -> Image.Image:
    """提取缩略图，失败返回占位图。"""
    for name in _PREVIEW_NAMES:
        path = os.path.join(folder, name)
        if os.path.isfile(path):
            im = _load_image(path)
            if im:
                return im
    gif = os.path.join(folder, "preview.gif")
    if os.path.isfile(gif):
        im = _load_image(gif)
        if im:
            return im
    media = pick_media_file(folder)
    if media and media.lower().endswith((".mp4", ".webm", ".mkv", ".mov")):
        im = shell_thumbnail(media)
        if im:
            return im
    return placeholder()
