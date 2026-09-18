"""命令行入口。不带参数启动图形界面，带子命令走命令行。"""

from __future__ import annotations

import argparse
import os
import sys
import time

from . import core


def _hide_console() -> None:
    """GUI 模式下隐藏控制台窗口（exe 为控制台构建）。"""
    if os.name == "nt":
        try:
            import ctypes

            ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)
        except Exception:  # noqa: BLE001
            pass


def _print_report(res: core.ScanResult) -> None:
    for warning in res.warnings:
        print("⚠ " + warning)
    if not res.libraries:
        print("✘ 没有找到 Steam。")
        return
    if not res.items:
        print("✔ 很干净，没有发现壁纸。")
        return
    n_sub = sum(1 for i in res.items if i.subscribed)
    print(f"共 {len(res.items)} 个壁纸（订阅中 {n_sub} / 未订阅 {len(res.items) - n_sub}），合计 {core.fmt_size(res.total_size)}：\n")
    for item in res.items:
        date = time.strftime("%Y-%m-%d", time.localtime(item.time_updated)) if item.time_updated else "————"
        tag = "订阅中" if item.subscribed else "未订阅"
        size = "变化中" if item.size < 0 else core.fmt_size(item.size)
        print(f"  {size:>12}  {date}  [{tag}]  {item.wid}  {item.url}")
    running = core.running_processes(core.STEAM_PROCS + core.WE_PROCS)
    if running:
        print("\n⚠ 正在运行的相关进程：" + "、".join(sorted(running)) + "（建议先退出再删除）")


def _safe_stdio() -> None:
    """控制台可能是 GBK 编码，⚠✔ 等符号会崩；保持默认编码、只做容错替换。"""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except (AttributeError, OSError, ValueError):
            pass


def _cmd_unsubscribe(args) -> int:
    """批量退订：通过 Steam 官方接口，Steam 会自动删文件并取消下载。"""
    from . import steamapi

    if not steamapi.connect():
        print("✘ 无法连接 Steam：请确认 Steam 正在运行且已登录，且本机装有 Wallpaper Engine。")
        return 2
    try:
        subscribed = steamapi.get_subscribed()
        if not subscribed:
            print("✔ 当前没有任何订阅。")
            return 0

        if args.all:
            targets = set(subscribed)
        else:
            targets = set(args.id) & subscribed
            for wid in sorted(set(args.id) - subscribed):
                print(f"⚠ 跳过 {wid}：不在订阅列表里")

        print(f"当前订阅 {len(subscribed)} 个，将退订 {len(targets)} 个。")
        for wid in sorted(targets):
            print(f"  {wid}  https://steamcommunity.com/sharedfiles/filedetails/?id={wid}")
        if args.list or not targets:
            print("（--list 只读模式，未做修改）")
            return 0

        print("\n⚠ 退订后 Steam 将删除这些壁纸的本地文件（含正在下载的部分），")
        print("  以后想要需要重新订阅并重新下载。此操作作用于你的 Steam 账号。")
        if not args.yes:
            answer = input("确认退订请输入 yes：").strip().lower()
            if answer != "yes":
                print("已取消。")
                return 1

        ok = fail = 0
        for i, wid in enumerate(sorted(targets), 1):
            if steamapi.unsubscribe(wid):
                ok += 1
            else:
                fail += 1
            print(f"  [{i}/{len(targets)}] {wid} {'✔' if not fail else '✘ 失败'}")
        print(f"\n✔ 已提交退订 {ok} 个，失败 {fail} 个。")
        print("提示：Steam 会异步取消相关下载并删除文件，稍等片刻空间才会释放。")
        return 1 if fail else 0
    finally:
        steamapi.shutdown()


