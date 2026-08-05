# 引入 Varlet UI 组件库 — 全面迁移计划

> 库选择：**@varlet/ui v3.20.2**（Material Design 3，动画丰富，支持暗色模式）
> 已完成依赖安装：`@varlet/ui`、`unplugin-vue-components`、`@varlet/import-resolver`

---

## 阶段 0：基础配置

### 0.1 vite.config.ts
添加按需引入插件：

```ts
import Components from 'unplugin-vue-components/vite'
import { VarletImportResolver } from '@varlet/import-resolver'

// plugins 数组中 vue() 之后添加：
Components({
  dts: false,
  resolvers: [VarletImportResolver()],
})
```

### 0.2 src/main.ts
引入 Varlet 基础样式（函数式组件 snackbar/dialog 需要）：

```ts
import '@varlet/ui/es/style'
```

### 0.3 src/styles/main.css 顶部
覆盖主题色为现有绿色 `#42b883`：

```css
:root {
  --color-primary: #42b883;
  --color-primary-dark: #369870;
  --color-success: #42b883;
  --color-warning: #ff9800;
  --color-danger: #e74c3c;
  --app-title-color: #333;
}
```

---

## 阶段 1：交互组件（snackbar / dialog）

### src/views/ExportView.vue
- `import { snackbar } from '@varlet/ui'`
- 删除 `message` ref 和 `.success-msg`，改为：
```ts
snackbar({ type: 'success', message: `导出成功！共 ${count} 条记录`, position: 'top' })
```

### src/modules/diary/Component.vue — 删除记录确认
- `import { dialog } from '@varlet/ui'`
- 包装 `store.deleteRecord(r.id)`：
```ts
function confirmDelete(id: string) {
  dialog({
    title: '删除记录',
    message: '确定删除这条记录吗？',
    onConfirm: () => store.deleteRecord(id),
  })
}
```
模板：`@click="confirmDelete(r.id)"`

### src/modules/todo/Component.vue — 删除待办确认
- 同样用 `dialog` 包装 `deleteTodo(i)`

### src/modules/algorithm/Component.vue — 删除题目确认
- 同样用 `dialog` 包装 `deleteProblem(i)`

---

## 阶段 2：表单组件（var-input / var-button / var-select）

### src/modules/diary/Component.vue
快速输入区：
```html
<div class="quick-input">
  <var-input variant="outlined" size="small" v-model="inputTime" placeholder="时间" style="width: 90px" />
  <var-input variant="outlined" v-model="inputText" placeholder="记一笔..." @keydown.enter="submit" />
  <var-button type="primary" @click="submit" :disabled="!inputText.trim()">记</var-button>
</div>
```
编辑模式：
```html
<var-input variant="outlined" size="small" v-model="editTime" style="width: 80px" />
<var-input variant="outlined" v-model="editText" placeholder="内容" @keydown.enter="saveEdit" />
<var-button @click="cancelEdit">取消</var-button>
<var-button type="primary" @click="saveEdit">保存</var-button>
```

### src/modules/todo/Component.vue
```html
<var-input v-model="newTodo" @keydown.enter="addTodo" placeholder="添加待办..." />
<var-button type="primary" @click="addTodo" :disabled="!newTodo.trim()" round>+</var-button>
```

### src/modules/algorithm/Component.vue
```html
<var-input v-model="newProblem.title" placeholder="题目名称" />
<var-select v-model="newProblem.difficulty">
  <var-option value="easy">简单</var-option>
  <var-option value="medium">中等</var-option>
  <var-option value="hard">困难</var-option>
</var-select>
<var-input v-model="newProblem.tags" placeholder="标签 (逗号分隔)" />
<var-input v-model="newProblem.note" :multiline="true" placeholder="思路笔记 (可选)" />
<var-button type="primary" block @click="addProblem" :disabled="!newProblem.title.trim()">添加</var-button>
```

---

## 阶段 3：列表与控件

### src/modules/diary/Component.vue — 记录列表
用 `<var-paper>` 包裹记录，或用 `<var-cell>`：
```html
<var-cell v-ripple @click="startEdit(r.id, r.time, r.text)">
  <template #icon>
    <span class="record-time">{{ r.time }}</span>
  </template>
  {{ r.text }}
  <template #extra>
    <var-button text @click.stop="confirmDelete(r.id)">删</var-button>
  </template>
</var-cell>
```

### src/modules/todo/Component.vue — 勾选项
```html
<var-cell>
  <template #icon>
    <var-checkbox v-model="item.done" @click="toggleTodo(i)" />
  </template>
  <span :class="{ done: item.done }">{{ item.text }}</span>
  <template #extra>
    <var-button text @click="confirmDelete(i)">×</var-button>
  </template>
</var-cell>
```

### src/modules/algorithm/Component.vue — 题目卡片 + 标签
```html
<var-paper elevation="2" class="problem-item">
  <div class="problem-header">
    <span class="problem-title">{{ p.title }}</span>
    <var-chip :type="chipType(p.difficulty)">{{ difficultyLabels[p.difficulty] }}</var-chip>
  </div>
  <div v-if="p.tags.length" class="tags">
    <var-chip v-for="t in p.tags" :key="t" size="sm">{{ t }}</var-chip>
  </div>
</var-paper>
```

### src/views/SettingsView.vue — 开关
```html
<var-switch v-if="!m.isCore" v-model="enabled" @change="moduleStore.toggle(m.id)" />
<span v-else class="locked-badge">必开</span>
```

---

## 阶段 4：布局弹层

### src/App.vue — 顶部栏 + 侧边栏
```html
<var-app-bar :title="currentTitle">
  <template #left>
    <var-button text @click="sidebarOpen = !sidebarOpen" v-ripple>☰</var-button>
  </template>
</var-app-bar>

<var-popup position="left" v-model:show="sidebarOpen">
  <div class="sidebar-content">
    <div class="sidebar-header">📝 我的日记</div>
    <router-link v-for="item in navItems" ...>...</router-link>
  </div>
</var-popup>
```

### src/modules/diary/Component.vue — 感悟编辑弹层
```html
<var-popup position="bottom" v-model:show="editingReflection">
  <div class="reflection-popup">
    <var-input :multiline="true" v-model="reflectionText" placeholder="今天有什么想说的..." />
    <var-button type="primary" block @click="saveReflection">保存</var-button>
  </div>
</var-popup>
```

---

## 阶段 5：清理 CSS

删除 main.css 中被 Varlet 替代的样式块：
- `.top-bar` 相关（改用 var-app-bar）
- `.sidebar` / `.overlay`（改用 var-popup）
- `.switch` / `.slider`（改用 var-switch）
- `.quick-input button` / `.primary-btn`（改用 var-button）
- `.add-form input/select/textarea`（改用 var-input/var-select）
- `.todo-item` checkbox 样式（改用 var-checkbox）
- 各处原生 input border/focus 样式（改用 var-input variant）

保留：`.date-bar`（日期翻页逻辑特殊）、`.records` 布局、`.reflection` 布局等结构样式。

预计精简 300-400 行。

---

## 验证步骤
1. `npm run typecheck` — 类型检查
2. `npm run build` — 构建
3. 手动测试：日记增删改、待办、算法记录、导出、设置开关、侧边栏
