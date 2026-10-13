# WE Cleaner Web 前端契约

**适用版本**：wecleaner 0.6.x + `wecleaner/bridge.py`（pywebview 桥接层）
**前端入口**：`webui/app/index.html`（`app.py` 加载）
**权威性**：本文件与 `wecleaner/bridge.py` 必须逐字一致。**改实现必须同步改这里**；
两边打架时以实现为准，并立即修正本文件。

---

## 0. 通信模型

```
前端 (HTML/JS)                          Python (wecleaner/bridge.py 的 Api)
────────────────                        ──────────────────────────────────
await window.pywebview.api.xxx(...) ──→  Api.xxx(...)   返回 dict（自动转 JSON）
window.__dispatch({...})          ←────  Api._push(...)   长任务/进度事件
```

- **调用**：pywebview 会把 `Api` 的公开方法（不含 `_` 前缀、且是方法）注入成
  `window.pywebview.api.<名字>`。返回的 dict 会被转成 JSON，JS 侧拿到的是 Promise。
  参数名不参与匹配，JS 侧按**位置**传参即可。
  实际注入的方法（在真窗口里用 `Object.keys(window.pywebview.api)` 核对过，共 13 个，
  与 §1 表格一一对应）：
  `scan` `sync` `get_state` `unlock` `get_thumb` `get_thumbs` `open_preview` `open_url`
  `unsubscribe` `delete` `history` `resubscribe` `set_permanent`。
- **事件**：所有异步结果都通过 `window.__dispatch(msg)` 推送，`msg` 是一个对象，
  **一定有 `event` 字段**（字符串），其余字段按事件类型不同。前端**必须自己定义**
  `window.__dispatch`；没定义时 Python 侧的推送会静默失败（任务不受影响，但界面收不到更新）。
- **窗口就绪**：`window.pywebview` 是异步注入的。请用
  `window.addEventListener('pywebviewready', boot)`，脚本加载时同步判断
  `if (window.pywebview) boot();` 也行。
- **线程模型**：所有长任务都在后台线程执行，API 调用本身**立刻返回**
  （`{"started": true}`），不会卡住界面。真正会同步耗时的只有
  `get_thumb / get_thumbs / history / get_state / open_preview / open_url`，
  其中 `get_thumbs` 遇到视频壁纸可能需要几百毫秒，所以**按当前页批量调用**，不要整库拉。
- **页面刷新（F5）**：刷新后前端会错过所有已发生的事件，必须用 `get_state()` 拿一次
  完整快照恢复界面，再调 `scan()`。

---

## 1. API 速查表

| 方法 | 参数 | 返回（成功） | 触发事件 |
|---|---|---|---|
| `scan()` | — | `{"started": true}` | `busy` → `scanProgress`×N → `scanDone` → `busy` |
| `sync()` | — | `{"started": true}` / `{"skipped": "busy"\|"inflight"}` | `syncDone` |
| `get_state()` | — | 完整快照（见 §2.3） | — |
| `unlock()` | — | `{"ok": true, "blocked": false, "canUnlock": bool}` | `unlocked` |
| `get_thumb(wid)` | `wid: string` | `{"wid": str, "data": dataURL\|""}` | — |
| `get_thumbs(wids)` | `wids: string[]` | `{"thumbs": {wid: dataURL\|""}}` | — |
| `open_preview(wid)` | `wid: string` | `{"ok": true, "path": str}` | — |
| `open_url(wid)` | `wid: string` | `{"ok": true, "url": str}` | — |
| `unsubscribe(wids, clean=false)` | `wids: string[]`, `clean: bool` | `{"started": true, "count": n, "clean": bool}` | `busy` → `opProgress`×N → `unsubDone` → `busy` |
| `delete(wids)` | `wids: string[]` | `{"started": true, "count": n, "permanent": bool}` | `busy` → `opProgress`×N → `delDone` → `busy` |
| `history()` | — | `{"items": [...], "count": n}`（见 §2.11） | — |
| `resubscribe(wids)` | `wids: string[]` | `{"started": true, "count": n}` | `busy` → `opProgress`×N → `resubDone` → `busy` |
| `set_permanent(value)` | `value: bool` | `{"permanent": bool}` | — |

失败一律返回 `{"error": <机器码>, "message": <中文说明>}`（见 §6）。

