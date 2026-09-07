import type { InjectionKey } from 'vue'
import type { useCheckin } from './useCheckin'

/** 待办页容器 provide、各 checkin section inject 的共享键 */
export const checkinKey: InjectionKey<ReturnType<typeof useCheckin>> = Symbol('checkin')
