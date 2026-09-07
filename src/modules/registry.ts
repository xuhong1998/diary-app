import type { DiaryModule } from './types'
import TodoComponent from './todo/Component.vue'
import AlgorithmComponent from './algorithm/Component.vue'
import InterviewComponent from './interview/Component.vue'
import DiaryComponent from './diary/Component.vue'
import PomodoroComponent from './pomodoro/Component.vue'

export const builtinModules: DiaryModule[] = [
  {
    id: 'diary',
    name: '日记',
    icon: '📝',
    description: '随时随地记录，晚上写感悟',
    mdSection: '今日记录',
    isCore: true,
    defaultData: () => ({}),
    component: DiaryComponent,
  },
  {
    id: 'todo',
    name: '待办',
    icon: '✅',
    description: '当日待办与每日打卡',
    mdSection: '待办',
    defaultData: () => ({ items: [] }),
    component: TodoComponent,
  },
  {
    id: 'algorithm',
    name: '算法',
    icon: '🧮',
    description: '记录每天刷的算法题',
    mdSection: '算法练习',
    defaultData: () => ({ problems: [] }),
    component: AlgorithmComponent,
  },
  {
    id: 'interview',
    name: '面试题',
    icon: '💼',
    description: '面试知识点笔记与间隔复习',
    mdSection: '面试题',
    defaultData: () => ({ items: [], summary: '' }),
    component: InterviewComponent,
  },
  {
    id: 'pomodoro',
    name: '番茄钟',
    icon: '🍅',
    description: '专注计时，关联待办，追踪专注统计',
    mdSection: '番茄钟',
    defaultData: () => ({ sessions: [] }),
    component: PomodoroComponent,
  },
]
