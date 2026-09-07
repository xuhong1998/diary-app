# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 项目

离线优先的 iOS 风格日记 PWA（中文界面）。Vue 3 + TypeScript + Vite、Pinia、Vue Router。所有读写均访问本地 SQLite（PowerSync WASM）；PowerSync 与 Supabase（PostgreSQL + Auth）双向同步。部署在 GitHub Pages：https://xuhong1998.github.io/diary-app/。

## 常用命令

- `npm run dev` — 启动开发服务器
- `npm run typecheck` — vue-tsc 类型检查（无独立 linter）
- `npm run build` — 类型检查 + 构建（生产 Pages 构建使用 `BASE_PATH=/diary-app`）
- `npm test` — vitest 运行；单个文件：`npm test -- src/utils/review.test.ts`；监听模式：`npm run test:watch`
- `npm run deploy` — 交互式部署：typecheck + build 后提交所有改动并推送到 `main`（必须在 `main` 分支且工作区有改动）。推送到 `main` 会触发 GitHub Actions 部署；CI 在构建时从仓库 secrets 注入环境变量。

测试与源码同目录存放（`*.test.ts` 在源文件旁边，主要在 `src/utils/`），vitest globals 已启用，jsdom 环境。没有 ESLint/Prettier 配置。

开发需要 `.env`（见 `.env.example`：Supabase、PowerSync、天地图、高德 key）。未配置 PowerSync/Supabase 时应用以纯本地模式运行（`isPowerSyncConfigured()` 兜底）——同步功能静默降级。

## 架构

### 数据流（离线优先）

`src/main.ts` 启动流程：`auth.init()` → `connectPowerSync()` → 挂载应用 + 路由。

- **PowerSync（`src/db/powersync.ts`）是 UI 的唯一数据源**。`BackendConnector.uploadData` 将本地 CRUD 批量上传到 Supabase REST：PUT → `upsert`（冲突列：`reflections` 用 `date`，其余用 `id`），PATCH → `update`，匹配 0 行时自动回退为 `upsert` 自愈，DELETE → `delete`。上传失败会限流弹出 toast 并稍后重试。
- **Schema 存在于三处，必须保持同步**：`src/db/schema.ts`（本地 SQLite 表：`records`、`reflections`、`modules`）、`src/db/schema.sql` 和 `src/db/migration.sql`（Postgres DDL + RLS 策略）。
- **软删除**：`records` 和 `modules` 使用 `deleted_at`；所有查询都过滤 `deleted_at IS NULL`。
- 路由对除 `meta.public` 外的所有页面做登录守卫；认证通过 Supabase 的 GitHub OAuth（`src/stores/auth.ts`）。

### Store（`src/stores/`）

- `diary.ts` — 核心 store。`currentDate` 是所有模块视图共享的全局状态。`loadEntry(date)` 将某日期的记录 + 感悟 + 模块数据加载到 `entry`。模块数据按 `(date, module_id)` 以 JSON blob 形式存入 `modules` 表，通过 `updateModuleData(moduleId, data)` 写入；组件读取 `store.entry.moduleData[id]`，写回时是整个对象（不做部分合并）。
- `modules.ts` — 模块启用/禁用，持久化在 localStorage。通过 "known modules" key，新注册的模块对老用户自动启用。

### 模块系统（`src/modules/`）

功能以可插拔模块的形式注册在 `src/modules/registry.ts`（`builtinModules`）：diary、checkin、todo、algorithm、interview、pomodoro。每个模块结构为 `{ id, name, icon, mdSection, defaultData(), component }`。

**新增模块需要改动以下所有位置：**
1. `src/modules/<id>/Component.vue` — 按 diary store 模式读写（参考 `todo/Component.vue`）；日期导航使用 `store.currentDate` / `store.loadEntry`
2. `src/modules/registry.ts` — 注册模块
3. `src/router/index.ts` — 添加路由
4. `src/views/<X>View.vue` — 渲染模块组件的薄封装
5. `src/styles/<id>.css` 并在 `src/styles/main.css` 中 `@import`（import 有顺序；tokens.css 在最前）
6. 导航入口（App.vue 的抽屉/标签栏遵循 modules store）
7. 模块数据类型放在 `src/types.ts`

共享的间隔复习逻辑（艾宾浩斯间隔、`stage`/`nextReview` 字段）在 `src/utils/review.ts`，被 algorithm 和 interview 模块复用——应扩展它而非重复实现。

### 样式

无 CSS 框架，无 scoped 样式。`src/styles/` 下按功能拆分的全局 CSS，全部由 `main.css` `@import`。设计变量（浅色/深色）在 `tokens.css`。UI 文案全部为中文。

## 其他

- `@` 别名 → `src/`
- PWA 由 vite-plugin-pwa 实现（`registerType: 'autoUpdate'`）；`postbuild` 将 `dist/index.html` 复制为 `dist/404.html` 以支持 Pages 路由
- `scripts/migrate-data.mjs`（旧 entries 表 → 三表结构迁移）和 `scripts/sync-to-diary.mjs`（Supabase → 本地 Markdown）是一次性维护脚本，使用 `SUPABASE_SERVICE_ROLE_KEY`
