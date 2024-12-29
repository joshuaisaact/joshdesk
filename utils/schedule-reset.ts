import type { MonthSchedule } from '../types/schedule'
import { createMonthSchedule } from '../services/schedule'
import { loadSchedule, saveSchedule } from '../services/storage'
import { logger } from './logger'
import { format } from 'date-fns/format'

export const setupWeeklyReset = (
  updateSchedule: (schedule: MonthSchedule) => void,
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
      // Get fresh schedule frame starting from next Monday
      const newSchedule = createMonthSchedule(true)

      // Copy over any existing future week data
      const oldSchedule = await loadSchedule()
      if (oldSchedule) {
        // Copy data from weeks 1-3 to weeks 0-2 in the new schedule
        for (let week = 1; week < 4; week++) {
          if (oldSchedule[week]) {
            newSchedule[week - 1] = oldSchedule[week]
          }
        }
      }

      updateSchedule(newSchedule)
      await saveSchedule(newSchedule)

      logger.info({
        msg: 'Schedule reset',
        timestamp: format(new Date(), 'EEEE do MMMM yyyy, h:mm a'),
        nextReset: format(nextFriday, 'EEEE do MMMM yyyy, h:mm a'),
        firstWeekDates: Object.entries(newSchedule[0]).map(
          ([day, schedule]) =>
            `${day}: ${format(new Date(schedule.year, schedule.month - 1, schedule.date), 'do MMM')}`,
        ),
      })
      setupWeeklyReset(updateSchedule, isTestMode)
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
