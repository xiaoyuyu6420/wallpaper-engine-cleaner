<div align="center">

# WE Cleaner

**Wallpaper Engine wallpaper manager & leftover cleaner**

See what every wallpaper costs you · batch-unsubscribe unwanted ones · restore what you deleted by accident

[![Release](https://img.shields.io/github/v/release/xiaoyuyu6420/wallpaper-engine-cleaner?color=4f8cff&label=download)](https://github.com/xiaoyuyu6420/wallpaper-engine-cleaner/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-blue)](https://github.com/xiaoyuyu6420/wallpaper-engine-cleaner/releases/latest)
[![Python](https://img.shields.io/badge/python-3.12+-yellow)](pyproject.toml)

<img src="docs/screenshot.png" alt="WE Cleaner screenshot" width="860">

[中文文档](README.md) · English

</div>

## Interface

An isometric specimen-shelf UI in the spirit of RhinE's "Audio Archive" — every wallpaper is a specimen case on its own shelf:

- **Three views**: Library / History / Appearance (6 palettes × light & dark)
- **Two layouts**: **Shelf** (isometric 3D specimen rack) and **Grid** (card wall), switchable from the toolbar
- **Comfortable multi-select**: click a case to focus it, use the corner mark or Space to add it to the batch; the bottom bar's "Clean selected" handles the rest
- **Live reconciliation**: subscription state syncs with Steam every 5 seconds

## The problem

Wallpaper Engine wallpapers are several GB each. Subscribe to a few dozen and you've silently lost 50–150 GB of disk space. Worse:

- **Unsubscribing often leaves files behind** — files stay on disk taking up space while being invisible in the client
- **No way to see which wallpaper is the biggest or when it was installed**
- **No batch unsubscribe** — removing wallpapers one by one in the client is painful
- **No undo** — unsubscribe by accident and the files are gone

WE Cleaner solves all four: a specimen-shelf library with exact sizes, batch unsubscribe through official Steam APIs, leftover cleanup, and a history log that can restore subscriptions with one click.

## Features

| Feature | Description |
|---|---|
| 🗄 **Isometric shelf / grid** | Two layouts: a 3D shelf with card top-face hit testing, or a 32-per-page card wall for fast scanning |
| 🖼 **Thumbnails & titles** | Preview image, title, size, install date and subscription status for every wallpaper |
| 🔍 **Search & sort** | Live filter by title/ID; sort by size or subscription time (newest first) |
| ⚡ **Batch multi-select** | Whole-card click / corner mark / Space; the bottom bar shows count and total size live |
| 🔥 **Smart clean** | One click: subscribed items are unsubscribed and deleted, unsubscribed leftovers are deleted directly |
| 🧹 **Leftover cleanup** | Finds files from unsubscribed wallpapers that Steam failed to delete — without touching active subscriptions |
| 🕘 **History & restore** | Every unsubscribe/delete is logged; re-subscribe with one click and Steam re-downloads |
| 🎬 **Quick local preview** | Play a wallpaper's video without opening Wallpaper Engine |
| 🎨 **Appearance** | 6 palettes × light/dark, switchable case skins, choices are remembered |

## Quick start

1. Download `WECleanerNext.exe` from [Releases](https://github.com/xiaoyuyu6420/wallpaper-engine-cleaner/releases/latest) (portable, ~94 MB, front-end assets included)
2. Keep **Steam running**, double-click the exe
3. Search / sort / filter to find unwanted wallpapers → select → **Clean selected**
4. Made a mistake? Open **History** → select → **Resubscribe** — Steam downloads them back

> **Requirements**: Windows 10/11 with Steam and Wallpaper Engine installed. The UI runs on WebView2 — built into Windows 11, and normally already present on Windows 10 via Edge (otherwise install the [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)).

## CLI

The CLI keeps the full feature set (`run.py` entry point):

```text
wecleaner scan                            # list all wallpapers (size/time/subscription status)
wecleaner unsubscribe --list              # read-only subscription listing
wecleaner unsubscribe --all               # unsubscribe everything
wecleaner unsubscribe --id 123456         # unsubscribe a specific ID
wecleaner clean --all -y                  # remove all unsubscribed leftovers (to Recycle Bin)
wecleaner history                         # view operation history
wecleaner resubscribe --all               # restore subscriptions from history
```

## Safety

- **Read-only mode when subscription state is unreliable** — never touches files without verified information
- **Delete and unsubscribe are physically separated** — deletions only ever target unsubscribed leftovers
- **Deletes go to the Recycle Bin by default**; permanent delete requires an explicit opt-in and a second confirmation
- **Manual override** — if you know everything is unsubscribed, an explicit unlock (with a strong confirmation) re-enables cleaning
- **No account risk** — uses the official Steamworks `ISteamUGC` interface, the same channel the Wallpaper Engine client itself uses. No passwords, no injection, no hooks

## How it works

```text
Locate Steam and all game libraries (registry + libraryfolders.vdf)
        ↓
Read the authoritative subscription list (Steamworks ISteamUGC via the running Steam client)
        ↓
Diff against on-disk workshop content  →  "subscribed" vs "leftover" separated exactly
        ↓
Unsubscribe / clean / restore — all delegated to the Steam client
```

The tool borrows any installed game's `steam_api64.dll` and connects as Wallpaper Engine (AppID 431960) — the same channel the WE client uses for its own workshop operations.

## Build from source

Requires [uv](https://docs.astral.sh/uv/):

```bash
uv sync
uv run app.py            # run the new UI in development

# rebuild (output: dist/WECleanerNext.exe)
uv run pyinstaller --onefile --noconfirm --name WECleanerNext \
  --collect-all webview --add-data "webui;webui" app.py
```

Stack: Python 3.12 · pywebview (WebView2) · HTML / CSS / Canvas (no build step) · Pillow · send2trash · PyInstaller.

The earlier CustomTkinter UI in `wecleaner/gui.py` is kept as a fallback; `run.py` is also the CLI entry point.

## License

[MIT](LICENSE)
