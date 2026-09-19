# diary-app 界面改造计划 —— 还原「水晶玻璃」设计稿

> 依据：`diary-figma/design/DESIGN.md`（由设计稿 index.html + css + js 归纳）
> 对象：`/Users/xuhong/individual/diary-app`（Vue 3 + TS + Pinia + Vue Router + PowerSync）
> 原则：**UI 完全还原设计稿；数据接入层不动；多余功能删除**

---

## 0. 总原则与边界

### 不动的部分（数据接入层）

| 层 | 文件 | 说明 |
|---|---|---|
| 同步 | `src/db/powersync.ts`、`src/db/supabase.ts` | 连接器 / BackendConnector / 上传重试，原样保留 |
| Schema | `src/db/schema.ts`、`schema.sql`、`migration.sql` | 三表（records / reflections / modules）不变，无迁移 |
| 核心 store | `src/stores/diary.ts` | `loadEntry / addRecord / updateRecord / deleteRecord / updateReflection / updateModuleData / getDateList` 全部原样 |
| 番茄钟写库 | `src/stores/pomodoro.ts` 中 `recordFocusSession` 及其 blob 结构 | 仍写 `modules` 表 `(date,'pomodoro')` → `{sessions:[…]}`，字段不改 |
| 认证 | `src/stores/auth.ts` | GitHub OAuth 流程不动 |
| 入口装配 | `src/main.ts` | auth.init → connectPowerSync → 挂载，不动 |
| 导出/导入实现 | `src/utils/exporter.ts` | v1 schema（含 moduleData）保留，向后兼容旧备份互导 |
| PWA / CI / 部署 | `vite.config.ts`、`.github/`、`scripts/deploy.mjs` | 不动 |
| 历史数据 | 库中 `checkin` / `algorithm` / `interview` 的 blob | **留在库里不删不改**（只是不再有 UI 展示），保证可回退 |

### 完全还原的部分（UI）

设计稿的全部视觉与交互：玻璃材质（blur 44 / sat 210% / 边缘高光）、环境光底、
悬浮 4 格 Tab + 滑动药丸、独立「记一笔」FAB（点按/长按分流）、大标题 + 滚动浮现 navbar、
二级页 subbar、底部弹层 / 全屏感悟编辑器 / 日历浮层、待办封存四拍 + 归档 + 撤销条 +
长按菜单、番茄钟圆环状态机 + 统计弹层、导出 / 设置分组列表、深浅双主题 + 跟随系统。

设计稿审查发现的 3 个 bug（navbar 副标不随页、navbar 标题跨页开日历、主题按钮循环指针
不同步）**实现时直接做对**，不照抄。

### 明确不做设计稿中的「原型专属」元素

- `.phone` 手机外框与左上角版本徽标 `.badge` —— 真实 app 直接全屏布局
  （以设计稿 `@media (max-width:520px)` 那套为基准做全屏适配）。
- mock 数据（diary-data.js / 种子待办 / 番茄钟 seed）—— 一律走真实数据库。
- 双击圆环快进到剩 3 秒（演示手势）。
- `window.__pm` / `__tdTodo` 全局接口 —— 改用 Pinia / 组件事件，不搬。

---

## 1. 功能增删总表

### 1.1 删除（UI 与代码，数据留存）