**事件顺序保证**：任何长任务的事件流都是
「`busy(value:true)` → 若干进度事件 → 结果事件（`*Done` / `taskError`）→ `busy(value:false)`」。
前端在 `busy(value:false)` 之前不要恢复操作按钮。`sync()` 是唯一**不占用** busy 的长任务。

---

## 2. API 详解

### 2.1 `scan()`

扫盘 + 向运行中的 Steam 要权威订阅列表（含订阅顺序），**只读，不改任何东西**。

- 返回：`{"started": true}`；若已有任务在跑：`{"error": "busy", "message": ...}`。
- 扫描开始时会清空前端应持有的旧列表；`scanDone.items` 是**全量**列表（默认按大小从大到小）。
- 订阅真值来源 `scanDone.source`：`"steam_api"`（连上了 Steam，权威）/ `"acf"`（只读到本地
  订阅记录，降级）/ `""`（什么都没有 → 会锁死，见 §5）。
- `scanDone.connectError` 非空表示 Steam 接口没连上（内容与 `steamapi.last_error` 一致），
  此时 `source` 会是 `"acf"` 或 `""`。

### 2.2 `sync()`

只读地跟 Steam 对一次账：订阅状态 + 订阅序号（`subIndex`），**不碰磁盘**。
建议前端每 5 秒调一次（原 tkinter 版就是 5 秒一次）。

- 忙时返回 `{"skipped": "busy"}`；上一次 sync 还没回来时返回 `{"skipped": "inflight"}`。
  **这两种都不是错误，前端静默忽略即可。**
- 事件 `syncDone`（§3.4）。连不上 Steam 时 `connected=false`，`changed` 为空，
  前端只更新锁定状态，不动列表。
- 若之前因订阅状态不可信而锁死，本方法一旦从 Steam 接口拿到权威列表会**自动解锁**，
  事件里 `autoUnlocked=true`，前端提示一句即可。

### 2.3 `get_state()`

返回完整快照，字段与 `scanDone` 的附加字段一致：

```jsonc
{
  "items": [ /* §4.1 item 数组 */ ],
  "count": 152, "subscribed": 148, "unsubscribed": 4,
  "totalSize": 12345678901, "totalSizeText": "11.49 GB",
  "blocked": false,        // 是否处于只读锁定（§5）
  "canUnlock": false,      // 是否还处在"订阅状态不可信"状态（可手动解锁的资格）
  "manualUnlock": false,   // 用户是否已经手动解锁过
  "busy": false, "busyTask": "",   // busyTask ∈ ""/"scan"/"unsubscribe"/"delete"/"resubscribe"
  "connectError": "",      // 最近一次 Steam 连接失败原因
  "warnings": ["…"],       // 需要展示的警告（每条一行）
  "permanent": false,      // 当前是否"彻底删除"模式
  "thumbSize": [192, 108]  // 缩略图像素尺寸，前端据此定宽高比
}
```

### 2.4 `unlock()`

用户在界面上**二次确认**「Steam 里已全部退订」后调用，解除只读锁定（in-memory，仅本次运行有效）。
即使当前没被锁也安全（返回 `blocked:false`）。事件 `unlocked`。

> 前端必须先弹确认框（原文见旧版 tkinter 版提示语），确认后再调；不要静默调用。

### 2.5 `get_thumb(wid)`

单张缩略图。`data` 是可直接塞进 `<img src>` 的 JPEG dataURL
（`data:image/jpeg;base64,...`，192×108，JPEG 质量 78，**约 4–8 KB**）；
取不到（未知 ID / 无 preview / 坏图）时 `data` 为 `""`，前端显示占位图即可。
同一次扫描内会缓存，重复调用走缓存。

### 2.6 `get_thumbs(wids)`

批量版，**前端应按当前页调用一次**。返回 `{"thumbs": {wid: dataURL}}`，
请求里每个 wid 都会有键（取不到的值为 `""`）。参数容错：传字符串会被当成单个 wid。

### 2.7 `open_preview(wid)`

用系统默认程序打开该壁纸的素材文件（等同旧版「▶ 预览」），视频交给默认播放器。
成功 `{"ok": true, "path": "..."}`；目录里没有可播放/查看的文件 → `error:"nofile"`。

### 2.8 `open_url(wid)`

用系统浏览器打开 Steam 工坊页面。**别用 `<a href>`**：pywebview 会让链接把界面顶掉，
所以走这个接口。成功返回 `{"ok": true, "url": "..."}`。

### 2.9 `unsubscribe(wids, clean=false)`

