# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 项目

离线优先的日记 PWA（中文界面），UI 还原「水晶玻璃」设计稿（设计稿与设计文档在 `../diary-figma/design/`，设计规格见其中的 `DESIGN.md`）。Vue 3 + TypeScript + Vite、Pinia、Vue Router。所有读写均访问本地 SQLite（PowerSync WASM）；PowerSync 与 Supabase（PostgreSQL + Auth）双向同步。部署在 GitHub Pages：https://xuhong1998.github.io/diary-app/。

## 常用命令

- `npm run dev` — 启动开发服务器
- `npm run typecheck` — vue-tsc 类型检查（无独立 linter）
- `npm run build` — 类型检查 + 构建（生产 Pages 构建使用 `BASE_PATH=/diary-app`）
- `npm test` — vitest 运行；监听模式：`npm run test:watch`
- `npm run deploy` — 交互式部署：typecheck + build 后提交所有改动并推送到 `main`（必须在 `main` 分支且工作区有改动）。推送到 `main` 会触发 GitHub Actions 部署；CI 在构建时从仓库 secrets 注入环境变量。

测试与源码同目录存放（`*.test.ts` 在源文件旁边，主要在 `src/utils/` 与 `src/stores/`），vitest globals 已启用，jsdom 环境。没有 ESLint/Prettier 配置。

开发需要 `.env`（见 `.env.example`：Supabase、PowerSync、天地图、高德 key）。未配置 PowerSync/Supabase 时应用以纯本地模式运行（`isPowerSyncConfigured()` 兜底）——同步功能静默降级。

## 架构

### 数据流（离线优先）

`src/main.ts` 启动流程：`auth.init()` → `connectPowerSync()` → 挂载应用 + 路由。

- **PowerSync（`src/db/powersync.ts`）是 UI 的唯一数据源**。`BackendConnector.uploadData` 将本地 CRUD 批量上传到 Supabase REST：PUT → `upsert`（冲突列：`reflections` 用 `date`，其余用 `id`），PATCH → `update`，匹配 0 行时自动回退为 `upsert` 自愈，DELETE → `delete`。上传失败会限流弹出 toast 并稍后重试。
- **Schema 存在于三处，必须保持同步**：`src/db/schema.ts`（本地 SQLite 表：`records`、`reflections`、`modules`）、`src/db/schema.sql` 和 `src/db/migration.sql`（Postgres DDL + RLS 策略）。
- **软删除**：`records` 和 `modules` 使用 `deleted_at`；所有查询都过滤 `deleted_at IS NULL`。
- 路由对除 `meta.public` 外的所有页面做登录守卫；认证通过 Supabase 的 GitHub OAuth（`src/stores/auth.ts`）。
- **数据接入层已冻结**：db/* 与 stores/diary.ts 的读写方式不要改；UI 改版（见 `docs/UI-REDESIGN-PLAN.md`）只动视图层与交互编排。

### Store（`src/stores/`）

- `diary.ts` — 核心 store。`currentDate` 是所有页面共享的全局日期。`loadEntry(date)` 将某日期的记录 + 感悟 + 模块数据加载到 `entry`。模块数据按 `(date, module_id)` 以 JSON blob 形式存入 `modules` 表，通过 `updateModuleData(moduleId, data)` 写入；组件读取 `store.entry.moduleData[id]`，写回时是整个对象（不做部分合并）。
- `pomodoro.ts` — 番茄钟状态机（idle / focus / break / done）。到点停在 done 给三选一（开始休息 / +5 分钟 / 结束），不自动进休息；休息全局 5 分钟。计时用时间戳（deadline − now），切页/后台/关页不漂；刷新恢复与闭页补记走 localStorage（`pomodoro-timer-state`），多标签互斥用 Web Locks。「+5 分钟」原地改长上一条记录（🍅 不变）；🍅 只数完整轮，提前结束满 1 分钟记时长但 +0。session 仍写 `modules` 表 `(date,'pomodoro')` blob；标签列表是 UI 配置，存 localStorage（`pomodoro-tags`）。
- `auth.ts` — 认证状态（GitHub OAuth）。

### 页面与外壳

- `App.vue` 是外壳：TabBar（悬浮 4 格 + 滑动药丸）、Fab（点按按页面分流：日记=记一笔、待办=新建待办、番茄钟=新建标签；长按 0.4s 进感悟编辑器，仅日记页）、MoreMenu、滚动浮现的 navbar（仅日记页，紧凑标题=日历入口）、二级页 subbar。
- 页面间/页面与外壳的通信走 `src/shell/bus.ts`（浮层开关 + FAB 行为注册），不要新开全局事件。
- 弹层要盖住 Tab 栏的（日历/记一笔/感悟编辑器/长按菜单/番茄钟弹层）用 `<Teleport to="#app-main">` 挂到屏幕层——`.pages` 是 z-index 10 的层叠上下文，页内弹层盖不过 Tab 栏（z 50）。
- 二级页（export / settings）：底栏与球下沉、顶栏 ‹ 返回；返回用 history.back，历史为空回日记。

### 数据约定

- **感悟（reflections.text）存受限 HTML**（p / ul / li / blockquote / b / strong / i / em）。所有渲染前过 `src/utils/richText.ts` 的 `sanitizeRichText`/`ensureRichText`（旧纯文本自动包 `<p>`）；卡片 3 行截断预览用 `previewOf`。
- **待办（todo blob）**：`{ items: [{ id, text, done, doneAt? }] }`。完成 = `done: true + doneAt`（ISO），即进入「已完成」归档区；旧数据缺 `doneAt` 归入「更早」；「再来一条」= 改回 `done:false` 并清 `doneAt`。
- 历史的 checkin / algorithm / interview blob 仍在库中，UI 已下线但数据未删——不要写清理脚本，保证可回滚。

### 样式

无 CSS 框架，无 scoped 样式。`src/styles/` 下全局 CSS，全部由 `main.css` `@import`，**顺序即层叠顺序，与设计稿 `<link>` 顺序一致，不要调换**。设计变量（浅色/深色 + 玻璃参数）在 `glass-base.css`。类名体系来自设计稿（`.pm-*` 番茄钟、`.st-*`/`.ex-*` 设置导出）；UI 改版对照 `../diary-figma/design/DESIGN.md` 的规格（动效曲线、z-index 表、文案口气）。UI 文案全部为中文。

## 其他

- `@` 别名 → `src/`
- PWA 由 vite-plugin-pwa 实现（`registerType: 'autoUpdate'`）；`postbuild` 将 `dist/index.html` 复制为 `dist/404.html` 以支持 Pages 路由
- `scripts/migrate-data.mjs`（旧 entries 表 → 三表结构迁移）和 `scripts/sync-to-diary.mjs`（Supabase → 本地 Markdown）是一次性维护脚本，使用 `SUPABASE_SERVICE_ROLE_KEY`
