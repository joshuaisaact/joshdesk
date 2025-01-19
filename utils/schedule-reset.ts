import type { MonthSchedule } from '../types/schedule'
import { createMonthSchedule } from '../services/schedule'
import { loadSchedule, saveSchedule } from '../services/storage'
import { logger } from './logger'
import { format } from 'date-fns/format'
import { tryCatch } from './error-handlers.ts'
import type { App } from '@slack/bolt'
import { sendWeeklyReminders } from '../services/reminders.ts'

export const setupWeeklyReset = (
  updateSchedule: (teamId: string, schedule: MonthSchedule) => void,
  state: Map<string, MonthSchedule>,
  app: App,
  isTestMode: boolean = false,
) => {
  const now = new Date()
  const nextFriday = new Date()

  if (isTestMode) {
    nextFriday.setSeconds(nextFriday.getSeconds() + 30)
    logger.info('TEST MODE: Schedule will reset in 30 seconds')
  } else {
    nextFriday.setDate(now.getDate() + ((5 + 7 - now.getDay()) % 7))
    nextFriday.setHours(12, 0, 0, 0)
    if (now > nextFriday) {
      nextFriday.setDate(nextFriday.getDate() + 7)
    }
  }

  const msUntilReset = nextFriday.getTime() - now.getTime()

  setTimeout(
    async () => {
      // Process each workspace in the state
      for (const [teamId] of state) {
        try {
          const newSchedule = createMonthSchedule(true)

          const oldSchedule = await loadSchedule(teamId)
          if (oldSchedule) {
            for (let week = 1; week < 4; week++) {
              if (oldSchedule[week]) {
                newSchedule[week - 1] = oldSchedule[week]
              }
            }
          }

          updateSchedule(teamId, newSchedule)
          await saveSchedule(teamId, newSchedule)

          // Send reminders after updating the schedule
          await sendWeeklyReminders(app, newSchedule, teamId)

          logger.info({
            msg: `Schedule reset for workspace ${teamId}`,
            timestamp: format(new Date(), 'EEEE do MMMM yyyy, h:mm a'),
            nextReset: format(nextFriday, 'EEEE do MMMM yyyy, h:mm a'),
            firstWeekDates: Object.entries(newSchedule[0]).map(
              ([day, schedule]) =>
                `${day}: ${format(new Date(schedule.year, schedule.month - 1, schedule.date), 'do MMM')}`,
            ),
          })
        } catch (error) {
          logger.error(
            `Failed to reset schedule for workspace ${teamId}:`,
            error,
          )
        }
      }

      // Schedule next reset
      setupWeeklyReset(updateSchedule, state, app, isTestMode)
    },
    isTestMode ? 30000 : msUntilReset,
  )

  logger.info({
    msg: 'Next schedule reset scheduled',
    scheduledFor: {
      iso: nextFriday.toISOString(),
      formatted: format(nextFriday, 'EEEE do MMMM yyyy, h:mm a'),
    },
  })
}

export const shouldResetSchedule = (): boolean => {
  const now = new Date()
  const isFridayAfternoon = now.getDay() === 5 && now.getHours() >= 16
  return isFridayAfternoon || now.getDay() >= 5
}

export const resetWorkspaceSchedules = async (
  state: Map<string, MonthSchedule>,
) =>
  tryCatch(async () => {
    if (!shouldResetSchedule()) return

    logger.info('Weekend/Friday afternoon detected - checking schedules')
    for (const [teamId] of state) {
      const currentSchedule = state.get(teamId)
      if (!currentSchedule || !isScheduleAlreadyReset(currentSchedule)) {
        const newSchedule = createMonthSchedule(true)
        const oldSchedule = await loadSchedule(teamId)

        if (oldSchedule) {
          for (let week = 1; week < 4; week++) {
            if (oldSchedule[week]) {
              newSchedule[week - 1] = oldSchedule[week]
            }
          }
        }

        state.set(teamId, newSchedule)
        await saveSchedule(teamId, newSchedule)
        logger.info(`Reset schedule for team ${teamId}`)
      } else {
        logger.info(`Schedule for team ${teamId} already reset for next week`)
      }
    }
  }, 'Failed to reset workspace schedules')

export const isScheduleAlreadyReset = (schedule: MonthSchedule): boolean => {
  const firstWeek = schedule[0]
  if (!firstWeek?.Monday) return false

  const firstMonday = new Date(
    firstWeek.Monday.year,
    firstWeek.Monday.month - 1,
    firstWeek.Monday.date,
  )

  const today = new Date()
  // If the first Monday is already in the future, the schedule has been reset
  return firstMonday > today
}