退订选中的**订阅中**壁纸；`clean=true` 时顺带清理本地文件（= 旧版「⚡ 退订并清理」），
`clean=false` 时交给 Steam 自己后台删（= 旧版「退订选中」）。

- 只处理 `subscribed=true` 的项；其余静默跳过。没有任何合格项 → `error:"empty"`。
- 进入前检查只读锁定：被锁 → `error:"blocked"`（**服务端也会拦**，不只是按钮禁用）。
- 结果事件 `unsubDone`（§3.6）：`patched` 是增量补丁（§4.2），前端按 `wid` 就地更新/移除卡片。
  **失败项在 `patched` 里保持原值**（仍是订阅中，序号不变），前端覆盖回去即可。
- `clean=true` 时清理**失败**的文件被占用（Steam 还拿着句柄）不算任务失败，
  在 `cleanFails` 里列出，前端提示「稍后可用『删除选中』再清」。
- **状态与历史的写入规则**：只有**真正退订成功**的项才会
  ①被标成未订阅（`subscribed=false, subIndex=-1`）②写进历史（因此之后能一键恢复订阅）。
  失败项保持订阅中原样；`error` 非空（Steam 连不上，整批都没执行）时**任何 item 状态都不改、历史不写**。

### 2.10 `delete(wids)`

删除选中的**未订阅**残留（默认进回收站，除非 `set_permanent(true)`）。
订阅中的项静默跳过；没有合格项 → `error:"empty"`；被锁 → `error:"blocked"`。
结果事件 `delDone`（§3.7），`patched` 里成功删除的项 `removed=true`。
**只有真正删掉的**才写入历史（可在历史里恢复订阅）。

### 2.11 `history()`

退订/删除历史（读 `%LOCALAPPDATA%\WECleaner\history.json`），每次调用都重新读盘。

```jsonc
{"items": [
  {"wid": "1234", "title": "…", "size": 12345678, "sizeText": "11.77 MB",
   "ts": 1712345678, "date": "24-04-05 12:30",
   "action": "unsubscribe" | "delete",   // unsubscribe=退订，delete=删除
   "actionText": "退订" | "删除",
   "url": "https://steamcommunity.com/sharedfiles/filedetails/?id=1234"}
], "count": 3}
```
数组按 `ts` **倒序**（新→旧）。

### 2.12 `resubscribe(wids)`

按历史记录重新订阅（Steam 会自动重新下载）。不在历史里的 wid 静默跳过，全都不在 → `error:"empty"`。
**不受只读锁定限制**（它只增不减，不会删东西）。
结果事件 `resubDone`（§3.8）：`confirmed` 是「调用前后差分确认真的进了订阅列表」的 wid，
可能为空（这时提示用户去 Steam 里确认，可能是磁盘空间不足）。事件里附带刷新后的 `history` 数组。

### 2.13 `set_permanent(value)`

切换「彻底删除」（`true` = 直接删，不进回收站，**不可恢复**）。默认 `false`。
前端在复选框 `change` 时调用；`delete` 是在**发起时**读取该值的（返回里带 `permanent` 回显）。

---

## 3. 事件

所有事件都是 `{"event": "<名字>", ...}`。`busy` / `unlocked` / `syncDone` / `taskError`
**不专属某个任务**，其余事件只在对应任务里出现。

### 3.1 `busy`
```jsonc
{"event": "busy", "value": true, "task": "scan"}   // task ∈ ""|"scan"|"unsubscribe"|"delete"|"resubscribe"
```
长任务进入/退出。`value:true` 时前端应禁用「重新扫描 / 退订 / 删除」，显示进度文案。
退出事件（`value:false`）一定是该任务事件流的**最后一条**。

### 3.2 `scanProgress`
```jsonc
{"event": "scanProgress", "done": 37, "total": 152, "percent": 24, "wid": "1234", "title": "…（截断 24 字）"}
```
每测完一个文件夹推一次（扫描是 8 线程并发测大小，`done` 会顺带乱序到达，只用于进度）。

