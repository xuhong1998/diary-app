import type { Component } from 'vue'

export interface DiaryModule {
  id: string
  name: string
  icon: string
  description: string
  mdSection: string
  isCore?: boolean
  defaultData(): any
  component: Component
}
