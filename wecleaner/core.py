"""核心逻辑：定位 Steam 库、解析 ACF、扫描工坊残留、安全删除。

原理：Steam 退订创意工坊物品后偶尔删除失败，文件夹会一直留在
``steamapps\\workshop\\content\\<appid>\\`` 下。本模块对比磁盘上的
文件夹和 Steam 本地订阅记录（appworkshop_<appid>.acf），把
"已退订但仍在磁盘上"的目录找出来。
"""

from __future__ import annotations

import os
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

WE_APPID = "431960"  # Wallpaper Engine
APP_NAMES = {WE_APPID: "Wallpaper Engine"}
STEAM_PROCS = ("steam.exe",)
WE_PROCS = ("wallpaper32.exe", "wallpaper64.exe")


def parse_vdf(text: str) -> dict:
    """解析 Steam 的 VDF/ACF 文本格式（"key" "value" 或 "key" { 嵌套 }）。"""
    pos = 0
    n = len(text)

    def skip_ws() -> None:
        nonlocal pos
        while pos < n and text[pos] in " \t\r\n":
            pos += 1

    def read_token() -> str | None:
        nonlocal pos
        skip_ws()
        if pos >= n:
            return None
        if text[pos] == '"':
            pos += 1
            start = pos
            while pos < n and text[pos] != '"':
                pos += 1
            tok = text[start:pos]
            pos += 1  # 跳过收尾引号
            return tok
        start = pos
        while pos < n and text[pos] not in " \t\r\n{}":
            pos += 1
        return text[start:pos]

    def parse_block() -> dict:
        nonlocal pos
        block: dict = {}
        while True:
            skip_ws()
            if pos >= n:  # 容错：文件意外截断
                return block
            if text[pos] == "}":
                pos += 1
                return block
            key = read_token()
            if key is None:
                return block
            skip_ws()
            if pos < n and text[pos] == "{":
                pos += 1
                block[key] = parse_block()
            else:
                block[key] = read_token()

    skip_ws()
    if pos < n and text[pos] == "{":
        pos += 1
    return parse_block()


def _steam_base_candidates() -> list[str]:
    bases: list[str] = []
    try:
        import winreg

        for view in (winreg.KEY_WOW64_32KEY, winreg.KEY_WOW64_64KEY):
            try:
                with winreg.OpenKey(
                    winreg.HKEY_LOCAL_MACHINE,
                    r"SOFTWARE\Valve\Steam",
                    0,
                    winreg.KEY_READ | view,
                ) as key:
                    bases.append(str(winreg.QueryValueEx(key, "InstallPath")[0]))
            except OSError:
                pass
    except ImportError:
        pass
    bases.append(os.path.expandvars(r"%ProgramFiles(x86)%\Steam"))
    bases.append(os.path.expandvars(r"%ProgramFiles%\Steam"))
    return [b for b in bases if os.path.isdir(b)]


def find_steam_libraries() -> list[str]:
    """返回本机所有 Steam 库目录（含主安装目录）。"""
    libs: list[str] = []
    seen: set[str] = set()

    def add(raw: str) -> None:
        path = os.path.normpath(raw.replace("\\\\", "\\"))
        if path.lower() not in seen and os.path.isdir(path):
            seen.add(path.lower())
            libs.append(path)

    for base in _steam_base_candidates():
        add(base)
        vdf = os.path.join(base, "steamapps", "libraryfolders.vdf")
        if not os.path.isfile(vdf):
            continue
        try:
            with open(vdf, encoding="utf-8", errors="replace") as f:
                data = parse_vdf(f.read())
        except OSError:
            continue
        for entry in (data.get("libraryfolders") or {}).values():
            if isinstance(entry, dict) and entry.get("path"):
                add(str(entry["path"]))
    return libs


@dataclass
class Item:
    """一个工坊内容文件夹（无论是否订阅中）。"""

    wid: str  # 创意工坊 ID
    path: str
    size: int  # 字节
    subscribed: bool = False
    time_updated: int = 0  # 本地安装/更新时间（unix 秒），0 = 未知（下载中）
    title: str = ""  # 来自 project.json，离线可读

    @property
    def url(self) -> str:
        return f"https://steamcommunity.com/sharedfiles/filedetails/?id={self.wid}"