### 3.3 `scanDone`
```jsonc
{"event": "scanDone",
 "items": [ /* §4.1，全量，按大小降序 */ ],
 "count": 152, "subscribed": 148, "unsubscribed": 4, "totalSize": 1234, "totalSizeText": "11.49 GB",
 "pending": 3,            // Steam 里已订阅、但磁盘上还没有（正在下载）的数量
 "source": "steam_api",   // "steam_api" | "acf" | ""
 "blocked": false,        // 是否只读锁定（= canUnlock && !manualUnlock）
 "canUnlock": false,      // 订阅状态是否不可信（true 时前端必须显示"解锁"逃生门）
 "manualUnlock": false,   // 用户是否已手动解锁
 "connectError": "",      // 非空 = Steam 接口没连上，直接展示给用户
 "warnings": ["…"],       // 每条一行，前面自己加 "⚠ "
 "running": ["wallpaper64.exe"]}   // 检测到的相关进程（Steam/WE 开着会影响清理）
```

### 3.4 `syncDone`
```jsonc
{"event": "syncDone", "connected": true, "error": "",
 "changed": [{"wid": "1234", "subscribed": true, "subIndex": 0}],  // 只含变化的项，前端就地打补丁
 "changedCount": 1,
 "pending": 3,          // 新订阅但还没下载好的数量
 "autoUnlocked": false, // true = 因 Steam 接口确认而自动解除锁定（提示一下）
 "blocked": false, "canUnlock": false,
 "count": 152, "subscribed": 148, "unsubscribed": 4, "totalSize": 1234, "totalSizeText": "11.49 GB"}
```
`connected=false` 时 `changed` 为空数组，`error` 是失败原因；前端不要因此清空列表。

### 3.5 `opProgress`
```jsonc
{"event": "opProgress", "task": "unsubscribe"|"delete"|"resubscribe",
 "done": 3, "total": 12, "wid": "1234", "text": "正在退订 3/12：…"}
```
`text` 是给人看的一句话，直接显示即可；`done/total` 用来画进度条。

### 3.6 `unsubDone`
```jsonc
{"event": "unsubDone",
 "ok": 11, "fail": 1,
 "fails": ["1234", "5678（错误原因）"],   // 展示用文本，最多 10 条
 "failIds": ["1234", "5678"],            // 机器可读的失败 ID，全部
 "clean": true, "cleaned": 10, "freed": 12345678, "freedText": "11.77 MB",
 "cleanFails": ["9999"],                 // 清理失败（文件被占用）的 ID，最多 10 条
 "error": "",                            // 非空 = Steam 连不上，整批都没执行
 "requested": ["1234", "…"],             // 本次请求的 ID
 "patched": [ /* §4.2，前端据此更新列表 */ ],
 "count": 141, "subscribed": 137, "unsubscribed": 4, "totalSize": 1234, "totalSizeText": "…"}
```
`count/subscribed/...` 是**执行后**的统计。`error` 非空时 `ok=0, fail=len(requested)`，
`patched` 里失败项字段保持原值、item 状态与历史都没被改动。

### 3.7 `delDone`
```jsonc
{"event": "delDone",
 "freed": 12345678, "freedText": "11.77 MB",
 "permanent": false,                     // 回显本次用的删除方式
 "fails": ["1234（错误原因）"], "failIds": ["1234"],
 "requested": ["1234", "…"],
 "patched": [ /* §4.2，成功项 removed=true */ ],
 "count": 141, "subscribed": 141, "unsubscribed": 0, "totalSize": 0, "totalSizeText": "0 B"}
```

### 3.8 `resubDone`
```jsonc
{"event": "resubDone", "ok": 3, "fail": 0, "error": "",
 "confirmed": ["1234"],          // 前后差分确认已进入订阅列表的 ID（可能为空）
 "requested": ["1234", "5678"],
 "history": [ /* §2.11 的 items，已剔除恢复成功的项 */ ]}
```

### 3.9 `unlocked`
```jsonc
{"event": "unlocked", "blocked": false, "canUnlock": true}
```

### 3.10 `taskError`
```jsonc
{"event": "taskError", "task": "scan", "message": "RuntimeError: …"}
```
任务线程内部崩了（正常情况下不该出现）。收到后提示用户「内部错误，可重新扫描」，
**并且**随后的 `busy(false)` 会把按钮恢复，不需要前端自己解卡。

---

## 4. 字段定义

### 4.1 item（`scanDone.items[]` / `get_state().items[]`）

