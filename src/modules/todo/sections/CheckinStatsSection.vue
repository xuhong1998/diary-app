<script setup lang="ts">
import { inject } from 'vue'
import { checkinKey } from '../checkinKey'

const c = inject(checkinKey)!
</script>

<template>
  <div v-if="c.items.length" class="list-section">
    <div class="ci-stat-list">
      <div v-for="item in c.items" :key="item.id" class="ci-stat-card" :class="{ archived: !item.active }">
        <div class="ci-stat-head">
          <span class="ci-icon">{{ item.icon }}</span>
          <span class="ci-name">{{ item.name }}</span>
          <span class="ci-kind" :class="item.kind">{{ item.kind === 'build' ? '养成' : '戒断' }}</span>
          <span class="ci-streak">🔥 {{ c.streakOf(item) }}</span>
        </div>
        <div class="ci-dots">
          <div v-for="d in c.last7Of(item)" :key="d.date" class="ci-dot-wrap">
            <div class="ci-dot" :class="[d.state, { today: d.isToday }]"></div>
            <div class="ci-dot-label">{{ c.weekdayOf(d.date) }}</div>
          </div>
        </div>
        <div class="ci-stat-foot">
          本月 {{ c.monthOf(item).hit }}/{{ c.monthOf(item).total }}{{ !item.active ? ' · 已归档' : '' }}
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty-state">
    <div class="empty-text">添加每日待办后这里会显示统计</div>
  </div>
</template>
