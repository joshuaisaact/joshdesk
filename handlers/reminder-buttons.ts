import type {
  AllMiddlewareArgs,
  SlackActionMiddlewareArgs,
  BlockButtonAction,
} from '@slack/bolt'
import type { MonthSchedule } from '../types/schedule'
import { format, addDays, startOfWeek } from 'date-fns'
import { updateAttendance } from '../services/schedule'
import { saveSchedule, getWorkspaceSettings } from '../services/storage'
import { logger } from '../utils/logger'
import type { AttendanceStatus } from '../constants'
import type { Block, KnownBlock } from '@slack/types'

type ReminderHandlerArgs = AllMiddlewareArgs &
  SlackActionMiddlewareArgs<BlockButtonAction>

function renderUserList(
  users: Array<{ userId: string }>,
  emptyMessage: string,
): string {
  return users.length
    ? users.map((a) => a.userId).join(' ')
    : `_${emptyMessage}_`
}

function getDayAttendees(schedule: MonthSchedule, week: number, day: string) {
  const attendees = schedule[week][day]?.attendees || []
  const categories = new Map<string, Array<{ userId: string }>>()

  attendees.forEach((attendee) => {
    if (!categories.has(attendee.status)) {
      categories.set(attendee.status, [])
    }
    categories.get(attendee.status)?.push({ userId: attendee.userId })
  })

  return categories
}

function isAttendanceStatus(status: string): status is AttendanceStatus {
  return ['office', 'remote', 'traveling', 'vacation'].includes(status)
}

export const handleReminderAction = async (
  { ack, body, action, client, context }: ReminderHandlerArgs,
  schedule: MonthSchedule,
  state: Map<string, MonthSchedule>,
) => {
  await ack()

  try {
    if (!context.teamId) {
      logger.warn('No team ID in context')
      return
    }

    if (!action.value) {
      logger.warn('No action value provided')
      return
    }

    if (!body.message) {
      logger.warn('No message found in body')
      return
    }

    // Parse action
    // Parse action
    // Parse action
    const [, categoryId, day, week] = action.value.split(':')

    if (!categoryId || !day || week === undefined) {
      logger.warn({
        msg: 'Invalid action value format',
        value: action.value,
      })
      return
    }

    if (!isAttendanceStatus(categoryId)) {
      logger.warn({
        msg: 'Invalid category ID',
        categoryId,
      })
      return
    }

    // Update the schedule
    const updatedSchedule = await updateAttendance(
      schedule,
      day,
      parseInt(week, 10),
      body.user.id,
      categoryId,
      client as any,
      context.teamId,
    )

    // Update state and save
    state.set(context.teamId, updatedSchedule)
    await saveSchedule(context.teamId, updatedSchedule)

    // Get updated attendance for the day
    const settings = getWorkspaceSettings(context.teamId)
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    const dayIndex = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ].indexOf(day)
    const date = addDays(monday, dayIndex)
    const dayAttendees = getDayAttendees(
      updatedSchedule,
      parseInt(week, 10),
      day,
    )

    // Create status text for the day
    const statusBlocks = settings.categories
      .filter((cat) => cat.isEnabled)
      .map((category) => {
        const users = dayAttendees.get(category.id) || []
        return users.length > 0
          ? `${category.emoji} ${renderUserList(users, '')}`
          : null
      })
      .filter(Boolean)
      .join('\n')

    // Update just the text part of the message, keeping the buttons
    const updatedBlocks = body.message.blocks.map(
      (block: KnownBlock | Block) => {
        if (
          block.type === 'section' &&
          'text' in block &&
          block.text &&
          'text' in block.text &&
          block.text.text.includes(day)
        ) {
          return {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${day}, ${format(date, 'do MMMM')}*${
                statusBlocks ? '\n' + statusBlocks : '\n_No one scheduled yet_'
              }`,
            },
          }
        }
        return block
      },
    )

    await client.chat.update({
      channel: body.container.channel_id,
      ts: body.container.message_ts,
      blocks: updatedBlocks,
      text: 'Thanks for updating your status!',
    })

    logger.info({
      msg: 'Status updated from reminder',
      user: body.user.id,
      day,
      week,
      categoryId,
      teamId: context.teamId,
    })

    return updatedSchedule
  } catch (error) {
    logger.error({
      msg: 'Failed to handle reminder action',
      error,
      actionId: action.action_id,
      teamId: context.teamId,
    })
  }
}