| 字段 | 类型 | 含义 |
|---|---|---|
| `wid` | string | 创意工坊 ID（纯数字字符串，别转 number，会丢精度） |
| `title` | string | 标题（读壁纸目录里 `project.json` 的 title，离线可用；缺失时回退成 wid） |
| `size` | int | 目录字节数；**`-1` 表示大小未知**（Steam 正在写入/删除，本次没测完） |
| `sizeText` | string | 已格式化的大小；`size<0` 时固定是 `"⏳ 变化中"` |
| `timeUpdated` | int | 本地安装/更新时间，unix 秒；`0` = 未知（下载中） |
| `date` | string | `timeUpdated` 的展示形式 `%y-%m-%d`；`timeUpdated=0` 时固定是 `"下载中"` |
| `subscribed` | bool | 是否订阅中（来自 Steam 接口；接口不可用时退化为本地记录，见 §5） |
| `subIndex` | int | **订阅顺序，0 = 最新订阅**（与 Steam/Wallpaper Engine 列表序号一致，展示成 `#subIndex+1`）；`-1` = 未订阅（或订阅真值不可信） |
| `url` | string | Steam 工坊页地址（优先用 `open_url(wid)` 打开，别用 `<a href>`） |

`subIndex` 的语义细节：它来自 `steamapi.get_subscribed_ordered()` 返回列表的下标，
即「按订阅时间倒序」的序号，和 WE 界面里的排列一致。**只有 `subscribed=true` 时才有意义**；
排序时 `subIndex=-1` 的项建议统一排到末尾（旧版就是这么做的）。

### 4.2 patch（`unsubDone.patched` / `delDone.patched`）

```jsonc
{"wid": "1234", "subscribed": false, "subIndex": -1,
 "timeUpdated": 1712345678, "date": "24-04-05", "removed": false}
```
前端处理规则：按 `wid` 找到卡片 →
`removed=true` 就**从列表里删掉**；否则用 `subscribed / subIndex / timeUpdated / date` 覆盖。
（`unsubDone` 不带 `clean` 时 `removed` 恒为 `false`，卡片应变成「未订阅」；
`clean=true` 且清理成功的项以及 `delDone` 的成功项 `removed=true`。）

---

## 5. 只读锁定与手动解锁

**为什么**：Wallpaper Engine 的本地订阅记录（`appworkshop_431960.acf`）有时长期缺少
`WorkshopItemsSubscribed` 字段。此时如果照常把「磁盘上有、记录里没有」的目录当残留删掉，
会**误删用户仍在订阅的壁纸**。宁可扫不出来，不可误删。

**何时锁**：`core.scan()` 在「拿不到任何订阅真值」时置 `deletion_blocked`（`scanDone.canUnlock=true`）。
此时：

- `scanDone.blocked=true`，`unsubscribe` / `delete` 一律返回 `{"error":"blocked"}`（服务端也拦）。
- 前端要：禁用「退订选中 / ⚡ 退订并清理 / 删除选中 / 全选 / 全不选」，把 `warnings` 全列出来，
  并显示「🔓 我确认 Steam 里已全部退订，解锁清理」按钮。
- **自动解锁**：只要 `sync()` 从 Steam 接口拿到了权威列表（`subscribed_source="steam_api"`），
  锁定立即解除（`syncDone.autoUnlocked=true`），`canUnlock` 变回 `false`。前端提示即可。
- **手动解锁**：`unlock()`。前端必须先弹确认框（大意：请确认你已经在 Steam/WE 里退订了全部壁纸，
  当前列表内容全部不再需要；解锁后删除默认进回收站、可反悔），确认后再调。

前端渲染逻辑：

```
busy        → 所有操作按钮禁用 + 进度文案
blocked     → 只读：破坏性按钮禁用 + 警告条 + 解锁按钮（confirm 之后 unlock()）
其他        → 按选中项启用：退订类按钮看"选中的里有订阅中的"，删除按钮看"选中的里有未订阅的"
```

---

## 6. 错误语义

失败返回统一形状 `{"error": <码>, "message": <中文>}`，前端按 `error` 分支、`message` 直接展示。

| 码 | 含义 | 触发点 |
|---|---|---|
| `busy` | 已有长任务在跑 | `scan` / `unsubscribe` / `delete` / `resubscribe` |
| `blocked` | 只读锁定（§5） | `unsubscribe` / `delete` |
| `empty` | 没有符合条件的目标 | `unsubscribe`（没有订阅中的）/ `delete`（没有未订阅的）/ `resubscribe`（不在历史里） |
| `unknown` | 未知壁纸 ID | `open_preview` / `open_url` |
| `nofile` | 目录里没有可播放/查看的文件 | `open_preview` |
| `open` | 交给系统打开失败 | `open_preview` / `open_url` |

