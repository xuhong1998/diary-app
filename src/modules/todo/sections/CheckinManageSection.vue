<script setup lang="ts">
import { inject } from 'vue'
import { CHECKIN_PRESETS, CHECKIN_ICONS } from '@/utils/checkin'
import { checkinKey } from '../checkinKey'

const c = inject(checkinKey)!
</script>

<template>
  <div class="list-section">
    <div class="list-header">快速添加</div>
    <div class="ci-presets">
      <button
        v-for="p in CHECKIN_PRESETS"
        :key="p.name"
        class="ci-preset"
        :class="{ added: c.presetAdded(p) }"
        :disabled="c.presetAdded(p)"
        @click="c.addItem(p.name, p.icon, p.kind)"
      >{{ p.icon }} {{ p.name }}</button>
    </div>
  </div>

  <div class="list-section">
    <div class="list-header">自定义每日待办</div>
    <div class="list-group ci-form">
      <input class="search-input ci-form-input" v-model="c.newName" placeholder="名称，如：早睡" @keydown.enter="c.submitNew()">
      <div class="ci-emoji-grid">
        <button
          v-for="ic in CHECKIN_ICONS"
          :key="ic"
          class="ci-emoji"
          :class="{ selected: c.newIcon === ic }"
          @click="c.newIcon = ic"
        >{{ ic }}</button>
      </div>
      <div class="ci-kind-picker">
        <div class="ci-kind-option" :class="{ selected: c.newKind === 'build' }" @click="c.newKind = 'build'">
          <span class="ci-kind build">养成</span>
          <span class="ci-kind-desc">勾选即达成</span>
        </div>
        <div class="ci-kind-option" :class="{ selected: c.newKind === 'quit' }" @click="c.newKind = 'quit'">
          <span class="ci-kind quit">戒断</span>
          <span class="ci-kind-desc">破戒时标记</span>
        </div>
      </div>
      <button class="ios-btn" :disabled="!c.newName.trim()" @click="c.submitNew()">添加每日待办</button>
    </div>
  </div>

  <div v-if="c.items.length" class="list-section">
    <div class="list-header">全部每日待办 · {{ c.items.length }}</div>
    <div class="list-group">
      <div v-for="(item, index) in c.items" :key="item.id" class="record-item ci-manage-row" :class="{ archived: !item.active }">
        <div class="ci-icon">{{ item.icon }}</div>
        <div class="ci-main">
          <div class="ci-name">{{ item.name }}</div>
          <div class="ci-meta">
            <span class="ci-kind" :class="item.kind">{{ item.kind === 'build' ? '养成' : '戒断' }}</span>
            <span v-if="!item.active" class="ci-hint">已归档</span>
          </div>
        </div>
        <button class="icon-btn muted" @click="c.moveItem(index, -1)" aria-label="上移">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button class="icon-btn muted" @click="c.moveItem(index, 1)" aria-label="下移">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button class="icon-btn" @click="c.openEdit(item)" aria-label="编辑">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn danger" @click="c.removeItem(item)" aria-label="删除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
    <div class="list-footer">排序调整会影响每日列表显示顺序 · 归档项不显示在每日列表</div>
  </div>

  <div class="sheet-overlay" :class="{ open: !!c.editing }" @click="c.editing = null"></div>
  <div class="sheet" :class="{ open: !!c.editing }">
    <div class="sheet-grabber"></div>
    <div class="sheet-title">编辑每日待办</div>
    <div v-if="c.editing" class="sheet-body">
      <input class="search-input ci-form-input" v-model="c.editName" placeholder="名称">
      <div class="ci-emoji-grid">
        <button
          v-for="ic in CHECKIN_ICONS"
          :key="ic"
          class="ci-emoji"
          :class="{ selected: c.editIcon === ic }"
          @click="c.editIcon = ic"
        >{{ ic }}</button>
      </div>
      <div class="ci-kind-picker">
        <div class="ci-kind-option" :class="{ selected: c.editKind === 'build' }" @click="c.editKind = 'build'">
          <span class="ci-kind build">养成</span>
          <span class="ci-kind-desc">勾选即达成</span>
        </div>
        <div class="ci-kind-option" :class="{ selected: c.editKind === 'quit' }" @click="c.editKind = 'quit'">
          <span class="ci-kind quit">戒断</span>
          <span class="ci-kind-desc">破戒时标记</span>
        </div>
      </div>
      <div class="sheet-actions">
        <button class="ios-btn ios-btn-secondary" @click="c.removeItem(c.editing)">删除</button>
        <button class="ios-btn ios-btn-secondary" @click="c.toggleArchive(c.editing)">{{ c.editing.active ? '归档' : '恢复' }}</button>
        <button class="ios-btn ci-save-btn" :disabled="!c.editName.trim()" @click="c.saveEdit">保存</button>
      </div>
    </div>
  </div>
</template>