| 功能 | 涉及文件 | 处置 |
|---|---|---|
| 算法模块 | `modules/algorithm/Component.vue`、`views/AlgorithmView.vue`、`styles/algorithm.css`、路由、types 中 `AlgorithmProblem` | 删 |
| 面试题模块 | `modules/interview/*`、`views/InterviewView.vue`、`styles/interview.css`、`utils/review.ts`（仅保留 `addDays`，被 `utils/pomodoro.ts` 引用，可将 `addDays` 移入 `utils/date.ts` 后整体删除）、相关测试 | 删 |
| 每日打卡 | `modules/todo/useCheckin.ts`、`checkinKey.ts`、`sections/Checkin*.vue`、`utils/checkin.ts(.test)`、`styles/checkin.css`、types 中 `Checkin*` | 删 |
| 搜索页 | `views/SearchView.vue`、`styles/search.css`、路由 `/search` | 删（`diary.searchRecords` 保留在 store，属数据层） |
| 模块开关体系 | `stores/modules.ts`、`modules/registry.ts`、`modules/types.ts`、设置页「模块管理」开关 | 删（设计稿：三模块皆核心，Tab 固定 4 格，无开关） |
| 抽屉导航 | `App.vue` 的 drawer、`styles/drawer.css`、`styles/nav.css` 顶栏 | 删（换成 Tab 栏 + navbar/subbar） |
| 待办完成率页头 | `utils/todoProgress.ts(.test)`（依赖 checkin 的合并进度） | 删 |
| 待办/番茄钟「关联待办」 | pomodoro store 的 `setTodo`、`todoId/todoText` UI | UI 删除（设计稿：番茄只挂标签不挂待办）；session 写库时 `todoId/todoText` 恒为 `undefined`，**字段结构不变** |
| 旧 ui.css 体系 | `styles/ui.css`、`feedback.css`（重写）、`base.css`（重写） | 按新设计稿样式体系替换 |

### 1.2 保留并改造

| 功能 | 现状 | 改造为 |
|---|---|---|
| 日记 | DiaryView：左右箭头翻日 + 隐藏 date input + textarea 感悟 | 大标题即日历入口 + 玻璃日历浮层 + 天气胶囊 + 时间线分桶 + 感悟卡片三态 + 全屏富文本编辑器 |
| 快速记一笔 | textarea 批量录入 | 玻璃弹层 + contenteditable 实时徽章（时间识别逻辑已有 `normalizeTime`，可复用） |
| 待办 | 三 Tab（今日/统计/管理）+ checkin | 单一清单：封存四拍 + 已完成归档折叠区 + 空态两态 + 撤销条 + 长按菜单 + 新建弹层（含「再来一次」历史建议） |
| 番茄钟 | 3 固定模式 + 长休 + 关联待办 + 统计 Tab | 标签体系（emoji/颜色/时长，可新建）+ 到点三选一 + 全局 5 分钟短休 + 「查看统计」弹层（今天/本周/累计按标签聚合） |
| 导出 | 三段 + 范围 + 导入 | UI 按设计稿（分组、ex-seg、**汇总行实时算**、渐变大按钮、提示条）；schema 仍用 v1 |
| 设置 | 模块开关 + 深色 toggle | 同步横幅 + 云同步两态 + 模块三行「核心」徽章 + **打卡提醒 7 项（占位，见 §4.5）** + 主题三段 + 关于 + 页脚 |
| 登录 | LoginView（public 页） | 保留功能，样式套玻璃变量轻改（设计稿无此页稿，不强行造） |
| 天气 | 高德 + 天地图，点击刷新 | 数据逻辑不动；展示收敛为设计稿的天气胶囊一行（emoji + 温度 + 城市 + 湿度） |

### 1.3 新增

- FAB 长按 0.4s 进感悟编辑器（仅日记页）；待办/番茄钟页 FAB 变「新建待办 / 新建标签」。
- 主题三态：跟随系统 → 浅色 → 深色（`matchMedia` 监听 + `data-theme`），右上角球按钮与设置页三段互跟。
- 更多菜单（导出 / 设置）：`moreBtn` 弹出玻璃菜单，替代原抽屉入口。
- 待办「再来一次」建议列表：数据来自当日 blob ∪ 近几天 blob 的历史条目（查询走 `powerSyncDb`，只读，不改写库方式）。

---

## 2. 数据映射（UI ↔ 现有数据层）

### 2.1 日记 —— 直接对齐，零改动

- 时间线：`store.groupedRecords`（morning/afternoon/evening）↔ 设计稿「上午/下午/晚上」三桶，天然一致。
- 空日期：`loadEntry` 返回空 records ↔ `.tl-void` 空态；天气照常展示（真实天气 API 本来就有）。
- 日历青点：`store.getDateList()`（records ∪ 非空感悟 ∪ modules 的 DISTINCT date）↔ 设计稿 `hasContent`，直接用它点亮 `.cal-d.has`。
- 未来日期禁选：UI 层比 `date > todayStr()`，与现有 nextDay 上限一致。

### 2.2 感悟富文本

