import type { App } from '@slack/bolt'
import type { MonthSchedule } from '../types/schedule'
import { format, addDays, startOfWeek } from 'date-fns'
import { getWorkspaceSettings } from './storage'
import { installationStore } from './installation'
import { logger } from '../utils/logger'

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

export async function sendWeeklyReminders(
  app: App,
  schedule: MonthSchedule,
  teamId: string,
) {
  logger.info({
    msg: 'Starting to send weekly reminders',
    teamId,
  })

  try {
    const installation = await installationStore.fetchInstallation({
      teamId,
      isEnterpriseInstall: false,
      enterpriseId: undefined,
    })

    if (!installation.bot?.token) {
      throw new Error('No bot token found')
    }

    const settings = getWorkspaceSettings(teamId)
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

    // Get all workspace members
    const result = await app.client.users.list({
      token: installation.bot.token,
    })

    const members =
      result.members?.filter(
        (member) =>
          !member.is_bot &&
          !member.is_restricted &&
          !member.is_ultra_restricted &&
          !member.deleted,
      ) || []

    for (const member of members) {
      try {
        if (!member.id) {
          logger.warn({
            msg: 'Member has no ID, skipping reminder',
            member: member.name,
          })
          continue
        }

        await app.client.chat.postMessage({
          token: installation.bot.token,
          channel: member.id,
          text: "Don't forget to set your office status for this week!",
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '📅 Update Your Weekly Schedule',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: "The schedule has reset for this week. Please update your status for any days you'll be in the office.",
              },
            },
            {
              type: 'divider',
            },
            ...days.flatMap((day, index) => {
              const date = addDays(monday, index)
              const dayAttendees = getDayAttendees(schedule, 0, day)

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

              return [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*${day}, ${format(date, 'do MMMM')}*${statusBlocks ? '\n' + statusBlocks : '\n_No one scheduled yet_'}`,
                  },
                },
                {
                  type: 'actions',
                  elements: settings.categories
                    .filter((cat) => cat.isEnabled)
                    .map((category) => ({
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: `${category.emoji} ${category.displayName}`,
                        emoji: true,
                      },
                      value: `reminder:${category.id}:${day}:0`,
                      action_id: `reminder_status_${day.toLowerCase()}_0_${category.id}`,
                    })),
                },
              ]
            }),
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `_You can also update your status anytime using the Home tab._`,
                },
              ],
            },
          ],
        })

        logger.info({
          msg: 'Successfully sent reminder',
          userId: member.id,
        })
      } catch (error) {
        logger.error({
          msg: 'Failed to send reminder to user',
          error,
          userId: member.id,
        })
      }
    }
  } catch (error) {
    logger.error({
      msg: 'Failed to send weekly reminders',
      error,
      teamId,
    })
  }
}
