import { describe, it, expect } from 'vitest'
import {
  REVIEW_INTERVALS,
  nextStage,
  nextReviewDate,
  applyReview,
  initialReviewFields,
  isDue,
  masteryOf,
  dueItems,
} from '@/utils/review'
import type { InterviewItem } from '@/types'

function makeItem(overrides: Partial<InterviewItem> = {}): InterviewItem {
  return {
    id: 'test-id',
    topic: '事件循环',
    category: 'JavaScript',
    note: '宏任务与微任务',
    stage: 0,
    nextReview: '2026-08-01',
    ...overrides,
  }
}

describe('nextStage', () => {
  it('advances on good', () => {
    expect(nextStage(0, 'good')).toBe(1)
    expect(nextStage(3, 'good')).toBe(4)
  })

  it('caps at max stage', () => {
    expect(nextStage(REVIEW_INTERVALS.length - 1, 'good')).toBe(REVIEW_INTERVALS.length - 1)
  })

  it('stays on fuzzy', () => {
    expect(nextStage(2, 'fuzzy')).toBe(2)
    expect(nextStage(0, 'fuzzy')).toBe(0)
  })

  it('resets to 0 on forgot', () => {
    expect(nextStage(5, 'forgot')).toBe(0)
    expect(nextStage(0, 'forgot')).toBe(0)
  })
})

describe('nextReviewDate', () => {
  it('adds interval days by stage', () => {
    expect(nextReviewDate(0, '2026-08-17')).toBe('2026-08-18')
    expect(nextReviewDate(1, '2026-08-17')).toBe('2026-08-19')
    expect(nextReviewDate(3, '2026-08-17')).toBe('2026-08-24')
  })

  it('handles month boundary', () => {
    expect(nextReviewDate(2, '2026-08-30')).toBe('2026-09-03')
    expect(nextReviewDate(6, '2026-07-01')).toBe('2026-08-30')
  })
})

describe('applyReview', () => {
  it('good advances stage and schedules next review', () => {
    const item = makeItem({ stage: 1, nextReview: '2026-08-17' })
    const updated = applyReview(item, 'good', '2026-08-17')
    expect(updated.stage).toBe(2)
    expect(updated.nextReview).toBe('2026-08-21')
    expect(updated.lastReview).toBe('2026-08-17')
  })

  it('forgot resets to stage 0 and tomorrow', () => {
    const item = makeItem({ stage: 4, lastReview: '2026-08-01' })
    const updated = applyReview(item, 'forgot', '2026-08-17')
    expect(updated.stage).toBe(0)
    expect(updated.nextReview).toBe('2026-08-18')
  })

  it('fuzzy repeats same stage', () => {
    const item = makeItem({ stage: 2 })
    const updated = applyReview(item, 'fuzzy', '2026-08-17')
    expect(updated.stage).toBe(2)
    expect(updated.nextReview).toBe('2026-08-21')
  })

  it('does not mutate the original item', () => {
    const item = makeItem({ stage: 3 })
    applyReview(item, 'good', '2026-08-17')
    expect(item.stage).toBe(3)
    expect(item.nextReview).toBe('2026-08-01')
  })
})

describe('initialReviewFields', () => {
  it('starts at stage 0 due tomorrow', () => {
    expect(initialReviewFields('2026-08-17')).toEqual({
      stage: 0,
      nextReview: '2026-08-18',
    })
  })
})

describe('isDue', () => {
  it('due today and overdue', () => {
    expect(isDue(makeItem({ nextReview: '2026-08-17' }), '2026-08-17')).toBe(true)
    expect(isDue(makeItem({ nextReview: '2026-08-01' }), '2026-08-17')).toBe(true)
  })

  it('not due in the future', () => {
    expect(isDue(makeItem({ nextReview: '2026-08-18' }), '2026-08-17')).toBe(false)
  })
})

describe('masteryOf', () => {
  it('new when never reviewed', () => {
    expect(masteryOf(makeItem())).toBe('new')
  })

  it('learning when reviewed but below mastered stage', () => {
    expect(masteryOf(makeItem({ stage: 3, lastReview: '2026-08-01' }))).toBe('learning')
  })

  it('mastered at stage >= 4', () => {
    expect(masteryOf(makeItem({ stage: 4, lastReview: '2026-08-01' }))).toBe('mastered')
    expect(masteryOf(makeItem({ stage: 6, lastReview: '2026-08-01' }))).toBe('mastered')
  })
})

describe('dueItems', () => {
  it('collects due items across dates sorted by nextReview', () => {
    const entries = [
      {
        date: '2026-08-15',
        items: [
          makeItem({ id: 'a', topic: '闭包', nextReview: '2026-08-16' }),
          makeItem({ id: 'b', topic: '原型链', nextReview: '2026-08-20' }),
        ],
      },
      {
        date: '2026-08-10',
        items: [makeItem({ id: 'c', topic: 'TCP', nextReview: '2026-08-17' })],
      },
      { date: '2026-08-01', items: [] },
    ]
    const due = dueItems(entries, '2026-08-17')
    expect(due.map(d => d.item.id)).toEqual(['a', 'c'])
    expect(due[0].date).toBe('2026-08-15')
  })

  it('returns empty for no entries', () => {
    expect(dueItems([], '2026-08-17')).toEqual([])
  })

  it('handles entries without items', () => {
    expect(dueItems([{ date: '2026-08-01' }], '2026-08-17')).toEqual([])
  })
})