- 现状 `reflections.text` 存纯文本；设计稿存 HTML（p/ul/blockquote/b）。
- **决策**：`text` 字段改存 HTML 字符串 —— 字段与写库调用（`updateReflection`）不变，schema 不动；
  旧纯文本数据渲染时按纯文本兼容（不含 `<` 即可原样展示，或包一层 `<p>`）。
- 渲染用 `v-html`；内容均为本人输入，原型阶段可接受，导入/展示前做一次 HTML 白名单过滤（见 §6 风险）。
- 导出：沿用现有 exporter（保留原字段）；展示层剥标签取纯文本摘要即可。

### 2.3 待办 blob（`modules` 表 `(date,'todo')` → `{items:[…]}`）

```ts
// 现 TodoItem：{ id, text, done }
// 扩展（向后兼容，旧数据无新字段照常跑）：
interface TodoItem { id: string; text: string; done: boolean; doneAt?: string /* ISO，封存时刻 */ }
```

- 封存 = `done: true + doneAt`，从清单移入「已完成」折叠区（同一 items 数组内两个视图）。
- 归档分组（今天/昨天/M月D日）读 `doneAt`；旧数据无 `doneAt` 归入「更早」。
- 「再来一条」= 把 done 项改回 `done:false` 并清 `doneAt`（现有 toggle 语义的自然延伸）。
- 撤销删除：软删除的是日记 records 的能力；待办在 blob 内，删除即从数组移除 +
  3s 撤销条（内存恢复，写回 blob）。
- 待办页固定渲染「今天」（`loadEntry(todayStr())`），不提供日期切换（设计稿如此）。

### 2.4 番茄钟

- **标签（新增，UI 配置层）**：设计稿 tags（emoji/name/color/min）+ 用户新建，存
  `localStorage`（如 `pomodoro-tags`），带 6 个默认预设。**不入库**，不触碰数据层。
- **session 写库不变**：`PomodoroSession { id, modeId, startedAt, endedAt, seconds, plannedSec, completed, todoId?, todoText? }`
  - `modeId` = 标签 id（旧数据里的 `classic/deep/sprint` 做一次展示层映射兜底：未知 id →
    「• 旧记录」，聚合行仍按时长统计）；
  - 🍅 口径映射：`completed: true` ↔ 🍅×1；提前结束（≥1 分钟）↔ 🍅×0 仅记时长 —— 与设计稿
    「只数完整轮」一致，现有字段直接表达，无需改结构。
- **状态机改造**（`stores/pomodoro.ts`，只动交互编排，不动写库函数）：
  - `focus 完成` 不再自动进入休息 → 停在 `done` 态，给三选一（开始休息 / +5 分钟 / 结束）；
  - `+5 分钟` = 延长 deadline 并重跑（本轮结束时按总时长记账，仍一轮 🍅）；
  - 休息统一全局 5 分钟，去掉 `longBreak` / `breakAfterFocus` / `focusDone` 轮次 UI（类型字段保留不用）；
  - 保留：时间戳计时、暂停/继续、刷新恢复（restore）、跨零点归属开始日、提示音/振动/通知、
    多标签互斥（Web Locks）——这些是正确性设施，与设计稿不冲突；
  - `skip()` 的「结束并休息」拆成设计稿的两个动作：计时中「结束」（≥1min 记时长 🍅0 → idle）
    与 done 态「开始休息」。
- **统计**：复用现有 `loadAll()`（全表读 `module_id='pomodoro'`）+ 新增聚合函数
  `aggByTag(days, from)`：today0 / 周一 / 0 三个起点，按标签倒序，时长 + 🍅（completed 计数）。
  `utils/pomodoro.ts` 中 `pomodoroStats`（streak 等）删除或精简为统计弹层所需。

### 2.5 导出 / 导入

- UI 全按设计稿（三段、日期范围行、**汇总行实时算**、渐变主按钮、ghost 按钮、提示条）。
- 汇总行「N 天 · M 条记录 · K 篇感悟」：导出前按所选范围跑一次 exporter 的查询逻辑取数计算，
  不另开接口。
