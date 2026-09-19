# 我的日记 (Diary App)

一个离线优先的日记 PWA（中文界面），UI 还原「水晶玻璃」设计稿（见 `diary-figma/design/DESIGN.md`）。
四个页面：日记（时间线 + 今日感悟）、待办（做完封存）、番茄钟（标签计时 + 投入统计）、导出/设置（二级页）。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Vue 3 + TypeScript + Vite 5 |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| 本地存储 | SQLite (PowerSync WASM) |
| 云端同步 | Supabase (PostgreSQL + Auth) + PowerSync |
| 天气 | 高德天气 API + 天地图逆地理编码 |
| PWA | vite-plugin-pwa (Workbox) |

## 架构

```
Browser (PWA)
├── Vue 3 UI（水晶玻璃设计稿还原）
├── Pinia Stores (diary / auth / pomodoro)
└── PowerSync (本地 SQLite via WASM)
      ↕ 自动实时同步
Supabase (PostgreSQL + RLS + GitHub OAuth)
```

- **离线优先**：所有读写操作直接访问本地 SQLite，无网络延迟
- **自动同步**：PowerSync 在后台处理双向同步与冲突解决
- **数据安全**：Supabase RLS 确保用户只能访问自己的数据

## 本地开发

```bash
# 安装依赖
npm install

# 复制环境变量模板并填写
cp .env.example .env

# 启动开发服务器
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |
| `VITE_POWERSYNC_URL` | PowerSync 同步端点 URL |
| `VITE_TIANDITU_TK` | 天地图逆地理编码 API Key |
| `VITE_AMAP_KEY` | 高德天气 + IP 定位 API Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key（仅用于迁移脚本） |

## 脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 构建 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 运行 Vitest |
| `npm run deploy` | 交互式部署脚本（提交 + 推送，触发 CI） |
| `node scripts/migrate-data.mjs` | 旧 entries 表迁移到三表结构 |
| `node scripts/sync-to-diary.mjs` | Supabase 数据同步到本地 Markdown 文件 |

## 部署

**CI/CD**：推送 `main` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages。

**手动部署**：运行 `npm run deploy`，脚本会自动 typecheck + build + commit + push。

## 项目结构

```
src/
├── main.ts                 # 应用入口
├── App.vue                 # 外壳：Tab 栏 / FAB / 更多菜单 / navbar / subbar / 全局浮层
├── types.ts                # 共享 TypeScript 类型
├── router/                 # Vue Router（diary/todo/pomodoro + 二级 export/settings）
├── db/                     # 数据层（本次改造未动）
│   ├── powersync.ts        # PowerSync 连接器 + 同步
│   ├── schema.ts           # 本地 SQLite Schema（records / reflections / modules）
│   └── supabase.ts         # Supabase 客户端
├── stores/
│   ├── diary.ts            # 核心 store：currentDate 全局日期 + records/reflections/modules CRUD
│   ├── pomodoro.ts         # 番茄钟状态机（idle/focus/break/done）+ 写库 + 刷新恢复
│   └── auth.ts             # 认证状态（GitHub OAuth）
├── shell/                  # 外壳部件
│   ├── bus.ts              # 页面 ↔ 外壳轻量总线（浮层开关 / FAB 分流）
│   ├── TabBar.vue          # 悬浮 4 格 + 滑动药丸
│   ├── Fab.vue             # 记一笔悬浮球（点按按页分流，长按进感悟）
│   ├── MoreMenu.vue        # 更多菜单（导出 / 设置）
│   └── useLongPress.ts     # 长按手势（待办行 / 日记条目共用）
├── components/
│   ├── CalendarSheet.vue   # 日历浮层（青点 = 有记录，未来禁选）
│   ├── QuickNoteSheet.vue  # 快速记一笔（行首时间识别 + 实时徽章）
│   ├── ReflectEditor.vue   # 感悟全屏富文本编辑器（自动保存）
│   └── LongMenu.vue        # 长按玻璃菜单（编辑 / 删除）
├── views/
│   ├── DiaryView.vue       # 日记页（大标题入口 + 天气胶囊 + 时间线 + 感悟卡片三态）
│   ├── TodoView.vue        # 待办页（封存四拍 + 归档 + 撤销 + 长按菜单）
│   ├── PomodoroView.vue    # 番茄钟页（圆环 + 标签 chips + 到点三选一 + 统计弹层）
│   ├── ExportView.vue      # 二级：导出 / 导入
│   ├── SettingsView.vue    # 二级：设置
│   └── LoginView.vue       # 登录页
├── utils/
│   ├── date.ts / weather.ts / exporter.ts / notify.ts / toast.ts / moduleData.ts
│   ├── theme.ts            # 主题三态（跟随系统 / 浅色 / 深色）
│   ├── richText.ts         # 感悟富文本净化 / 预览
│   └── pomodoro.ts         # 标签存取 / 统计聚合 / 格式化
└── styles/                 # 全局样式（main.css 为 @import 入口，顺序即层叠顺序）
    ├── glass-base.css      # 设计变量 / 深浅主题 / 玻璃材质 / 骨架
    ├── glass-diary|calendar|todo|pomodoro|more|shell|overlays.css
    └── glass-app.css       # 登录页 / 日记条目编辑等设计稿之外的补齐
```

## 功能模块

- **日记**：时间线记录、快速批量添加（行首时间识别）、今日感悟富文本、天气自动获取
- **待办**：添加 / 封存（四拍动画）/ 归档 / 「再来一条」/ 删除撤销
- **番茄钟**：标签计时、到点三选一（开始休息 / +5 分钟 / 结束）、按标签投入统计
- **导出 / 设置**：JSON 导出导入（合并模式）、云同步状态、主题三态、打卡提醒（本地）

## 已知限制

- 打卡提醒目前只保存本地配置，未接系统推送
- 感悟富文本使用 `document.execCommand`（已废弃 API），后续可换实现（已收口在 `richText.ts`）