def main(argv=None) -> int:
    _safe_stdio()
    parser = argparse.ArgumentParser(
        prog="WECleaner",
        description="清理 Steam 创意工坊退订后残留文件的绿色小工具（默认针对 Wallpaper Engine）",
    )
    parser.add_argument("--appid", default=core.WE_APPID, help="Steam App ID（默认 431960 = Wallpaper Engine）")
    sub = parser.add_subparsers(dest="cmd")
    sub.add_parser("scan", help="命令行扫描并列出残留")
    p_clean = sub.add_parser("clean", help="命令行删除残留")
    p_clean.add_argument("--all", action="store_true", help="删除全部残留")
    p_clean.add_argument("--id", action="append", default=[], metavar="WORKSHOP_ID", help="指定工坊 ID，可重复")
    p_clean.add_argument("--permanent", action="store_true", help="彻底删除而不进回收站（慎用）")
    p_clean.add_argument("-y", "--yes", action="store_true", help="跳过确认")
    p_clean.add_argument("--force", action="store_true", help="订阅状态未知时强制允许删除（风险自负）")
    p_unsub = sub.add_parser("unsubscribe", help="批量取消创意工坊订阅（Steam 自动删除对应文件并取消下载）")
    p_unsub.add_argument("--all", action="store_true", help="取消全部订阅")
    p_unsub.add_argument("--id", action="append", default=[], metavar="WORKSHOP_ID", help="指定订阅 ID，可重复")
    p_unsub.add_argument("--list", action="store_true", help="只列出订阅，不做任何修改")
    p_unsub.add_argument("-y", "--yes", action="store_true", help="跳过确认")
    sub.add_parser("history", help="查看退订/删除历史（软件的记忆，可用于恢复订阅）")
    p_resub = sub.add_parser("resubscribe", help="从历史恢复订阅（Steam 自动重新下载）")
    p_resub.add_argument("--all", action="store_true", help="恢复历史中的全部壁纸")
    p_resub.add_argument("--id", action="append", default=[], metavar="WORKSHOP_ID", help="指定 ID，可重复")
    p_resub.add_argument("-y", "--yes", action="store_true", help="跳过确认")
    args = parser.parse_args(argv)

    if args.cmd is None:
        _hide_console()
        from .gui import run

        run(appid=args.appid)
        return 0

    if args.cmd == "unsubscribe":
        return _cmd_unsubscribe(args)  # 退订只跟 Steam 打交道，无需扫描磁盘

    if args.cmd == "history":
        items = core.load_history()["items"]
        if not items:
            print("没有历史记录。退订或删除壁纸后会记在这里。")
            return 0
        print(f"历史记录 {len(items)} 条（新→旧）：")
        for wid, info in sorted(items.items(), key=lambda kv: -kv[1].get("ts", 0)):
            date = time.strftime("%y-%m-%d %H:%M", time.localtime(info.get("ts", 0)))
            act = "退订" if info.get("action") == "unsubscribe" else "删除"
            print(f"  {date} [{act}] {wid}  {str(info.get('title', ''))[:32]}")
        return 0

    if args.cmd == "resubscribe":
        items = core.load_history()["items"]
        if args.all:
            targets = sorted(items)
        else:
            targets = [i for i in args.id if i in items]
            for wid in sorted(set(args.id) - set(targets)):
                print(f"⚠ 跳过 {wid}：不在历史记录里")
        if not targets:
            print("没有可恢复的对象。")
            return 0
        print(f"将重新订阅 {len(targets)} 个壁纸，Steam 会自动重新下载（注意磁盘空间）：")
        for wid in targets:
            print(f"  {wid}  {str(items[wid].get('title', ''))[:32]}")
        if not args.yes:
            if input("确认请输入 yes：").strip().lower() != "yes":
                print("已取消。")
                return 1
        from . import steamapi

        if not steamapi.connect():
            print("✘ 无法连接 Steam：请确认 Steam 正在运行且已登录。")
            return 2
        ok = fail = 0
        try:
            for i, wid in enumerate(targets, 1):
                print(f"  [{i}/{len(targets)}] {wid}")
                try:
                    if steamapi.subscribe(wid):
                        ok += 1
                        core.drop_history([wid])
                    else:
                        fail += 1
                except Exception:  # noqa: BLE001
                    fail += 1
        finally:
            steamapi.shutdown()
        print(f"\n✔ 已重新订阅 {ok} 个，失败 {fail} 个。Steam 正在后台下载。")
        return 1 if fail else 0

    override = None
    try:
        from . import steamapi

        if steamapi.connect():
            override = steamapi.get_subscribed()
    except Exception:  # noqa: BLE001 - API 失败时回退 ACF
        override = None

    res = core.scan(args.appid, subscribed_override=override)
    _print_report(res)

    if args.cmd == "scan":
        return 0

    if args.cmd == "clean" and res.deletion_blocked and not args.force:
        print("\n✘ 删除已被禁止：订阅状态无法确认，此时删除可能误伤仍在订阅的内容。")
        print("  请先启动 Steam 并打开一次 Wallpaper Engine 让它同步，再重新扫描。")
        print("  （确要冒险可加 --force，风险自负）")
        return 2

    if args.all:
        chosen = [i for i in res.items if not i.subscribed]
        n_sub = len(res.items) - len(chosen)
        if n_sub:
            print(f"⚠ 跳过 {n_sub} 个订阅中的壁纸（删除文件只针对未订阅项；如需退订请用 unsubscribe 命令）")
    else:
        wanted = set(args.id)
        chosen = [i for i in res.items if i.wid in wanted]
        missing = wanted - {i.wid for i in chosen}
        for wid in sorted(missing):
            print(f"⚠ 跳过 {wid}：不在残留列表里（可能不存在或仍在订阅中）")

    if not chosen:
        print("没有可删除的对象。")
        return 0

    total = sum(i.size for i in chosen)
    mode = "彻底删除（无法恢复）" if args.permanent else "移入回收站"
    print(f"\n将删除 {len(chosen)} 个残留，共 {core.fmt_size(total)}。方式：{mode}")
    if not args.yes:
        answer = input("确认请输入 yes：").strip().lower()
        if answer != "yes":
            print("已取消。")
            return 1

    def progress(done: int, total_n: int, item: core.Item) -> None:
        print(f"  [{done}/{total_n}] {item.wid}")

    freed, failures = core.delete_items(chosen, permanent=args.permanent, progress=progress)
    print(f"\n✔ 完成：已移除 {core.fmt_size(freed)}，失败 {len(failures)} 个。")
    if not args.permanent:
        print("提示：文件在回收站里，清空回收站后空间才真正释放。")
    for wid, err in failures:
        print(f"✘ {wid}：{err}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
