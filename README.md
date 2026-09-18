<div align="center">

# WE Cleaner

**Wallpaper Engine 壁纸管理 & 残留清理工具**

看清每张动态壁纸的占用和订阅状态 · 批量退订不要的 · 一键找回手滑删掉的

[![Release](https://img.shields.io/github/v/release/xiaoyuyu6420/wallpaper-engine-cleaner?color=4f8cff&label=下载)](https://github.com/xiaoyuyu6420/wallpaper-engine-cleaner/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-blue)](https://github.com/xiaoyuyu6420/wallpaper-engine-cleaner/releases/latest)
[![Python](https://img.shields.io/badge/python-3.12+-yellow)](pyproject.toml)

<img src="docs/screenshot.png" alt="WE Cleaner 界面截图" width="860">

中文 · [English](README_EN.md)

</div>

## 解决什么问题

Wallpaper Engine 的壁纸动辄几 GB，订阅几十张不知不觉就吃掉几十上百 GB 磁盘。更麻烦的是：

- **取消订阅后，文件经常删不干净**——Steam 的老毛病，残留文件夹一直占着空间，在创意工坊里还看不出来
- **想知道哪张壁纸最占地方、什么时候装的**，客户端里没有这种视角
- **想批量退订**，客户端只能一张一张右键移除
- **退订后反悔了**，文件已经被删，只能重新去创意工坊翻找

WE Cleaner 把这些问题一次解决：缩略图卡片墙 + 精确占用统计 + 批量退订 + 操作历史一键恢复订阅。

## 功能

| 功能 | 说明 |
|---|---|
| 🖼 **缩略图卡片墙** | 每张壁纸显示预览图、标题、占用大小、安装时间、订阅状态，一眼看清 |
| 🔍 **搜索与排序** | 按标题/ID 实时过滤；按占用大小、订阅时间排序，找出最占地的那几张 |
| ⚡ **批量退订** | 勾选多张一次性退订，走 Steam 官方接口，Steam 自动删除文件并取消下载 |
| 🧹 **残留清理** | 自动识别「已退订但没删掉」的残留文件，精确清理，不误伤订阅中的内容 |
| 🕘 **历史与恢复订阅** | 每次退订/删除都有记录，点一下就能重新订阅，Steam 自动重新下载 |
| 🎬 **本地快速预览** | 不用打开 Wallpaper Engine，直接播放壁纸视频确认内容 |

## 快速开始

1. 到 [Releases](https://github.com/xiaoyuyu6420/wallpaper-engine-cleaner/releases/latest) 下载 `WECleaner.exe`（免安装，约 20 MB）
2. 保持 **Steam 正在运行**，双击打开
3. 自动扫描完成后：排序 / 搜索挑出不要的壁纸 → 勾选 → 「退订选中」
4. 退订错了？点「🕘 历史」→ 勾选 → 「重新订阅勾选」，Steam 自动下回来

> 系统要求：Windows 10/11，已安装 Steam 和 Wallpaper Engine。首次运行若被 SmartScreen 提示，选择「更多信息 → 仍要运行」（未签名开源软件的正常提示）。

## 命令行

```text
WECleaner scan                            # 列出全部壁纸（大小/时间/订阅状态）
WECleaner unsubscribe --list              # 列出当前订阅（只读预览）
WECleaner unsubscribe --all               # 批量退订全部订阅
WECleaner unsubscribe --id 123456         # 退订指定 ID
WECleaner clean --all -y                  # 清理全部未订阅残留（默认进回收站）
WECleaner history                         # 查看退订/删除历史
WECleaner resubscribe --all               # 从历史一键恢复订阅
```

## 安全设计

- **订阅状态不可信时禁用一切改操作**：Steam 未运行或记录异常时自动进入只读模式，绝不在信息不全时动你的文件
- **删与退订物理隔离**：删除只作用于未订阅的残留，退订只作用于订阅中的壁纸，不可能互相误伤
- **删除默认进回收站**，可反悔；「彻底删除」需要手动勾选并二次确认
- **账号安全**：全程使用 Steam 官方 Steamworks 接口（`ISteamUGC`），不接触你的账号密码，不修改游戏文件；所有操作等价于你在 Steam 客户端里的点击

## 工作原理

```text
定位 Steam 安装与全部游戏库（注册表 + libraryfolders.vdf）
        ↓
读取权威订阅列表（通过 Steamworks ISteamUGC 接口连接运行中的 Steam）
        ↓
对比磁盘上的工坊内容  →  「订阅中」与「已退订残留」精确分离
        ↓
退订 / 清理 / 恢复，全部委托 Steam 客户端执行
```

工具借用本机任意已安装游戏自带的 `steam_api64.dll` 以 Wallpaper Engine 的 AppID 连接 Steam 客户端——这正是 Wallpaper Engine 客户端自身与 Steam 通信的同一通道，不注入、不 hook、不改内存。

## 从源码构建

需要 [uv](https://docs.astral.sh/uv/)：

```bash
uv sync
uv run pyinstaller --onefile --clean --collect-all customtkinter --name WECleaner run.py
# 产物：dist/WECleaner.exe
```

技术栈：Python 3.12 · CustomTkinter · Pillow · PyInstaller（单文件打包）

## 常见问题

<details>
<summary><b>「安装时间」为什么显示的是最近的时间？</b></summary>
时间来自 Steam 本地记录，重新安装 Wallpaper Engine 后重新下载的壁纸会显示重新安装的时间。
</details>

<details>
<summary><b>需要一直开着 Steam 吗？</b></summary>
退订和恢复订阅需要 Steam 运行（走官方接口）。只浏览、搜索、查看占用则不需要。
</details>

<details>
<summary><b>会不会有账号风险？</b></summary>
不会。工具调用的是 Steamworks 标准接口，行为与客户端内点击「取消订阅」完全一致，不涉及登录凭据，也没有任何注入或内存修改。
</details>

<details>
<summary><b>支持清理其他游戏的创意工坊残留吗？</b></summary>
核心扫描逻辑通过 <code>--appid</code> 参数支持任意 Steam 游戏的工坊内容；界面默认针对 Wallpaper Engine。
</details>

## License

[MIT](LICENSE)
