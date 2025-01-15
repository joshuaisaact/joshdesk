import type { MonthSchedule } from '../types/schedule'
import { createMonthSchedule } from '../services/schedule'
import { loadSchedule, saveSchedule } from '../services/storage'
import { logger } from './logger'
import { format } from 'date-fns/format'

export const setupWeeklyReset = (
  updateSchedule: (teamId: string, schedule: MonthSchedule) => void,
  state: Map<string, MonthSchedule>,
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
      setupWeeklyReset(updateSchedule, state, isTestMode)
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
