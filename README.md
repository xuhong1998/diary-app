# 我的日记 (Diary App)

一个 iOS 风格的离线优先日记应用，支持实时云同步、天气记录、待办管理和算法刷题追踪。

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
├── Vue 3 UI (iOS 风格自定义组件)
├── Pinia Stores (diary / auth / modules)
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
| `npm run test` | 运行 Vitest 测试 |
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
├── App.vue                 # 根布局 (导航栏、抽屉、Toast)
├── types.ts                # 共享 TypeScript 类型
├── router/                 # Vue Router 路由配置
├── db/                     # 数据层
│   ├── powersync.ts        # PowerSync 连接器 + 同步
│   ├── schema.ts           # 本地 SQLite Schema
│   ├── migration.sql       # PostgreSQL 迁移 + RLS 策略
│   └── supabase.ts         # Supabase 客户端
├── stores/                 # Pinia 状态管理
│   ├── diary.ts            # 日记 CRUD
│   ├── auth.ts             # 认证状态
│   └── modules.ts          # 模块开关
├── modules/                # 功能模块
│   ├── diary/              # 日记主界面
│   ├── todo/               # 待办管理
│   └── algorithm/          # 算法刷题追踪
├── views/                  # 页面视图
├── utils/                  # 工具函数
│   ├── weather.ts          # 天气 + 定位
│   ├── exporter.ts         # JSON 导出
│   ├── theme.ts            # 深色模式
│   └── toast.ts            # 全局 Toast
└── styles/                 # 全局样式（main.css 为 @import 入口）
    ├── tokens.css          # 设计变量（浅色/深色）
    ├── base.css            # reset / 应用布局
    ├── nav.css             # 顶部导航栏
    ├── ui.css              # 通用组件（列表/按钮/toggle 等）
    ├── drawer.css          # 侧边抽屉
    ├── diary.css           # 日记时间线 / 感悟
    ├── algorithm.css       # 算法页 / 题目卡片
    ├── sheet.css           # 底部弹窗
    ├── login.css           # 登录页
    ├── search.css          # 搜索结果
    └── feedback.css        # toast / banner
```

## 功能模块

- **日记**：时间线记录、快速批量添加、今日感悟、天气自动获取
- **待办**：添加 / 完成 / 删除，完成率统计
- **算法**：题目记录、难度标签、批量导入、连续打卡统计
- **设置**：模块开关、深色模式、云同步、数据导出
