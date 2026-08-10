# 日记 App 优化计划

> 基于 2026-08-10 全量代码审查，按优先级分阶段执行。

---

## 阶段一：基础设施补全（🔴 高优先级）

### 1.1 添加 README
- [ ] 项目简介、技术栈、架构图
- [ ] 本地开发步骤 (`npm install` / env 配置 / dev server)
- [ ] 环境变量完整说明（6 个变量）
- [ ] 部署流程说明（CI/CD + 手动 deploy 脚本）
- [ ] 脚本说明 (`migrate-data.mjs`, `sync-to-diary.mjs`, `deploy.mjs`)

### 1.2 补全环境变量声明
- [ ] `env.d.ts` 补充 `VITE_TIANDITU_TK`、`VITE_AMAP_KEY`、`VITE_POWERSYNC_URL`、`SUPABASE_SERVICE_ROLE_KEY`
- [ ] `.env.example` 补全缺失的 2 个变量

### 1.3 添加全局错误处理
- [ ] `main.ts` 添加 `app.config.errorHandler`
- [ ] `stores/diary.ts` 所有 CRUD 方法加 try/catch + toast 提示
- [ ] 统一组件层 catch 逻辑（要么 toast 提示，要么静默 + log，不要混用）

### 1.4 引入测试框架
- [ ] 安装 Vitest + `@vue/test-utils`
- [ ] 添加 `npm run test` / `npm run test:coverage` 脚本
- [ ] 编写核心逻辑测试：
  - [ ] 时间解析 `normalizeTime` / `parseTimeToDate`
  - [ ] 日期工具函数
  - [ ] 算法模块批量导入解析
  - [ ] JSON 序列化/反序列化
  - [ ] Store CRUD（mock PowerSync）

---

## 阶段二：代码质量（🟠 高优先级）

### 2.1 清理无用依赖
- [ ] 删除 `dexie`（已无 import）
- [ ] 删除 `@powersync/vue`（已无 import）
- [ ] 删除 `vite-plugin-mkcert`（未在 vite.config 中使用）
- [ ] **决策 Varlet**：若不迁移则删除 `@varlet/ui` + `@varlet/import-resolver` + `unplugin-vue-components` + vite.config 中的 Varlet 配置；若迁移则按 `.opencode/plans/varlet-migration.md` 执行

### 2.2 抽取公共工具
- [ ] 新建 `src/utils/date.ts`，统一 `formatDate()` / `parseDate()` / `todayStr()`
- [ ] 从 `diary.ts`、`diary/Component.vue`、`algorithm/Component.vue`、`exporter.ts` 中删除重复定义
- [ ] 抽取 JSON parse 逻辑为 `parseModuleData(data): unknown` 公共函数，消除 4 处重复的 `JSON.parse(JSON.parse(...))` hack

### 2.3 修复 JSON 双重编码
- [ ] 排查 module data 写入管道，定位双重 `JSON.stringify` 的位置
- [ ] 从源头修复，移除读取端的 double-parse hack

### 2.4 修复版本号不一致
- [ ] `SettingsView.vue` 从 `package.json` 动态读取版本（通过 Vite 的 `import.meta.env` 或 define 注入）
- [ ] 统一 `package.json` version 为语义化版本

### 2.5 清理调试代码
- [ ] 删除 `LoginView.vue` 中约 30 行注释掉的调试代码
- [ ] 清理 `styles/main.css` 中约 300+ 行无对应组件的废弃 CSS

---

## 阶段三：性能优化（🟠 中高优先级）

### 3.1 修复导出 N+1 查询
- [ ] `exporter.ts` 改为 2 条批量查询（reflections + modules 用 `IN (...)`），替代每日期 2 查询的循环

### 3.2 移除不必要的 deep watcher
- [ ] `todo/Component.vue`：`watch(() => store.entry, ...)` 去掉 `deep: true`（entry 在切换日期时整体替换）
- [ ] `algorithm/Component.vue`：同上

### 3.3 优化算法定统查询
- [ ] `loadStats()` 每次 entry 变化都查全表，改为缓存 + 手动刷新或防抖

---

## 阶段四：功能增强（🟡 中优先级）

### 4.1 搜索功能
- [ ] 全文搜索 records 表 `text` 字段
- [ ] 按日期范围筛选
- [ ] 搜索结果高亮关键词

### 4.2 日历视图
- [ ] 月历组件，有记录的日期高亮显示
- [ ] 点击日期跳转

### 4.3 删除确认 / 撤销
- [ ] 删除记录时弹出确认对话框，或提供 undo toast（5 秒内可撤销）

### 4.4 数据导入
- [ ] 支持导入之前导出的 JSON 文件

### 4.5 日记统计
- [ ] 本月写作天数、总记录数
- [ ] 最常记录的时段分布
- [ ] 写作热力图（类似 GitHub contribution graph）

---

## 阶段五：类型安全 & 代码结构（🟡 中优先级）

### 5.1 减少 `any` 使用
- [ ] `moduleData` 用泛型约束：`Record<string, ModuleData<T>>`
- [ ] `updateModuleData(moduleId, data: T)` 泛型化
- [ ] PowerSync status 定义 interface 替代 `any`
- [ ] `uploadData(database)` 类型化

### 5.2 CSS 模块化
- [ ] 将 `styles/main.css`（1862 行）按组件拆分到各 `.vue` 文件的 `<style scoped>` 中
- [ ] 保留全局变量、reset 在 `main.css` 中

### 5.3 SVG 图标优化
- [ ] 内联 SVG 字符串改为 icon 组件或 SVG sprite
- [ ] 便于 tree-shaking 和维护

---

## 阶段六：安全 & 可访问性（🟢 低优先级）

### 6.1 无障碍
- [ ] 移除 `index.html` 中的 `user-scalable=no, maximum-scale=1.0`
- [ ] 隐藏的 date input 添加 `aria-label`
- [ ] 按钮添加 ARIA 标签
- [ ] 确保键盘可导航

### 6.2 API Key 安全
- [ ] 高德后台配置 referer/域名限制
- [ ] 天地图后台配置域名白名单

---

## 执行建议

| 批次 | 内容 | 预估工作量 |
|------|------|-----------|
| 第 1 批 | 1.1 README + 1.2 env 补全 + 1.4 测试框架搭建 | 1 天 |
| 第 2 批 | 2.1 清理依赖 + 2.2 抽取公共工具 + 2.4 版本号 | 0.5 天 |
| 第 3 批 | 1.3 错误处理 + 2.3 JSON 修复 + 3.1 N+1 修复 | 1 天 |
| 第 4 批 | 3.2 deep watcher + 3.3 算法优化 + 2.5 清理 | 0.5 天 |
| 第 5 批 | 4.1 搜索功能 | 1-2 天 |
| 第 6 批 | 4.2 日历视图 | 1 天 |
| 第 7 批 | 5.1-5.3 类型安全 & 结构重构 | 2-3 天 |
| 第 8 批 | 4.3-4.5 + 6.x 功能增强 & 安全 | 按需 |