- **schema 保持 v1**（含 `moduleData`、`exportedAt`）：它是数据接口，改成设计稿的 v3 会让
  旧备份无法导回；此差异点如需对齐设计稿 v3，另行开任务（默认不做）。

---

## 3. 目标代码结构

```
src/
├── App.vue                    # 重写：外壳（tabbar+药丸 / fab / more 菜单 / navbar / subbar / theme-btn / toast）
├── router/index.ts            # 精简：/diary /todo /pomodoro /export /settings /login（/ 其余 301 到对应页）
├── shell/
│   ├── TabBar.vue             # 悬浮 4 格 + 滑动药丸
│   ├── Fab.vue                # 点按/长按分流（emit + route 判断）
│   ├── NavBar.vue             # 滚动浮现的紧凑玻璃导航（仅顶级页）
│   ├── SubBar.vue             # 二级页 ‹ 返回 + 页名
│   └── MoreMenu.vue           # 更多菜单（导出/设置）
├── views/
│   ├── DiaryView.vue          # 日记页（大标题入口 + 天气胶囊 + 时间线 + 感悟卡片）
│   ├── TodoView.vue           # 待办页
│   ├── PomodoroView.vue       # 番茄钟页
│   ├── ExportView.vue         # 二级：导出
│   ├── SettingsView.vue       # 二级：设置
│   └── LoginView.vue          # 保留，轻改样式
├── components/
│   ├── CalendarSheet.vue      # 日历浮层（青点/今天/选中弹出/翻月动画）
│   ├── QuickNoteSheet.vue     # 快速记一笔（contenteditable + 时间徽章）
│   ├── ReflectEditor.vue      # 感悟全屏编辑器（富文本四键工具条）
│   ├── GlassSheet.vue         # 通用底部弹层外壳（grip/自适应高/backdrop）
│   ├── UndoToast.vue          # 撤销条与轻提示
│   └── todo/（TodoSheet / LongPressMenu / DoneBar 等按需拆分）
├── modules/                   # 整个目录删除（registry/types/各模块组件）
├── stores/
│   ├── diary.ts               # 不动
│   ├── pomodoro.ts            # 仅动交互编排（§2.4）
│   ├── auth.ts                # 不动
│   └── modules.ts             # 删除
├── utils/
│   ├── date.ts                # 不动（normalizeTime 给记一笔复用）
│   ├── weather.ts             # 不动
│   ├── exporter.ts            # 不动
│   ├── theme.ts               # 改三态（auto/light/dark + matchMedia）
│   ├── notify.ts / toast.ts / pomodoro.ts / moduleData.ts  # 保留（pomodoro.ts 按需精简）
│   └── richText.ts            # 新增：HTML 白名单过滤 + 块拍平预览
├── types.ts                   # 删 Algorithm/Interview/Checkin 类型；TodoItem +doneAt；其余不动
└── styles/
    ├── main.css               # 重写 @import 清单（顺序即层叠顺序，与设计稿一致）
    ├── glass-base.css         # ← 设计稿 base.css（变量/主题/玻璃/骨架/环境光；去手机框）
    ├── glass-diary.css        # ← diary.css + calendar.css
    ├── glass-todo.css         # ← todo.css
    ├── glass-pomodoro.css     # ← pomodoro.css
    ├── glass-more.css         # ← more.css（设置/导出）
    ├── glass-shell.css        # ← shell.css（tabbar/fab/subbar；全屏适配）
    └── glass-overlays.css     # ← overlays.css（弹层/编辑器/菜单/toast）
```

删除的旧样式：`tokens.css / base.css / nav.css / ui.css / drawer.css / diary.css / algorithm.css /
sheet.css / interview.css / todo.css / checkin.css / pomodoro.css / login.css / search.css / feedback.css`
（login.css 视改造结果保留或并入 glass-more.css）。

> 全局非 scoped 样式沿用设计稿的组织方式；新类名体系（glass-*.css）与组件模板类名一一对应，
> 删除旧 css 后无冲突源。组件 `<template>` 直接使用设计稿类名（`.head .entry .sheet .pm-* .st-*`）。

---

## 4. 实施阶段

