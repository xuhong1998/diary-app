<script setup lang="ts">
import { useModuleStore } from '@/stores/modules'

const moduleStore = useModuleStore()
</script>

<template>
  <div class="settings-page">
    <h2>设置</h2>

    <div class="module-list">
      <div class="setting-section-title">模块管理</div>
      <div v-for="m in moduleStore.modules" :key="m.id" class="module-toggle">
        <div class="module-info">
          <span class="module-icon">{{ m.icon }}</span>
          <div>
            <div class="module-name">
              {{ m.name }}
              <span v-if="m.isCore" class="core-badge">核心</span>
            </div>
            <div class="module-desc">{{ m.description }}</div>
          </div>
        </div>
        <label class="switch" v-if="!m.isCore">
          <input
            type="checkbox"
            :checked="moduleStore.isEnabled(m.id)"
            @change="moduleStore.toggle(m.id)"
          />
          <span class="slider"></span>
        </label>
        <span v-else class="locked-badge">必开</span>
      </div>
    </div>

    <div class="about">
      <p>数据存储在本地浏览器（IndexedDB）</p>
      <p>导出 JSON 后用转换脚本生成 md</p>
    </div>
  </div>
</template>