@dataclass
class ScanResult:
    appid: str
    app_name: str
    libraries: list[str] = field(default_factory=list)
    content_dirs: list[str] = field(default_factory=list)
    acf_found: bool = False
    subscribed: set[str] = field(default_factory=set)
    installed: set[str] = field(default_factory=set)
    time_updated: dict[str, int] = field(default_factory=dict)
    subscribed_source: str = ""  # "steam_api"（权威）或 "acf"
    items: list[Item] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    deletion_blocked: bool = False  # 订阅状态不可信时禁用一切删除

    @property
    def total_size(self) -> int:
        return sum(max(i.size, 0) for i in self.items)


# ---------- 操作历史（软件的记忆）----------

HISTORY_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "WECleaner"
HISTORY_PATH = HISTORY_DIR / "history.json"


def load_history() -> dict:
    """读取退订/删除历史。结构：{"items": {wid: {title,size,ts,action}}}。"""
    try:
        import json

        with open(HISTORY_PATH, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("items"), dict):
            return data
    except (OSError, ValueError):
        pass
    return {"items": {}}


def record_history(items: list["Item"], action: str) -> None:
    """把退订/删除成功的壁纸记入历史，供之后一键恢复订阅。"""
    import json
    import time as _time

    data = load_history()
    now = int(_time.time())
    for it in items:
        data["items"][str(it.wid)] = {
            "title": it.title or it.wid,
            "size": it.size,
            "ts": now,
            "action": action,
        }
    try:
        HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        with open(HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
    except OSError:
        pass  # 记录失败不影响主流程


def drop_history(wids) -> None:
    """重新订阅成功后把对应条目移出历史。"""
    import json

    data = load_history()
    for w in wids:
        data["items"].pop(str(w), None)
    try:
        HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        with open(HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
    except OSError:
        pass


def _read_title(folder: str) -> str:
    """读 project.json 里的壁纸标题（作者上传时填的名字，离线可用）。"""
    pj = os.path.join(folder, "project.json")
    if not os.path.isfile(pj):
        return ""
    try:
        import json

        with open(pj, encoding="utf-8-sig", errors="replace") as f:
            return str((json.load(f) or {}).get("title") or "")
    except Exception:  # noqa: BLE001 - 坏文件不影响扫描
        return ""


class _MeasureTimeout(Exception):
    """单文件夹测量超预算（通常因为 Steam 正在写入/删除该目录）。"""


def dir_size(path: str, budget: float = 30.0) -> int:
    """测量目录大小。budget 秒内没测完则抛 _MeasureTimeout，避免扫描卡死。"""
    t0 = time.monotonic()
    total = 0
    stack = [path]
    while stack:
        if time.monotonic() - t0 > budget:
            raise _MeasureTimeout(path)
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    try:
                        if e.is_dir(follow_symlinks=False):
                            stack.append(e.path)
                        else:
                            total += e.stat(follow_symlinks=False).st_size
                    except OSError:
                        pass
        except OSError:
            pass
    return total


def scan(
    appid: str = WE_APPID,
    on_item=None,
    on_progress=None,
    workers: int = 8,
    subscribed_override: set[str] | None = None,
) -> ScanResult:
    """扫描所有 Steam 库，返回工坊内容列表（默认按占用降序）。

    subscribed_override：来自运行中 Steam 客户端的权威订阅列表（steamapi 模块）。
    提供时优先于本地 ACF 记录。on_progress / on_item 在每测完一个文件夹时回调。
    """
    res = ScanResult(appid=appid, app_name=APP_NAMES.get(appid, f"App {appid}"))
    res.libraries = find_steam_libraries()
    if not res.libraries:
        res.warnings.append("没有找到 Steam，请确认本机安装了 Steam。")
        return res

    for lib in res.libraries:
        cdir = os.path.join(lib, "steamapps", "workshop", "content", appid)
        if os.path.isdir(cdir):
            res.content_dirs.append(cdir)
        acf = os.path.join(lib, "steamapps", "workshop", f"appworkshop_{appid}.acf")
        if not os.path.isfile(acf):
            continue
        res.acf_found = True
        try:
            with open(acf, encoding="utf-8", errors="replace") as f:
                data = parse_vdf(f.read())
        except OSError as e:
            res.warnings.append(f"读取订阅记录失败：{acf}（{e}）")
            continue
        ws = data.get("AppWorkshop") or {}
        sub = ws.get("WorkshopItemsSubscribed")
        ins = ws.get("WorkshopItemsInstalled")
        if isinstance(sub, dict):
            res.subscribed.update(sub)
        if isinstance(ins, dict):
            res.installed.update(ins)
            for wid, info in ins.items():
                if isinstance(info, dict) and info.get("timeupdated"):
                    try:
                        res.time_updated[str(wid)] = int(info["timeupdated"])
                    except (TypeError, ValueError):
                        pass

    # 订阅真值：运行中的 Steam 客户端 > 本地 ACF
    if subscribed_override is not None:
        res.subscribed = set(subscribed_override)
        res.subscribed_source = "steam_api"
    elif res.subscribed:
        res.subscribed_source = "acf"

    # 订阅真值不可信时，禁止一切删除——宁可扫不出来，不可误删。
    # 教训：Wallpaper Engine 的 ACF 可能长期没有 WorkshopItemsSubscribed 键
    # （已安装记录齐全但订阅列表缺失），此时绝不能把磁盘内容当残留。
    if not res.subscribed and res.subscribed_source != "steam_api":
        res.deletion_blocked = True
        if not res.acf_found:
            reason = "未找到订阅记录文件（appworkshop_%s.acf）" % appid
        elif res.installed:
            reason = "订阅清单为空但存在 %d 条已安装记录，Steam 记录自相矛盾" % len(res.installed)
        else:
            reason = "Steam 记录中没有任何订阅/安装信息"
        res.warnings.append(
            f"{reason}，无法确认哪些内容仍在订阅，已禁用删除。"
            "请先启动 Steam 并打开一次 Wallpaper Engine 让它同步订阅，再重新扫描。"
        )

    targets: list[Item] = []
    for cdir in res.content_dirs:
        try:
            entries = os.listdir(cdir)
        except OSError as e:
            res.warnings.append(f"读取目录失败：{cdir}（{e}）")
            continue
        for wid in entries:
            path = os.path.join(cdir, wid)
            if not os.path.isdir(path):
                continue
            title = _read_title(path)
            targets.append(
                Item(
                    wid=wid,
                    path=path,
                    size=0,
                    subscribed=wid in res.subscribed,
                    time_updated=res.time_updated.get(wid, 0),
                    title=title or wid,
                )
            )

    def measure(item: Item) -> Item:
        try:
            item.size = dir_size(item.path)
        except _MeasureTimeout:
            item.size = -1  # Steam 正在写入/删除，大小未知，绝不卡死扫描
        return item

    total = len(targets)
    done = 0
    if total:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            futures = [pool.submit(measure, it) for it in targets]
            for fut in as_completed(futures):
                item = fut.result()
                done += 1
                if on_progress:
                    on_progress(done, total, item)
                if on_item:
                    on_item(item)
                res.items.append(item)
    res.items.sort(key=lambda i: i.size, reverse=True)
    unknown = sum(1 for i in res.items if i.size < 0)
    if unknown:
        res.warnings.append(
            f"{unknown} 个壁纸正被 Steam 写入/删除，大小暂时未知——不影响退订/删除操作，稍后重新扫描可刷新。"
        )
    return res


def running_processes(names: tuple[str, ...]) -> set[str]:
    """检查哪些进程正在运行。查询失败时按"全部在运行"处理（保守策略）。"""
    try:
        out = subprocess.run(
            ["tasklist", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            timeout=15,
        ).stdout.lower()
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return set(names)
    return {name for name in names if f'"{name.lower()}"' in out}


def fmt_size(num: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if num < 1024 or unit == "TB":
            return f"{int(num)} B" if unit == "B" else f"{num:.2f} {unit}"
        num /= 1024
    return f"{num:.2f} TB"


def delete_items(
    items: list[Item],
    permanent: bool = False,
    progress=None,
) -> tuple[int, list[tuple[str, str]]]:
    """删除残留目录，返回 (成功移除的字节数, 失败列表[(wid, 错误信息)])。

    默认移入回收站（同盘移动，速度快且可反悔）；permanent=True 时直接删除。
    单个文件夹失败不会中断整体。
    """
    freed = 0
    failures: list[tuple[str, str]] = []
    for idx, item in enumerate(items, 1):
        if progress:
            progress(idx, len(items), item)
        try:
            if permanent:
                import shutil

                shutil.rmtree(item.path)
            else:
                from send2trash import send2trash

                send2trash(item.path)
            freed += item.size
        except Exception as e:  # noqa: BLE001 - 任何单点失败都只记录不中断
            failures.append((item.wid, str(e)))
    return freed, failures