### 阶段 0 —— 基线（0.5 天）
- 开分支 `redesign/glass`；确认 `npm run typecheck && npm test` 全绿，记录为基线。
- 给设计稿建本地预览（diary-figma/design/index.html 起静态服务）作对照基准。

### 阶段 1 —— 样式系统替换（0.5 天）
- 移植 7 个 glass-*.css；`:root` 变量与深浅主题块照搬（`--glass-*` / `--bg` / `--accent`…）。
- 全屏适配：以设计稿 520px 媒体查询为基准，桌面端限宽居中（max-width ~520px 的画布即可，
  不画手机框）。
- `utils/theme.ts` 改三态；`color-scheme:dark` 补丁一并带上。
- 验收：深浅主题、玻璃在浅色/深色下的边缘高光正确。

### 阶段 2 —— 应用外壳（1 天）
- 重写 `App.vue`：TabBar（药丸定位用 ref 量宽，等价设计稿 movePill）、Fab（pointer 事件 +
  0.4s 长按，按 route 分流）、MoreMenu、NavBar（scroll > 56px 浮现；仅顶级页；点击开日历仅日记页）、
  SubBar（route.meta.sub === true 时显示，返回用 `router.back()` 等价「记住来源」）、theme-btn
  （二级页隐藏）。
- 路由精简 + meta：`{ sub: true }` 标记二级页；登录守卫不动。
- Toast 迁到设计稿样式（glass-overlays 的 `.toast`）。

### 阶段 3 —— 日记页（2 天，最大的一块）
- DiaryView：大标题（点击开 CalendarSheet）+ 天气胶囊（复用 weather.ts）+ 时间线
  （groupedRecords → 三桶渲染 + 空态）+ 感悟卡片三态（截断 3 行 line-clamp / 展开 / 空白入口）。
- CalendarSheet：getDateList 点亮青点；今天/选中/未来禁选；翻月滑入动画。
- QuickNoteSheet：contenteditable + 实时徽章（复用 `normalizeTime` 识别 `7:10 / 710`）；
  composition 期间不打断；保存 = 逐行 `store.addRecord(text, time)`。
- ReflectEditor：全屏编辑器 + 四键工具条；input 即 `store.updateReflection(html)`（自动保存，
  无保存按钮）；旧纯文本数据兼容渲染；`richText.ts` 白名单过滤。
- 日记条目的编辑/删除：设计稿未给条目级编辑交互 —— 保留现能力但收敛进长按/点条目弹出的
  复用菜单（沿用待办 LongPressMenu 组件模式），不新增设计稿没有的可见 UI。

### 阶段 4 —— 待办页（1.5 天）
- 数据：当日 blob 读写走 `updateModuleData('todo', { items })`（整对象写回，沿用现有模式）；
  `TodoItem` 增 `doneAt?`。
- 清单：封存四拍动画（纯 CSS keyframes 照搬）+ 1050ms 停留 + 收拢消失；封存中再点撤回。
- DoneBar：折叠区 + doneAt 分组 + 「再来一条」；空态两态（alldone / todoempty）。
- 撤销条（3s）+ 长按菜单（编辑/删除，定位与翻转）+ 新建弹层（「再来一次」建议：
  近 7 天 todo blob 只读查询去重，前 6 条，关键词高亮）。

### 阶段 5 —— 番茄钟页（2 天）
- localStorage 标签体系 + 新建标签弹层（名称≤8字/12 emoji/6 色/5 档时长）。
- 圆环 + 状态机改造（§2.4）：done 三选一、全局 5 分钟休息、+5 分钟延长。
- chips（idle）/ 暂停结束（计时中）/ 三选一（done）的 slot 渲染；`--tc` 随标签色。
- 「查看统计」弹层：今天/本周/累计 × 标签聚合（时长 + 🍅）；旧 modeId 兜底映射。
- 更新 `stores/pomodoro.test.ts` 与 `utils/pomodoro.test.ts` 至新口径。

### 阶段 6 —— 导出 / 设置 / 登录（1 天）
- ExportView：UI 还原 + 汇总行实时算；导入逻辑不动（现有合并导入已可用）。
- SettingsView：同步横幅（`auth.configured / isSignedIn / diary.connected` 三态映射设计稿两态
  文案，多一档「未配置」）、云同步两态行、模块三行「核心」徽章、打卡提醒 7 项（见 §4.5）、
  主题三段、关于（`__APP_VERSION__`）、页脚。
