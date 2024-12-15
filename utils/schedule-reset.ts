// src/utils/scheduleReset.ts
import type { MonthSchedule } from '../types/schedule'
import { createMonthSchedule } from '../services/schedule'
import { loadSchedule, saveSchedule } from '../services/storage'

export const setupWeeklyReset = (
  updateSchedule: (schedule: MonthSchedule) => void,
  isTestMode: boolean = false,
) => {
  const now = new Date()
  const nextFriday = new Date()

  if (isTestMode) {
    nextFriday.setSeconds(nextFriday.getSeconds() + 30)
    console.log('TEST MODE: Schedule will reset in 30 seconds')
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

      console.log(`Schedule reset at ${new Date().toLocaleString()}`)
      setupWeeklyReset(updateSchedule, isTestMode)
    },
    isTestMode ? 30000 : msUntilReset,
  )

  console.log(
    `Next schedule reset scheduled for ${nextFriday.toLocaleString()}`,
  )
}