不写成 `error` 的「非致命情况」：
- `sync()` 忙时 `{"skipped":"busy"|"inflight"}`；
- 任务事件里的 `error` 字段（如 `unsubDone.error`）——**那是任务级别的失败原因，不是调用失败**；
- `taskError` 事件——后台线程崩了，已自动恢复 busy。

---

## 7. 推荐调用时序

```
pywebviewready
  ├─ get_state()            # 恢复快照（F5 后尤其重要）
  ├─ scan()                 # 启动即扫一次
  ├─ setInterval(sync, 5000)   # 5 秒对一次账；返回 skipped 就忽略；busy 时不发也行
  └─ 等 busy(true) → scanProgress… → scanDone → busy(false)

当前页变化 → get_thumbs(pageWids) → 填 <img src>
单击卡片   → 前端自己维护选中集合（Python 侧不管勾选状态）
退订       → confirm 后 unsubscribe(wids, clean?) → 等 unsubDone.patched
删除       → confirm 后 delete(wids) → 等 delDone.patched
历史       → history() → 选 → confirm → resubscribe(wids) → 等 resubDone（内含新 history）
```

---

## 8. Python 侧测试钩子（不是 JS API）

- `bridge.Api(on_event=callable)`：给一个回调就能在 Python 里采到全部事件 dict
  （冒烟测试用；JS 端不需要关心）。
- `api._window = None`（默认）时所有事件推送安全降级为 no-op —— 无窗口跑扫描不会炸。
  **注意属性名是私有的**：`app.py` 用 `api._window = window` 注入。别把它改成公开属性
  `api.window`——pywebview 注入 js_api 时会遍历公开属性、对带 `__module__` 的非方法对象
  递归展开，从而把 `pywebview.Window` 的方法（`evaluate_js`/`destroy`/…）也暴露到
  `window.pywebview.api.window.*`，还会在非 UI 线程碰 COM 刷一屏错误。
- `bridge.item_dict(item)` / `bridge.patch_dict(item, removed)`：字段映射的唯一出处，
  改字段只改这两个函数 + 本文件。
- 扫描/退订等写操作对 Steam 的影响等同旧版 tkinter 界面（退订用 ISteamUGC 官方接口）。

---

## 附录 A：PyInstaller 打包（onefile + webui + pywebview）

```bat
:: cmd.exe（注意 --add-data 用 ";" 分隔；Git Bash 下要改成 "webui:webui"）
.venv\Scripts\pyinstaller.exe --noconfirm --clean --onefile --windowed ^
  --name WECleaner ^
  --add-data "webui;webui" ^
  --collect-all webview ^
  --hidden-import webview.platforms.winforms ^
  app.py
```

要点（都已在本机 .venv 里核实过）：

1. **打包入口用 `app.py`**，不要用 `run.py`：`app.py` 只依赖 pywebview + PIL + send2trash，
   不会把 customtkinter / tkinter 拖进包里（能省一大截体积）。要保留命令行版另说。
2. `--add-data "webui;webui"` 把整个前端目录塞进包；`app.py` 的 `resource_path()`
   在 frozen 状态下自动改用 `sys._MEIPASS`，所以路径不用改。
3. pywebview 的打包细节：官方 `pyinstaller-hooks-contrib` 已带 `hook-webview.py`
   （负责收集 `webview/lib` 下的 `Microsoft.Web.WebView2.*.dll`、`WebBrowserInterop.*.dll`
   和 `runtimes/`）以及 `hook-clr.py` / `hook-clr_loader.py`（pythonnet/clr_loader，
   EdgeChromium 后端靠它加载 .NET）。`--collect-all webview` 是保险（把平台后端子模块
   一次性带上），`--hidden-import webview.platforms.winforms` 是显式兜底。
4. 运行环境要求：目标机器需有 **WebView2 Runtime**（Win10/11 一般已随系统或 Edge 安装；
   缺失时 pywebview 会起不来）。
5. `--windowed` 不带控制台；排查问题时改回控制台构建，并设 `WECLEANER_DEBUG=1`
   打开 webview devtools（`app.py` 已接该环境变量）。
6. onefile 首次启动会解包到临时目录，冷启动比 onedir 慢几秒，属正常。
7. 旧的 `WECleaner.spec`（tkinter 版、`collect_all('customtkinter')`、console=True）
   不要直接复用；真要用 spec，把 `Analysis(['app.py'], datas=[('webui', 'webui')])`
   改好、去掉 customtkinter 的 collect，并保持上述 collect 项。
