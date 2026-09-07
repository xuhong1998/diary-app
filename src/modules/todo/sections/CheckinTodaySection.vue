<script setup lang="ts">
import { inject } from 'vue'
import { CHECKIN_PRESETS, isChecked } from '@/utils/checkin'
import { checkinKey } from '../checkinKey'

const c = inject(checkinKey)!
</script>

<template>
  <div v-if="c.activeItems.length" class="list-section">
    <div class="list-header">每日 · 达成 {{ c.progress.done }}/{{ c.progress.total }}</div>
    <div class="list-group">
      <div v-for="item in c.activeItems" :key="item.id" class="record-item ci-row">
        <div class="ci-icon">{{ item.icon }}</div>
        <div class="ci-main">
          <div class="ci-name" :class="{ struck: item.kind === 'quit' && isChecked(c.checks, item.id) }">{{ item.name }}</div>
          <div class="ci-meta">
            <span class="ci-kind" :class="item.kind">{{ item.kind === 'build' ? '养成' : '戒断' }}</span>
            <span v-if="isChecked(c.checks, item.id)" class="ci-time">{{ item.kind === 'quit' ? '破戒' : '达成' }} · {{ c.checks[item.id].at }}</span>
            <span v-else class="ci-hint">{{ item.kind === 'build' ? '待打卡' : '未破戒' }}</span>
          </div>
        </div>
        <div
          v-if="item.kind === 'build'"
          class="check-circle"
          :class="{ checked: isChecked(c.checks, item.id) }"
          @click="c.toggleCheck(item)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <button
          v-else
          class="ci-quit-btn"
          :class="{ violated: isChecked(c.checks, item.id) }"
          @click="c.toggleCheck(item)"
          :aria-label="isChecked(c.checks, item.id) ? '取消破戒标记' : '标记破戒'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="list-footer">养成型：点勾即达成 · 戒断型：仅在破戒时点 ✕</div>
  </div>

  <div v-else-if="!c.items.length" class="empty-state">
    <div class="empty-text">还没有每日待办</div>
    <div class="ci-presets empty-presets">
      <button
        v-for="p in CHECKIN_PRESETS"
        :key="p.name"
        class="ci-preset"
        @click="c.addItem(p.name, p.icon, p.kind)"
      >{{ p.icon }} {{ p.name }}</button>
    </div>
  </div>

  <div v-else class="empty-state">
    <div class="empty-text">当日没有启用的每日待办</div>
  </div>
</template>