- LoginView：玻璃变量轻改。

### 阶段 7 —— 清理与文档（0.5 天）
- 删除 §1.1 清单文件与导出；清 `types.ts`；确认无死引用。
- 更新 `README.md`、`CLAUDE.md`（模块系统一节删除、新结构图、设计文档链接）。
- `npm run typecheck && npm test` 全绿。

### 阶段 8 —— 对照验收（0.5 天）
- 逐页对照 `design/DESIGN.md` §2–§4 走查（玻璃参数、动效时长、z-index 层级、文案口气）。
- 深浅主题 × 顶级/二级页 × 弹层开合矩阵过一遍；移动端真机（PWA）验证 FAB 长按、
  键盘弹出、safe-area。

> 总计约 9.5 个工作日；阶段 3–5 可并行拆分。

---

## 5. 打卡提醒（设置页 7 项）的处理

设计稿有「打卡提醒」总开关 + 7 项时间（起床/早餐/…/睡觉）。现有代码的打卡是另一回事
（checkin 模块，已删）。决策：

- 设置页按设计稿**完整还原 UI**（开关 + 7 行 time 控件）；
- 状态暂存 `localStorage`（`checkin-reminders`），**不接推送**（Web 端无系统推送通道；
  `utils/notify.ts` 现有的 Notification API 可作为后续可选实现：到点本地通知）；
- 在设置页该项副标保留设计稿文案「不点不催，一天过完就翻篇」；
- 这是有意标注的「UI 先行、功能后接」项，写入 README 已知限制。

## 6. 风险与对策

| # | 风险 | 对策 |
|---|---|---|
| 1 | 感悟存 HTML 后，旧纯文本/导入数据渲染异常 | `richText.ts` 统一入口：检测无标签则包 `<p>`；渲染前白名单过滤（p/ul/li/blockquote/b/strong/i/br），防粘贴进来的脚本 |
| 2 | 待办 doneAt 为新增字段，多端旧版本混写丢字段 | 读写都做缺省容错（`doneAt ?? undefined`）；blob 整体写回模式本身已天然以「最后写入为准」 |
| 3 | 番茄钟状态机重写引入回归（补记/恢复/多标签） | 保留 persist/restore/lock 骨架不动，只改 phase 编排；现有测试改口径后必须全绿再进下一阶段 |
| 4 | 全局 CSS 替换期间新旧类名互串 | 阶段 1 一次性删旧 css，旧视图在此阶段会「裸奔」——按阶段顺序接受中间态不可用，不长期共存 |
| 5 | 设计稿移动端假设 vs 桌面浏览器 | 全屏画布限宽居中；FAB 长按在桌面用鼠标按住等价触发（pointer events 天然支持） |
| 6 | 导出 schema 不等于设计稿 v3 | 已决策保留 v1（§2.5），如需对齐另开任务 |
| 7 | `execCommand` 已废弃 | 设计稿同款先上（原型验证过可用）；`richText.ts` 收口解析，后续可换实现而不动 UI |

## 7. 验收清单（摘要）

- [ ] 玻璃材质：blur 44 / sat 210 / 边缘高光，深浅两套主题均正确
- [ ] Tab 4 格 + 滑动药丸；二级页底栏与球下沉、subbar 出现、返回回来源页
- [ ] FAB：日记=记一笔/长按感悟；待办=新建待办；番茄钟=新建标签
- [ ] 日记：日期标题开日历、青点疏密、未来禁选、选完即收；时间线三桶；感悟三态 + 自动保存
- [ ] 待办：四拍封存、撤回、归档折叠、空态两态、撤销 3s、长按菜单、建议列表
- [ ] 番茄钟：标签选中色贯通圆环、到点三选一、+5 分钟不加🍅、统计弹层三段
- [ ] 导出：汇总行实时算、真下载、合并导入 toast
- [ ] 设置：同步横幅三态、主题三段与球按钮互跟
- [ ] `npm run typecheck`、`npm test` 全绿；旧 algorithm/interview/checkin 数据仍在库中可回滚
