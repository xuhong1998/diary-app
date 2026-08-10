<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDiaryStore } from '@/stores/diary'

const store = useDiaryStore()
const router = useRouter()
const keyword = ref('')
const results = ref<{ date: string; time: string; text: string; period: string }[]>([])
const searched = ref(false)

async function doSearch() {
  if (!keyword.value.trim()) {
    results.value = []
    searched.value = false
    return
  }
  results.value = await store.searchRecords(keyword.value)
  searched.value = true
}

function jumpToDate(date: string) {
  router.push('/diary')
  setTimeout(() => store.loadEntry(date), 100)
}
</script>

<template>
  <div class="page-pad">
    <div class="section-gap"></div>

    <div class="search-bar">
      <input
        class="search-input"
        v-model="keyword"
        placeholder="搜索日记内容..."
        @keydown.enter="doSearch"
      >
      <button class="ios-btn-sm" :disabled="!keyword.trim()" @click="doSearch">搜索</button>
    </div>

    <div v-if="searched && !results.length" class="empty-state">
      <div class="empty-text">没有找到相关记录</div>
    </div>

    <div v-if="results.length" class="list-section">
      <div class="list-header">{{ results.length }} 条结果</div>
      <div class="list-group">
        <div
          v-for="(r, i) in results"
          :key="i"
          class="search-result-item"
          @click="jumpToDate(r.date)"
        >
          <div class="search-result-date">{{ r.date }}</div>
          <div class="search-result-time">{{ r.time }}</div>
          <div class="search-result-text">{{ r.text }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
