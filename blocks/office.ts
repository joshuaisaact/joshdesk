import type { Block, KnownBlock } from '@slack/types'
import type { MonthSchedule, DaySchedule } from '../types/schedule'
import { format, startOfDay, isBefore } from 'date-fns'
import { getWorkspaceSettings } from '../services/storage'
import type { WorkspaceSettings } from '../services/storage'

function normalizeUserId(userId: string): string {
  if (!userId) return ''
  if (userId.startsWith('<@') && userId.endsWith('>')) return userId
  return `<@${userId}>`
}

function shouldShowDay(scheduleDate: Date): boolean {
  const today = startOfDay(new Date())
  const dayDate = startOfDay(scheduleDate)
  return !isBefore(dayDate, today)
}

function renderUserList(
  users: Array<{ userId: string }>,
  emptyMessage: string,
): string {
  return users.length
    ? users.map((a) => normalizeUserId(a.userId)).join(' ')
    : `_${emptyMessage}_`
}

function createSimpleDayBlock(
  day: string,
  schedule: DaySchedule,
  settings: WorkspaceSettings,
): (KnownBlock | Block)[] | null {
  const scheduleDate = new Date(
    schedule.year,
    schedule.month - 1,
    schedule.date,
  )
  if (!shouldShowDay(scheduleDate)) return null

  const formattedDate = format(scheduleDate, 'EEEE, do MMMM')

  // Group users by category
  const enabledCategories = settings.categories.filter((c) => c.isEnabled)
  const usersByCategory = enabledCategories.reduce(
    (acc, category) => ({
      ...acc,
      [category.id]: schedule.attendees.filter((a) => a.status === category.id),
    }),
    {} as Record<string, typeof schedule.attendees>,
  )

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${formattedDate}*`,
      },
    },
  ]

  // Add each category that has users
  enabledCategories.forEach((category) => {
    const users = usersByCategory[category.id] || []
    if (users.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${category.emoji} ${renderUserList(users, '')}`,
        },
      })
    }
  })

  // If no one is in any category, show "No one scheduled"
  const hasAnyUsers = enabledCategories.some(
    (category) => (usersByCategory[category.id] || []).length > 0,
  )

  if (!hasAnyUsers) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_No one scheduled_',
      },
    })
  }

  blocks.push({
    type: 'divider',
  })

  return blocks
}

export const generateOfficeBlocks = async (
  monthSchedule: MonthSchedule,
  currentWeek: number,
  teamId: string,
): Promise<(KnownBlock | Block)[]> => {
  const settings = getWorkspaceSettings(teamId)
  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📅 Office Schedule This Week',
        emoji: true,
      },
    },
    {
      type: 'divider',
    },
  ]

  const weekSchedule = monthSchedule[currentWeek]
  if (!weekSchedule) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🚫 No schedule available for this week',
      },
    })
    return blocks
  }

  let hasVisibleDays = false

  for (const [day, schedule] of Object.entries(weekSchedule)) {
    const dayBlocks = createSimpleDayBlock(day, schedule, settings)
    if (dayBlocks) {
      hasVisibleDays = true
      blocks.push(...dayBlocks)
    }
  }

  if (!hasVisibleDays) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '📅 No more days scheduled this week',
      },
    })
  }

  // Remove the last divider
  if (blocks.length > 0 && blocks[blocks.length - 1].type === 'divider') {
    blocks.pop()
  }

  return blocks
}
